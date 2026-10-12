const REASONS = {
  personal_dosing: { label: "Dosing", bg: "rgba(40,89,197,0.12)", text: "#1d4ed8" },
  prescription_only: { label: "Prescription-only", bg: "rgba(96,91,255,0.12)", text: "#4B49CC" },
  pregnancy_or_child: { label: "Pregnancy or child", bg: "rgba(255,143,107,0.15)", text: "#c2410c" },
  no_evidence: { label: "No evidence", bg: "rgba(107,114,128,0.12)", text: "#4b5563" },
};

/** @param {{ reason: import("../types.js").EscalationReason }} props */
export default function ReasonPill({ reason }) {
  const r = REASONS[reason] || REASONS.no_evidence;
  return (
    <span
      className="text-xs font-bold px-2.5 py-1 rounded-lg whitespace-nowrap"
      style={{ backgroundColor: r.bg, color: r.text }}
    >
      {r.label}
    </span>
  );
}
