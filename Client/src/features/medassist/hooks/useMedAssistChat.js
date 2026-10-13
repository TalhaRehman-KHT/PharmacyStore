import { useCallback, useEffect, useRef, useState } from "react";
import { medassistClient, toApiError } from "../api/index.js";

/**
 * @typedef {import("../types.js").ChatMessage} ChatMessage
 * @typedef {import("../types.js").ApiError} ApiError
 * @typedef {'idle' | 'loading' | 'streaming' | 'error'} ChatStatus
 */

let localCounter = 0;
const localId = (prefix) => `local-${prefix}-${Date.now().toString(36)}-${++localCounter}`;

/**
 * Chat state for one MedAssist conversation.
 * - status: 'loading' until the first token (or while a session loads), then 'streaming', then 'idle'.
 * - On error the user's question stays in the list; retry() removes it and asks again.
 * - Client-only `note` on a user message: 'failed' (no answer) or 'stopped' (user pressed Stop).
 *
 * @param {{ initialSessionId?: string, onSessionCreated?: (sessionId: string) => void }} [options]
 */
export function useMedAssistChat({ initialSessionId, onSessionCreated } = {}) {
  /** @type {[ChatMessage[], Function]} */
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(initialSessionId ?? null);
  /** @type {[ChatStatus, Function]} */
  const [status, setStatus] = useState("idle");
  /** @type {[ApiError | null, Function]} */
  const [error, setError] = useState(null);

  const abortRef = useRef(null);
  const sessionIdRef = useRef(sessionId);
  const lastQuestionRef = useRef(null);
  const lastUserIdRef = useRef(null);
  const loadTokenRef = useRef(0);
  const onSessionCreatedRef = useRef(onSessionCreated);

  useEffect(() => {
    onSessionCreatedRef.current = onSessionCreated;
  }, [onSessionCreated]);

  const updateSessionId = useCallback((id) => {
    sessionIdRef.current = id;
    setSessionId(id);
  }, []);

  /** Abort any in-flight stream and drop an empty assistant placeholder. */
  const abortCurrent = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    loadTokenRef.current += 1;
    setMessages((prev) => prev.filter((m) => !(m.role === "assistant" && m.content === "" && !m.meta)));
  }, []);

  const send = useCallback(
    async (question) => {
      const text = String(question || "").trim();
      if (!text || abortRef.current) return;

      const controller = new AbortController();
      abortRef.current = controller;
      lastQuestionRef.current = text;
      loadTokenRef.current += 1; // a pending loadSession must not overwrite this exchange

      const sid = sessionIdRef.current ?? "";
      const now = new Date().toISOString();
      const userId = localId("user");
      lastUserIdRef.current = userId;
      let assistantId = localId("assistant");
      setMessages((prev) => [
        ...prev,
        { id: userId, sessionId: sid, role: "user", content: text, createdAt: now },
        { id: assistantId, sessionId: sid, role: "assistant", content: "", createdAt: now },
      ]);
      setError(null);
      setStatus("loading");

      const live = () => abortRef.current === controller && !controller.signal.aborted;
      const patchAssistant = (id, patch) =>
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch(m) } : m)));

      const fail = (e) => {
        if (!live()) return;
        abortRef.current = null;
        const id = assistantId;
        // The question keeps a "not answered" note after the error card is gone.
        setMessages((prev) =>
          prev.filter((m) => m.id !== id).map((m) => (m.id === userId ? { ...m, note: "failed" } : m))
        );
        setError(toApiError(e));
        setStatus("error");
      };

      try {
        await medassistClient.askStream(
          { question: text, sessionId: sessionIdRef.current ?? undefined },
          {
            onToken(token) {
              if (!live()) return;
              setStatus("streaming");
              patchAssistant(assistantId, (m) => ({ content: m.content + token }));
            },
            onCitations(citations) {
              if (!live()) return;
              patchAssistant(assistantId, () => ({ citations }));
            },
            onMeta(meta) {
              if (!live()) return;
              const oldId = assistantId;
              assistantId = meta.messageId;
              patchAssistant(oldId, () => ({ id: meta.messageId, sessionId: meta.sessionId, meta }));
              if (meta.sessionId !== sessionIdRef.current) {
                const isNew = !sessionIdRef.current;
                updateSessionId(meta.sessionId);
                setMessages((prev) => prev.map((m) => (m.sessionId ? m : { ...m, sessionId: meta.sessionId })));
                if (isNew) onSessionCreatedRef.current?.(meta.sessionId);
              }
            },
            onDone() {
              if (!live()) return;
              abortRef.current = null;
              setStatus("idle");
            },
            onError: fail,
          },
          controller.signal
        );
      } catch (e) {
        fail(e);
      }
    },
    [updateSessionId]
  );

  const stop = useCallback(() => {
    if (!abortRef.current) return;
    // Mark the question so the user sees the answer was stopped (any partial text is kept).
    const id = lastUserIdRef.current;
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, note: "stopped" } : m)));
    abortCurrent();
    setStatus("idle");
  }, [abortCurrent]);

  const retry = useCallback(() => {
    const question = lastQuestionRef.current;
    if (!question || abortRef.current) return;
    // Remove the failed question so send() doesn't show it twice.
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      return last?.role === "user" && last.content === question ? prev.slice(0, -1) : prev;
    });
    send(question);
  }, [send]);

  const newChat = useCallback(() => {
    abortCurrent();
    setMessages([]);
    updateSessionId(null);
    lastQuestionRef.current = null;
    setError(null);
    setStatus("idle");
  }, [abortCurrent, updateSessionId]);

  const loadSession = useCallback(
    async (id) => {
      abortCurrent();
      const token = loadTokenRef.current;
      updateSessionId(id);
      setMessages([]);
      setError(null);
      setStatus("loading");
      try {
        const list = await medassistClient.getMessages(id);
        if (token !== loadTokenRef.current) return;
        setMessages(list);
        setStatus("idle");
      } catch (e) {
        if (token !== loadTokenRef.current) return;
        setError(toApiError(e));
        setStatus("error");
      }
    },
    [abortCurrent, updateSessionId]
  );

  /** Optimistic thumbs up/down. Reverts and exposes `error` if the request fails. */
  const rate = useCallback(async (messageId, rating) => {
    let previous;
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        previous = m.feedback;
        return { ...m, feedback: rating };
      })
    );
    try {
      await medassistClient.sendFeedback(messageId, rating);
    } catch (e) {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, feedback: previous } : m)));
      setError(toApiError(e));
    }
  }, []);

  // Load the initial session once; abort any stream on unmount.
  useEffect(() => {
    if (initialSessionId) loadSession(initialSessionId);
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
      loadTokenRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    messages,
    sessionId,
    status,
    error,
    isBusy: status === "loading" || status === "streaming",
    send,
    stop,
    retry,
    newChat,
    loadSession,
    rate,
  };
}
