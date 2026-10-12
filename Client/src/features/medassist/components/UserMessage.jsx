/** @param {{ message: import("../types.js").ChatMessage }} props */
export default function UserMessage({ message }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-br-md bg-primary-green text-white text-sm whitespace-pre-wrap break-words">
        <span className="sr-only">You: </span>
        {message.content}
      </div>
    </div>
  );
}
