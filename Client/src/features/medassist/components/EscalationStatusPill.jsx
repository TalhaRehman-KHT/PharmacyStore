const STATUS = {
  pending: { label: "Pending", bg: "rgba(255,195,39,0.15)", text: "#b45309" },
  answered: { label: "Answered", bg: "rgba(0,143,11,0.12)", text: "#008F0B" },
};

/** @param {{ status?: 'pending' | 'answered', size?: 'sm' | 'md' }} props */
export default function EscalationStatusPill({ status = "pending", size = "md" }) {
  const s = STATUS[status] || STATUS.pending;
  return (
    <span
      className={`font-bold rounded-lg whitespace-nowrap ${
        size === "sm" ? "text-[11px] px-2 py-0.5" : "text-xs px-2.5 py-1"
      }`}
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  );
}
