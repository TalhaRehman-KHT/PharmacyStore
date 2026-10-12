import { ChevronRight } from "lucide-react";
import ReasonPill from "./ReasonPill.jsx";
import EscalationStatusPill from "./EscalationStatusPill.jsx";
import { formatDateTime, formatRelative } from "../utils.js";

/**
 * Escalations as a table (md and up) or stacked cards (mobile). Rows open the drawer.
 * @param {{ escalations: import("../types.js").Escalation[], onOpen: (e: import("../types.js").Escalation) => void }} props
 */
export default function EscalationList({ escalations, onOpen }) {
  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-100 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3 w-36">Time</th>
              <th className="px-4 py-3 w-32">Customer</th>
              <th className="px-4 py-3">Question</th>
              <th className="px-4 py-3 w-44">Reason</th>
              <th className="px-4 py-3 w-28">Status</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {escalations.map((e) => (
              <tr
                key={e.id}
                onClick={() => onOpen(e)}
                className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors cursor-pointer"
              >
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap" title={formatDateTime(e.createdAt)}>
                  {formatRelative(e.createdAt)}
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">{e.customerFirstName}</td>
                <td className="px-4 py-3 text-gray-800 max-w-0">
                  {/* The button gives keyboard users a way to open the row. */}
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onOpen(e);
                    }}
                    className="block w-full text-left truncate hover:text-primary-green focus:outline-none focus-visible:text-primary-green focus-visible:underline"
                  >
                    {e.question}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <ReasonPill reason={e.reason} />
                </td>
                <td className="px-4 py-3">
                  <EscalationStatusPill status={e.status} />
                </td>
                <td className="px-4 py-3 text-gray-400">
                  <ChevronRight className="w-4 h-4" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="md:hidden divide-y divide-gray-100">
        {escalations.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => onOpen(e)}
              className="w-full text-left p-4 hover:bg-gray-50/50 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-gray-900 truncate">{e.customerFirstName}</span>
                <span className="text-xs text-gray-500 whitespace-nowrap">{formatRelative(e.createdAt)}</span>
              </div>
              <p className="mt-1 text-sm text-gray-700 line-clamp-2">{e.question}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <ReasonPill reason={e.reason} />
                <EscalationStatusPill status={e.status} />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
