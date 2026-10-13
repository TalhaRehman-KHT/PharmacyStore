const NOTES = {
  failed: "Not answered",
  stopped: "Stopped",
};

/** @param {{ message: import("../types.js").ChatMessage & { note?: 'failed' | 'stopped' }, showNote?: boolean }} props */
export default function UserMessage({ message, showNote = true }) {
  const note = showNote ? NOTES[message.note] : null;
  return (
    <div className="flex flex-col items-end">
      <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-br-md bg-primary-green text-white text-sm whitespace-pre-wrap break-words">
        <span className="sr-only">You: </span>
        {message.content}
      </div>
      {note && <p className="mt-1 text-[11px] text-text-secondary">{note}</p>}
    </div>
  );
}
