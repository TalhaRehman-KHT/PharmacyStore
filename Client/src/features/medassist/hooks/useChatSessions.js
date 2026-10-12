import { useCallback, useEffect, useRef, useState } from "react";
import { medassistClient, toApiError } from "../api/index.js";

/**
 * The customer's past MedAssist chats. Loads on mount; call refresh() after a new chat starts
 * (e.g. from useMedAssistChat's onSessionCreated).
 */
export function useChatSessions() {
  /** @type {[import("../types.js").ChatSession[], Function]} */
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  /** @type {[import("../types.js").ApiError | null, Function]} */
  const [error, setError] = useState(null);
  const requestRef = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const list = await medassistClient.listSessions();
      if (request === requestRef.current) setSessions(list);
    } catch (e) {
      if (request === requestRef.current) setError(toApiError(e));
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, []);

  /** Delete all chats. Throws ApiError so the caller can toast it. */
  const clearHistory = useCallback(async () => {
    try {
      await medassistClient.clearHistory();
      requestRef.current += 1;
      setSessions([]);
    } catch (e) {
      throw toApiError(e);
    }
  }, []);

  useEffect(() => {
    refresh();
    return () => {
      requestRef.current += 1;
    };
  }, [refresh]);

  return { sessions, loading, error, refresh, clearHistory };
}
