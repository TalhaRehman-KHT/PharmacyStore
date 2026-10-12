import { UserRound } from "lucide-react";
import EscalationStatusPill from "./EscalationStatusPill.jsx";

/** @param {{ status?: 'pending' | 'answered' }} props */
export default function EscalationBanner({ status = "pending" }) {
  return (
    <div className="mb-2 rounded-xl border border-warning/50 bg-warning/10 p-3">
      <div className="flex items-start gap-2">
        <UserRound className="w-4 h-4 mt-0.5 shrink-0 text-amber-700" />
        <p className="flex-1 min-w-0 text-xs font-medium text-amber-800">
          A pharmacist will review this question. You will see the reply here.
        </p>
        <EscalationStatusPill status={status} size="sm" />
      </div>
    </div>
  );
}
