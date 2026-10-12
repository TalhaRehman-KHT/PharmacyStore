import { Pill, ThumbsDown } from "lucide-react";

/**
 * @param {{ topMedicines: { drug: string, count: number }[], unhelpfulCount: number | null,
 *   loading: boolean, error: any }} props
 */
export default function EscalationInsightsCard({ topMedicines, unhelpfulCount, loading, error }) {
  const max = Math.max(1, ...topMedicines.map((m) => m.count));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
      <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#008F0B18" }}>
            <Pill className="w-5 h-5" style={{ color: "#008F0B" }} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Most asked medicines this week</p>
            <p className="text-xs text-gray-500">From escalated questions</p>
          </div>
        </div>
        {loading && topMedicines.length === 0 ? (
          <div className="space-y-2" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-5 rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-gray-500">Couldn't load insights.</p>
        ) : topMedicines.length === 0 ? (
          <p className="text-sm text-gray-500">No escalated questions this week.</p>
        ) : (
          <ol className="space-y-2">
            {topMedicines.map((m) => (
              <li key={m.drug} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 font-medium text-gray-900 capitalize truncate">{m.drug}</span>
                <span className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <span
                    className="block h-full rounded-full bg-primary-green"
                    style={{ width: `${(m.count / max) * 100}%` }}
                  />
                </span>
                <span className="w-6 text-right text-xs font-semibold text-gray-500">{m.count}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#FF8F6B18" }}>
          <ThumbsDown className="w-5 h-5" style={{ color: "#FF8F6B" }} />
        </div>
        <div>
          <p className="text-xl font-bold text-gray-900">{error || unhelpfulCount == null ? "—" : unhelpfulCount}</p>
          <p className="text-xs text-gray-500 font-medium">Answers marked unhelpful (7 days)</p>
        </div>
      </div>
    </div>
  );
}
