import { USE_MEDASSIST_MOCK } from "../api/index.js";

/** Dev-only "MOCK DATA" tag, shown while VITE_MEDASSIST_USE_MOCK=true. Renders nothing otherwise. */
export default function MockBadge() {
  if (!import.meta.env.DEV || !USE_MEDASSIST_MOCK) return null;
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-lg bg-primary-orange text-white text-[11px] font-bold tracking-wide"
      title="VITE_MEDASSIST_USE_MOCK=true: fixture data, not the MedAssist API"
    >
      MOCK DATA
    </span>
  );
}
