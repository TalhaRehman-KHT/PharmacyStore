import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LogIn, MessageCircle, SquarePen, X } from "lucide-react";
import ChatConversation from "./ChatConversation.jsx";

function LoggedOutBody({ onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center bg-background px-6 py-10">
      <div className="w-16 h-16 rounded-2xl bg-primary-green/10 flex items-center justify-center mb-4">
        <MessageCircle className="w-8 h-8 text-primary-green" />
      </div>
      <p className="text-text-primary font-semibold">Log in to use MedAssist</p>
      <p className="mt-1 text-sm text-text-secondary">Ask about medicines, side effects and stock.</p>
      <button
        type="button"
        onClick={() => {
          onClose();
          navigate("/user/login", { state: { from: location.pathname } });
        }}
        className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-primary-green text-white rounded-xl font-medium text-sm hover:bg-dark-green transition-colors"
      >
        <LogIn className="w-4 h-4" />
        Log in
      </button>
    </div>
  );
}

/**
 * Desktop: 380px card bottom-right. Mobile (< sm): full-screen sheet.
 * @param {{ chat: ReturnType<typeof import("../hooks/useMedAssistChat.js").useMedAssistChat>,
 *   loggedIn: boolean, productName?: string | null, rateLimitedUntil: number, onClose: () => void }} props
 */
export default function ChatPanel({ chat, loggedIn, productName, rateLimitedUntil, onClose }) {
  const { messages, error, newChat } = chat;
  const panelRef = useRef(null);
  const inputRef = useRef(null);

  // Focus moves into the panel on open.
  useEffect(() => {
    (inputRef.current || panelRef.current)?.focus();
  }, []);

  // Esc closes.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleNewChat = () => {
    newChat();
    inputRef.current?.focus();
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby="medassist-title"
      tabIndex={-1}
      className="fixed z-[60] inset-0 sm:inset-auto sm:right-6 sm:bottom-6 sm:w-[380px] sm:h-[600px] sm:max-h-[calc(100dvh-3rem)] flex flex-col bg-white sm:rounded-2xl sm:border sm:border-gray-100 shadow-2xl overflow-hidden focus:outline-none"
    >
      <header className="shrink-0 flex items-center gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 sm:pt-3 border-b border-border bg-white">
        <div className="w-9 h-9 rounded-xl bg-primary-green/10 flex items-center justify-center shrink-0">
          <MessageCircle className="w-5 h-5 text-primary-green" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 id="medassist-title" className="text-base font-bold text-text-primary leading-tight">
            MedAssist
          </h2>
          <span className="inline-block mt-0.5 px-2 py-0.5 rounded-lg bg-primary-green/10 text-primary-green text-[11px] font-semibold">
            Information only
          </span>
        </div>
        {loggedIn && (
          <button
            type="button"
            onClick={handleNewChat}
            disabled={messages.length === 0 && !error}
            aria-label="New chat"
            title="New chat"
            className="p-2 rounded-xl text-text-secondary hover:bg-gray-100 hover:text-text-primary transition-colors disabled:opacity-40"
          >
            <SquarePen className="w-5 h-5" />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close MedAssist"
          className="p-2 rounded-xl text-text-secondary hover:bg-gray-100 hover:text-text-primary transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {loggedIn ? (
        <ChatConversation ref={inputRef} chat={chat} productName={productName} rateLimitedUntil={rateLimitedUntil} />
      ) : (
        <LoggedOutBody onClose={onClose} />
      )}
    </div>
  );
}
