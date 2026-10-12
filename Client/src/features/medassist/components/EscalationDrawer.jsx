import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { BadgeCheck, SendHorizontal, X } from "lucide-react";
import CitationList from "./CitationList.jsx";
import ReasonPill from "./ReasonPill.jsx";
import EscalationStatusPill from "./EscalationStatusPill.jsx";
import { formatDateTime, formatRelative } from "../utils.js";

export const MIN_REPLY_LENGTH = 10;
const MAX_REPLY_LENGTH = 2000;

/**
 * Right-side drawer (full screen on mobile) for one escalation.
 * Pending: reply form. Answered: read-only reply.
 * Render with key={escalation.id} so the draft resets per escalation.
 * @param {{ escalation: import("../types.js").Escalation | null, onClose: () => void,
 *   onReply: (id: string, text: string) => Promise<void>, replying: boolean }} props
 */
export default function EscalationDrawer({ escalation, onClose, onReply, replying }) {
  const [reply, setReply] = useState("");
  const closeRef = useRef(null);
  const textareaRef = useRef(null);
  const open = Boolean(escalation);
  const pending = escalation?.status === "pending";
  const tooShort = reply.trim().length < MIN_REPLY_LENGTH;

  useEffect(() => {
    if (!open) return undefined;
    (pending ? textareaRef.current : closeRef.current)?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, pending, escalation?.id, onClose]);

  if (!escalation) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (tooShort || replying) return;
    try {
      await onReply(escalation.id, reply.trim());
      toast.success(`Reply sent to ${escalation.customerFirstName}`);
      onClose();
    } catch (err) {
      toast.error(err?.message || "Failed to send reply");
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={replying ? undefined : onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="escalation-drawer-title"
        className="fixed inset-y-0 right-0 z-50 w-full md:w-[480px] bg-white shadow-2xl flex flex-col"
      >
        <div className="shrink-0 flex items-start justify-between gap-3 px-6 py-4 border-b border-gray-100 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="min-w-0">
            <h3 id="escalation-drawer-title" className="text-lg font-bold text-gray-900 truncate">
              {escalation.customerFirstName}'s question
            </h3>
            <p className="mt-0.5 text-xs text-text-secondary" title={formatDateTime(escalation.createdAt)}>
              Asked {formatRelative(escalation.createdAt)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <ReasonPill reason={escalation.reason} />
              <EscalationStatusPill status={escalation.status} />
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            disabled={replying}
            className="p-2 rounded-lg hover:bg-gray-100 shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Question</h4>
            <p className="mt-2 text-sm text-gray-900 whitespace-pre-wrap break-words">{escalation.question}</p>
          </section>

          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">What the AI retrieved</h4>
            {escalation.sources?.length ? (
              <CitationList messageId={`esc-${escalation.id}`} citations={escalation.sources} />
            ) : (
              <p className="mt-2 text-sm text-text-secondary">No sources were found for this question.</p>
            )}
          </section>

          {!pending && (
            <section>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your reply</h4>
              <div className="mt-2 rounded-xl border border-primary-blue/20 border-l-4 border-l-primary-blue bg-primary-blue/5 p-3">
                <p className="text-sm text-text-primary whitespace-pre-wrap break-words">{escalation.reply}</p>
              </div>
              {escalation.answeredAt && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-text-secondary">
                  <BadgeCheck className="w-4 h-4 text-primary-green" />
                  Answered {formatDateTime(escalation.answeredAt)}
                </p>
              )}
            </section>
          )}
        </div>

        {pending && (
          <form
            onSubmit={submit}
            className="shrink-0 border-t border-gray-100 bg-gray-50/50 px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <label htmlFor="escalation-reply" className="text-sm font-semibold text-gray-900">
              Reply to {escalation.customerFirstName}
            </label>
            <textarea
              id="escalation-reply"
              ref={textareaRef}
              rows={4}
              value={reply}
              maxLength={MAX_REPLY_LENGTH}
              disabled={replying}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Write a clear, safe answer. The customer sees it in their chat."
              className="mt-2 w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:border-primary-green focus:ring-2 focus:ring-primary-green/20 outline-none transition-all resize-none disabled:bg-gray-50"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className={`text-xs ${tooShort && reply.length > 0 ? "text-red-500" : "text-text-secondary"}`}>
                {tooShort ? `At least ${MIN_REPLY_LENGTH} characters` : `${reply.trim().length} characters`}
              </p>
              <button
                type="submit"
                disabled={tooShort || replying}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-green text-white rounded-xl font-medium text-sm hover:bg-dark-green transition-colors disabled:opacity-60"
              >
                {replying ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <SendHorizontal className="w-4 h-4" />
                )}
                {replying ? "Sending…" : "Send reply"}
              </button>
            </div>
          </form>
        )}
      </aside>
    </>
  );
}
