import { useEffect, useLayoutEffect, useRef } from "react";
import { AlertTriangle, Clock, RefreshCw } from "lucide-react";
import UserMessage from "./UserMessage.jsx";
import AssistantMessage from "./AssistantMessage.jsx";
import PharmacistMessage from "./PharmacistMessage.jsx";
import { retryMinutes } from "../utils.js";

const STICK_THRESHOLD_PX = 80;

function SearchingIndicator() {
  return (
    <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-white border border-gray-100 w-fit">
      <span className="flex gap-1" aria-hidden="true">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="w-1.5 h-1.5 rounded-full bg-primary-green animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
      <span className="text-xs text-text-secondary">Searching drug labels…</span>
    </div>
  );
}

function ErrorNotice({ error, rateLimitedUntil, onRetry }) {
  if (error.status === 429) {
    const secLeft = rateLimitedUntil ? (rateLimitedUntil - Date.now()) / 1000 : error.retryAfterSec;
    return (
      <div role="alert" className="rounded-xl border border-warning/50 bg-warning/10 p-3 flex items-start gap-2">
        <Clock className="w-4 h-4 mt-0.5 shrink-0 text-amber-700" />
        <div className="text-xs text-amber-800">
          <p className="font-semibold">You've asked a lot of questions</p>
          <p className="mt-0.5">Please try again in {retryMinutes(secLeft)} minutes.</p>
        </div>
      </div>
    );
  }
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
        <div className="flex-1 min-w-0 text-xs text-red-700">
          <p className="font-semibold">Couldn't get an answer</p>
          <p className="mt-0.5">{error.message}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-primary-green text-primary-green text-xs font-semibold bg-white hover:bg-primary-green/10 transition-colors"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Retry
      </button>
    </div>
  );
}

/**
 * Scrollable message list. Follows the bottom while streaming unless the user scrolled up.
 * @param {{ messages: import("../types.js").ChatMessage[], status: string, error: any,
 *   rateLimitedUntil: number, onRetry: () => void, onRate: Function, onAdd: Function,
 *   addingId?: string | null, onAskPharmacist: Function, emptyState?: React.ReactNode }} props
 */
export default function MessageList({
  messages,
  status,
  error,
  rateLimitedUntil,
  onRetry,
  onRate,
  onAdd,
  addingId,
  onAskPharmacist,
  emptyState,
  contentClassName = "",
}) {
  const scrollRef = useRef(null);
  const stickRef = useRef(true);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD_PX;
  };

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, status, error]);

  // A newly sent question always scrolls back down.
  const lastUserId = [...messages].reverse().find((m) => m.role === "user")?.id;
  useEffect(() => {
    stickRef.current = true;
  }, [lastUserId]);

  const busy = status === "loading" || status === "streaming";
  const lastId = messages[messages.length - 1]?.id;

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-background px-3 py-4"
    >
      <div
        aria-live="polite"
        aria-busy={busy}
        aria-relevant="additions text"
        className={`space-y-3 ${contentClassName}`}
      >
        {messages.length === 0 && !busy && !error && emptyState}

        {messages.map((m) => {
          if (m.role === "user") {
            // The error card already explains the latest failed question.
            const showNote = !(status === "error" && m.id === lastUserId);
            return <UserMessage key={m.id} message={m} showNote={showNote} />;
          }
          if (m.role === "pharmacist") return <PharmacistMessage key={m.id} message={m} />;
          if (!m.content && !m.meta) return <SearchingIndicator key={m.id} />;
          return (
            <AssistantMessage
              key={m.id}
              message={m}
              streaming={status === "streaming" && m.id === lastId}
              onRate={onRate}
              onAdd={onAdd}
              addingId={addingId}
              onAskPharmacist={onAskPharmacist}
            />
          );
        })}

        {/* Loading with no messages only happens while a past session loads. */}
        {status === "loading" && messages.length === 0 && (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-2 border-primary-green border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {status === "error" && error && (
          <ErrorNotice error={error} rateLimitedUntil={rateLimitedUntil} onRetry={onRetry} />
        )}
      </div>
    </div>
  );
}
