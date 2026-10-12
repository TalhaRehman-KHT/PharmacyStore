import { Phone, Siren } from "lucide-react";

/** Fixed emergency message. Never renders AI text. */
export default function EmergencyBanner() {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
          <Siren className="w-5 h-5 text-red-600" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-red-700">This may be a medical emergency</p>
          <p className="mt-1 text-sm text-red-700">
            Call 1122 (Rescue) or go to the nearest emergency department now. Do not wait for an online reply.
          </p>
          <a
            href="tel:1122"
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            <Phone className="w-4 h-4" />
            Call 1122
          </a>
        </div>
      </div>
    </div>
  );
}
