import { ChevronDown, ExternalLink } from "lucide-react";
import { citationDomId } from "../utils.js";

/**
 * Collapsed "Sources (n)" list under an answer. Rows: "1 · Drug · Section · DailyMed".
 * The parent owns open / highlighted so a citation chip can open the list and mark its row.
 * @param {{ messageId: string, citations: import("../types.js").Citation[], open: boolean,
 *   onToggle: () => void, highlighted?: number | null }} props
 */
export default function CitationList({ messageId, citations, open, onToggle, highlighted }) {
  if (!citations?.length) return null;
  const listId = `medassist-sources-${messageId}`;
  return (
    <div className="mt-3 pt-2 border-t border-border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={listId}
        className="inline-flex items-center gap-1 px-1.5 py-1 -ml-1.5 rounded-lg text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-gray-100 transition-colors"
      >
        Sources ({citations.length})
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <ol id={listId} className="mt-1.5 space-y-1.5" aria-label="Sources">
          {citations.map((c) => (
            <li
              key={c.n}
              id={citationDomId(messageId, c.n)}
              tabIndex={-1}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border text-xs text-text-secondary scroll-mt-4 focus:outline-none transition-colors ${
                highlighted === c.n
                  ? "border-primary-green bg-accent-green ring-2 ring-primary-green/20"
                  : "border-border bg-background"
              }`}
            >
              <span className="w-5 h-5 rounded-md bg-primary-green/10 text-primary-green font-bold flex items-center justify-center shrink-0">
                {c.n}
              </span>
              <span className="flex-1 min-w-0 truncate">
                <span className="font-semibold text-text-primary capitalize">{c.drug}</span>
                <span aria-hidden="true"> · </span>
                <span className="sr-only">, </span>
                {c.section}
              </span>
              <a
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open the ${c.drug} label on DailyMed (opens in a new tab)`}
                className="inline-flex items-center gap-1 px-1.5 py-1 rounded-lg font-semibold text-primary-green hover:bg-primary-green/10 shrink-0 focus:outline-none focus:ring-2 focus:ring-primary-green/30"
              >
                DailyMed
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
