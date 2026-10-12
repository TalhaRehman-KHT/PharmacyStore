import { BadgeCheck } from "lucide-react";

/** @param {{ message: import("../types.js").ChatMessage }} props */
export default function PharmacistMessage({ message }) {
  return (
    <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-primary-blue/20 border-l-4 border-l-primary-blue bg-primary-blue/5 px-3.5 py-2.5">
      <p className="flex items-center gap-1.5 text-xs font-bold text-primary-blue">
        <BadgeCheck className="w-4 h-4" aria-hidden="true" />
        Pharmacist
      </p>
      <p className="mt-1 text-sm text-text-primary whitespace-pre-wrap break-words">{message.content}</p>
    </div>
  );
}
