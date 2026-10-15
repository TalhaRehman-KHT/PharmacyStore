import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { UserRound } from "lucide-react";
import CitationList from "./CitationList.jsx";
import ProductMiniCard from "./ProductMiniCard.jsx";
import EscalationBanner from "./EscalationBanner.jsx";
import EmergencyBanner from "./EmergencyBanner.jsx";
import FeedbackButtons from "./FeedbackButtons.jsx";
import Disclaimer from "./Disclaimer.jsx";
import { citationDomId, productKey } from "../utils.js";

const CITE_HREF = "#medassist-cite-";

/**
 * Turn bare markers like [1] into links the `a` renderer below shows as superscript buttons.
 * "[1][2]" must become two links; skipping a "[" after the marker made markdown read it as a reference link.
 */
function linkCitations(text) {
  return text.replace(/\[(\d{1,2})\](?![(:])/g, `[$1](${CITE_HREF}$1)`);
}

function scrollToCitation(messageId, n) {
  const el = document.getElementById(citationDomId(messageId, n));
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  el.focus({ preventScroll: true });
}

/**
 * @param {{ message: import("../types.js").ChatMessage, streaming?: boolean,
 *   onRate: (id: string, rating: 1 | -1) => void, onAdd: Function, addingId?: string | null,
 *   onAskPharmacist: (message: import("../types.js").ChatMessage) => void }} props
 */
export default function AssistantMessage({ message, streaming, onRate, onAdd, addingId, onAskPharmacist }) {
  const { meta, citations } = message;
  const route = meta?.route;
  const citationNumbers = useMemo(() => new Set((citations || []).map((c) => c.n)), [citations]);

  const components = useMemo(
    () => ({
      a({ href = "", children }) {
        if (href.startsWith(CITE_HREF)) {
          const n = Number(href.slice(CITE_HREF.length));
          // Citations arrive after the text; until then show a plain marker.
          if (!citationNumbers.has(n)) return <sup className="text-text-secondary">[{n}]</sup>;
          return (
            <sup>
              <button
                type="button"
                onClick={() => scrollToCitation(message.id, n)}
                aria-label={`Source ${n}`}
                className="mx-0.5 px-1 rounded-md bg-primary-green/10 text-primary-green text-[10px] font-bold hover:bg-primary-green/20"
              >
                {n}
              </button>
            </sup>
          );
        }
        return (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary-green underline">
            {children}
          </a>
        );
      },
      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
      ul: ({ children }) => <ul className="mb-2 last:mb-0 list-disc pl-5 space-y-1">{children}</ul>,
      ol: ({ children }) => <ol className="mb-2 last:mb-0 list-decimal pl-5 space-y-1">{children}</ol>,
      strong: ({ children }) => <strong className="font-bold text-text-primary">{children}</strong>,
      code: ({ children }) => <code className="px-1 rounded bg-gray-100 text-xs">{children}</code>,
      table: ({ children }) => (
        <div className="mb-2 overflow-x-auto">
          <table className="w-full text-xs border border-border">{children}</table>
        </div>
      ),
      th: ({ children }) => <th className="px-2 py-1 bg-gray-50 text-left font-semibold border-b border-border">{children}</th>,
      td: ({ children }) => <td className="px-2 py-1 border-b border-border">{children}</td>,
    }),
    [citationNumbers, message.id]
  );

  if (route === "emergency") return <EmergencyBanner />;

  const done = Boolean(meta) && !streaming;

  return (
    <div className="max-w-[92%]">
      {meta?.escalated && <EscalationBanner status={meta.escalationStatus} />}

      <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-white border border-gray-100 shadow-[0_4px_10px_var(--color-card-shadow)] text-sm text-text-primary wrap-break-word">
        <span className="sr-only">MedAssist: </span>
        <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={components}>
          {linkCitations(message.content)}
        </ReactMarkdown>
        {streaming && <span className="inline-block w-1.5 h-4 ml-0.5 align-text-bottom bg-primary-green animate-pulse" />}

        {route === "no_evidence" && done && (
          <button
            type="button"
            onClick={() => onAskPharmacist(message)}
            className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-primary-green text-primary-green text-xs font-semibold hover:bg-primary-green/10 transition-colors"
          >
            <UserRound className="w-4 h-4" />
            Ask a pharmacist
          </button>
        )}

        <CitationList messageId={message.id} citations={citations} />
      </div>

      {meta?.products?.length > 0 && (
        <div className="mt-2 space-y-2">
          {meta.products.map((p) => (
            <ProductMiniCard key={productKey(p)} product={p} onAdd={onAdd} addingId={addingId} />
          ))}
        </div>
      )}

      {/* An escalated message is not an FDA-label answer, so no label footer and nothing to rate. */}
      {!meta?.escalated && (
        <div className="mt-1 flex items-start justify-between gap-2">
          <Disclaimer />
          {done && <FeedbackButtons value={message.feedback} onRate={(rating) => onRate(message.id, rating)} />}
        </div>
      )}
    </div>
  );
}
