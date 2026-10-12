import { forwardRef } from "react";
import toast from "react-hot-toast";
import { MessageSquareDashed } from "lucide-react";
import MessageList from "./MessageList.jsx";
import ChatInput from "./ChatInput.jsx";
import SuggestionChips from "./SuggestionChips.jsx";
import { useAddProductToCart } from "../hooks/useAddProductToCart.js";
import { retryMinutes } from "../utils.js";

/**
 * Message list + suggestion chips + input, wired to a useMedAssistChat() result.
 * Shared by the floating ChatPanel and the /user/assistant page.
 * @param {{ chat: object, productName?: string | null, rateLimitedUntil: number, contentClassName?: string }} props
 */
const ChatConversation = forwardRef(function ChatConversation(
  { chat, productName, rateLimitedUntil, contentClassName = "" },
  inputRef
) {
  const { messages, sessionId, status, error, isBusy, send, stop, retry, loadSession, rate } = chat;
  const { add, addingId } = useAddProductToCart();
  const rateLimited = rateLimitedUntil > Date.now();

  // No escalate endpoint in the client contract yet; keep the button honest.
  const handleAskPharmacist = () => {
    toast("Pharmacist hand-off is not connected yet. Please call or visit the pharmacy.", { icon: "ℹ️" });
  };

  // A failed session load has no question to resend; reload the session instead.
  const handleRetry = () => {
    if (messages.length === 0 && sessionId) loadSession(sessionId);
    else retry();
  };

  const chips = <SuggestionChips productName={productName || undefined} onPick={send} disabled={rateLimited} />;
  const emptyState = sessionId ? (
    <div className="flex flex-col items-center text-center pt-6">
      <MessageSquareDashed className="w-10 h-10 text-text-secondary opacity-40" />
      <p className="mt-2 text-sm font-medium text-text-secondary">This chat has no messages yet</p>
      {chips}
    </div>
  ) : (
    chips
  );

  return (
    <>
      <MessageList
        messages={messages}
        status={status}
        error={error}
        rateLimitedUntil={rateLimitedUntil}
        onRetry={handleRetry}
        onRate={rate}
        onAdd={add}
        addingId={addingId}
        onAskPharmacist={handleAskPharmacist}
        emptyState={emptyState}
        contentClassName={contentClassName}
      />
      <ChatInput
        ref={inputRef}
        onSend={send}
        onStop={stop}
        busy={isBusy}
        disabled={rateLimited}
        contentClassName={contentClassName}
        placeholder={
          rateLimited ? `Try again in ${retryMinutes((rateLimitedUntil - Date.now()) / 1000)} minutes` : undefined
        }
      />
    </>
  );
});

export default ChatConversation;
