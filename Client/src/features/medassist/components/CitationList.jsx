import { ExternalLink } from "lucide-react";
import { citationDomId } from "../utils.js";

/** @param {{ messageId: string, citations: import("../types.js").Citation[] }} props */
export default function CitationList({ messageId, citations }) {
  if (!citations?.length) return null;
  return (
    <ul className="mt-3 space-y-1.5" aria-label="Sources">
      {citations.map((c) => (
        <li key={c.n}>
          <a
            id={citationDomId(messageId, c.n)}
            href={c.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-2.5 py-2 rounded-xl border border-border bg-background text-xs text-text-secondary hover:border-primary-green/50 hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-green/30 transition-colors scroll-mt-4"
          >
            <span className="w-5 h-5 rounded-md bg-primary-green/10 text-primary-green font-bold flex items-center justify-center shrink-0">
              {c.n}
            </span>
            <span className="flex-1 min-w-0 truncate">
              <span className="font-semibold text-text-primary capitalize">{c.drug}</span> · {c.section} · FDA label
            </span>
            <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
  );
}
