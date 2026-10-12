import { forwardRef } from "react";
import { MessageCircle } from "lucide-react";

/** Round floating button; shows the label from `sm` up. */
const ChatLauncher = forwardRef(function ChatLauncher({ onClick }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label="Ask MedAssist"
      aria-haspopup="dialog"
      className="fixed z-[60] right-4 sm:right-6 bottom-[max(1rem,env(safe-area-inset-bottom))] sm:bottom-6 flex items-center gap-2 h-14 w-14 sm:w-auto sm:px-5 justify-center rounded-full text-white font-semibold shadow-lg shadow-primary-green/25 hover:opacity-95 transition-opacity focus:outline-none focus:ring-4 focus:ring-primary-green/30"
      style={{ background: "linear-gradient(135deg, #008F0B, #007009)" }}
    >
      <MessageCircle className="w-6 h-6 shrink-0" aria-hidden="true" />
      <span className="hidden sm:inline text-sm">Ask MedAssist</span>
    </button>
  );
});

export default ChatLauncher;
