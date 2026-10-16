import React, { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { MessagesSquare, X } from "lucide-react";
import UserLayout from "../../../components/UserLayout.jsx";
import { useMedAssist } from "../hooks/useMedAssist.js";
import { useChatSessions } from "../hooks/useChatSessions.js";
import ChatConversation from "../components/ChatConversation.jsx";
import SessionSidebar from "../components/SessionSidebar.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import MockBadge from "../components/MockBadge.jsx";

/**
 * Full-page MedAssist. Shares the chat with the floating widget (MedAssistContext),
 * so a conversation started in the widget continues here.
 */
export default function UserAssistant() {
  const { chat, productName, rateLimitedUntil } = useMedAssist();
  const { sessionId, answerCount, newChat, loadSession } = chat;
  const { sessions, loading, error, refresh, clearHistory } = useChatSessions();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const inputRef = useRef(null);

  // Keep the list in sync: a new chat appears, and the active one moves to the top after each answer.
  // answerCount (not status) so a one-chunk reply, e.g. an escalation, also refreshes (BUG-R2).
  const prevAnswerCountRef = useRef(answerCount);
  useEffect(() => {
    if (answerCount === prevAnswerCountRef.current) return;
    prevAnswerCountRef.current = answerCount;
    refresh();
  }, [answerCount, refresh]);

  const handleSelect = (id) => {
    setDrawerOpen(false);
    if (id !== sessionId) loadSession(id);
  };

  const handleNewChat = () => {
    setDrawerOpen(false);
    newChat();
    inputRef.current?.focus();
  };

  const closeConfirm = useCallback(() => setConfirmOpen(false), []);

  const handleClear = async () => {
    setClearing(true);
    try {
      await clearHistory();
      newChat();
      setConfirmOpen(false);
      setDrawerOpen(false);
      toast.success("Chat history cleared");
    } catch (e) {
      toast.error(e?.message || "Failed to clear history");
    } finally {
      setClearing(false);
    }
  };

  const sidebar = (
    <SessionSidebar
      sessions={sessions}
      loading={loading}
      error={error}
      activeId={sessionId}
      onSelect={handleSelect}
      onNewChat={handleNewChat}
      onClear={() => setConfirmOpen(true)}
      onRetry={refresh}
    />
  );

  const activeTitle = sessions.find((s) => s.id === sessionId)?.title;

  return (
    <UserLayout>
      {/* Fill the area under the 61px layout header so only the message list scrolls. */}
      <div className="flex h-[calc(100dvh-61px)] min-h-0">
        <aside className="hidden md:flex w-72 shrink-0 border-r border-border" aria-label="Chat history">
          {sidebar}
        </aside>

        {drawerOpen && (
          <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
        )}
        <aside
          className={`md:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] flex flex-col bg-white shadow-xl transform transition-transform duration-200 ${
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          aria-label="Chat history"
          aria-hidden={!drawerOpen}
          inert={!drawerOpen}
        >
          <div className="p-3 flex items-center justify-between border-b border-border">
            <p className="text-sm font-bold text-text-primary">Chats</p>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="p-2 rounded-xl hover:bg-gray-100"
              aria-label="Close chat history"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 min-h-0">{sidebar}</div>
        </aside>

        <section className="flex-1 min-w-0 flex flex-col" aria-label="MedAssist chat">
          <div className="shrink-0 flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-border bg-white">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="md:hidden p-2 rounded-xl text-primary-green hover:bg-primary-green/10 transition-colors"
              aria-label="Open chat history"
            >
              <MessagesSquare className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-text-primary truncate">
                  {activeTitle || "MedAssist"}
                </h2>
                <MockBadge />
              </div>
              <p className="text-xs text-text-secondary">Information only, based on US FDA labels</p>
            </div>
          </div>

          <ChatConversation
            ref={inputRef}
            chat={chat}
            productName={productName}
            rateLimitedUntil={rateLimitedUntil}
            contentClassName="max-w-3xl mx-auto w-full"
          />
        </section>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Clear chat history?"
        body="All your MedAssist chats will be removed from this list. This cannot be undone. Questions already sent to a pharmacist stay with the pharmacist."
        confirmLabel="Clear history"
        busy={clearing}
        busyLabel="Clearing…"
        onConfirm={handleClear}
        onCancel={closeConfirm}
      />
    </UserLayout>
  );
}
