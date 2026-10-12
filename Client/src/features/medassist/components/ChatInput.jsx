import { forwardRef, useState } from "react";
import { SendHorizontal, Square } from "lucide-react";

export const MAX_QUESTION_LENGTH = 500;

/**
 * Enter sends, Shift+Enter adds a line. Shows Stop instead of Send while an answer is in flight.
 * @param {{ onSend: (q: string) => void, onStop: () => void, busy: boolean, disabled?: boolean,
 *   placeholder?: string }} props
 */
const ChatInput = forwardRef(function ChatInput(
  { onSend, onStop, busy, disabled = false, placeholder, contentClassName = "" },
  ref
) {
  const [value, setValue] = useState("");
  const canSend = !busy && !disabled && value.trim().length > 0;

  function submit() {
    if (!canSend) return;
    onSend(value.trim());
    setValue("");
  }

  return (
    <form
      className="border-t border-border bg-white px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className={contentClassName}>
      <div className="flex items-end gap-2">
        <label htmlFor="medassist-input" className="sr-only">
          Ask MedAssist a question
        </label>
        <textarea
          id="medassist-input"
          ref={ref}
          rows={1}
          value={value}
          maxLength={MAX_QUESTION_LENGTH}
          disabled={disabled}
          placeholder={placeholder || "Ask about a medicine…"}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          className="flex-1 min-w-0 max-h-32 field-sizing-content resize-none px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-green/20 focus:border-primary-green transition-all disabled:bg-gray-50 disabled:text-text-secondary"
        />
        {busy ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop answer"
            className="w-10 h-10 rounded-xl border border-gray-200 text-text-primary flex items-center justify-center hover:bg-gray-100 transition-colors shrink-0"
          >
            <Square className="w-4 h-4 fill-current" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send question"
            className="w-10 h-10 rounded-xl bg-primary-green text-white flex items-center justify-center hover:bg-dark-green transition-colors disabled:opacity-50 shrink-0"
          >
            <SendHorizontal className="w-5 h-5" />
          </button>
        )}
      </div>
      <p
        className={`mt-1 text-right text-[11px] ${
          value.length >= MAX_QUESTION_LENGTH ? "text-red-500" : "text-text-secondary"
        }`}
      >
        {value.length}/{MAX_QUESTION_LENGTH}
      </p>
      </div>
    </form>
  );
});

export default ChatInput;
