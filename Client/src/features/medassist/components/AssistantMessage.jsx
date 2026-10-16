import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import toast from "react-hot-toast";
import { Check, Copy, Info, UserRound } from "lucide-react";
import CitationList from "./CitationList.jsx";
import ProductMiniCard from "./ProductMiniCard.jsx";
import EscalationBanner from "./EscalationBanner.jsx";
import EmergencyBanner from "./EmergencyBanner.jsx";
import FeedbackButtons from "./FeedbackButtons.jsx";
import Disclaimer from "./Disclaimer.jsx";
import { citationDomId, formatDateTime, formatRelative, productKey } from "../utils.js";

const CITE_HREF = "#medassist-cite-";
const CARET_HREF = "#medassist-caret";
const HIGHLIGHT_MS = 2000;

/**
 * Turn citation markers into links the `a` renderer below shows as chips.
 * - "[1]" -> one chip, "[1][2]" and "[1, 2]" -> two chips.
 * - Only 1-2 digit numbers inside brackets count, so "500 mg", "2 mg/kg" or "[500 mg]" stay text.
 * - A marker followed by "(" or ":" is a real markdown link / reference, left alone.
 */
function linkCitations(text) {
  return text.replace(/\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\](?![(:])/g, (_, list) =>
    list
      .split(",")
      .map((n) => `[${n.trim()}](${CITE_HREF}${n.trim()})`)
      .join("")
  );
}

const LIST_LINE = /^([-*+]|\d+[.)])\s/;
const NOTE_LINE = /^\**note:/i;
const FDA_ROUTES = new Set(["knowledge", "both"]);

/**
 * The model writes "- bullet", then "Note: ..." and the disclaimer on the very next lines. Markdown would glue
 * those lines onto the last bullet (lazy continuation), so put a blank line before a plain line that follows a
 * bullet or a Note, and before a Note. Indented lines are real continuations and are left alone.
 */
function separateBlocks(text) {
  const lines = text.split("\n");
  return lines
    .map((line, i) => {
      const prev = lines[i - 1];
      if (!prev?.trim() || !line.trim() || /^\s/.test(line) || LIST_LINE.test(line)) return line;
      const split = LIST_LINE.test(prev) || NOTE_LINE.test(prev) || NOTE_LINE.test(line);
      return split ? `\n${line}` : line;
    })
    .join("\n");
}

/** The leading text of a markdown node's children, e.g. "Note: ..." of a paragraph (also "**Note:**"). */
function leadingText(children) {
  const first = Array.isArray(children) ? children[0] : children;
  if (typeof first === "string") return first;
  return first?.props ? leadingText(first.props.children) : "";
}

/** "2 minutes ago", refreshed every minute. The full date is in the tooltip. */
function RelativeTime({ iso }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  if (!iso) return null;
  return (
    <time dateTime={iso} title={formatDateTime(iso)} className="text-[11px] text-text-secondary whitespace-nowrap">
      {formatRelative(iso, now)}
    </time>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy the answer");
    }
  };
  const Icon = copied ? Check : Copy;
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Answer copied" : "Copy answer"}
      title="Copy answer"
      className={`p-1.5 rounded-lg transition-colors ${
        copied ? "text-primary-green" : "text-text-secondary hover:bg-gray-100 hover:text-text-primary"
      }`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

/** Answer text plus its sources, for the clipboard. */
function copyText(content, citations) {
  if (!citations?.length) return content;
  const lines = citations.map((c) => `[${c.n}] ${c.drug}, ${c.section}: ${c.url}`);
  return `${content.trim()}\n\nSources:\n${lines.join("\n")}`;
}

/**
 * @param {{ message: import("../types.js").ChatMessage, streaming?: boolean,
 *   onRate: (id: string, rating: 1 | -1) => void, onAdd: Function, addingId?: string | null,
 *   onAskPharmacist: (message: import("../types.js").ChatMessage) => void }} props
 */
export default function AssistantMessage({ message, streaming, onRate, onAdd, addingId, onAskPharmacist }) {
  const { meta, citations } = message;
  const route = meta?.route;
  const done = Boolean(meta) && !streaming;
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(null);

  const citationByN = useMemo(() => new Map((citations || []).map((c) => [c.n, c])), [citations]);

  // A chip opens the list, marks its row for a moment, and scrolls to it.
  useEffect(() => {
    if (highlighted == null) return;
    const el = document.getElementById(citationDomId(message.id, highlighted));
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    el?.focus({ preventScroll: true });
    const id = setTimeout(() => setHighlighted(null), HIGHLIGHT_MS);
    return () => clearTimeout(id);
  }, [highlighted, message.id]);

  const components = useMemo(
    () => ({
      a({ href = "", children }) {
        if (href === CARET_HREF) {
          return (
            <span
              aria-hidden="true"
              className="inline-block w-1.5 h-4 ml-0.5 -mb-0.5 rounded-sm bg-primary-green animate-pulse"
            />
          );
        }
        if (href.startsWith(CITE_HREF)) {
          const n = Number(href.slice(CITE_HREF.length));
          const c = citationByN.get(n);
          if (!c) {
            // Citations arrive after the text: muted marker while streaming, plain text if it never gets a source.
            return done ? `[${n}]` : <sup className="text-[10px] text-text-secondary">[{n}]</sup>;
          }
          return (
            <sup className="leading-none">
              <button
                type="button"
                onClick={() => {
                  setSourcesOpen(true);
                  setHighlighted(n);
                }}
                aria-label={`Source ${n}: ${c.drug}, ${c.section}`}
                title={`${c.drug} · ${c.section}`}
                className="ml-0.5 min-w-4 px-1 py-px rounded-md bg-primary-green/10 text-primary-green text-[10px] font-bold hover:bg-primary-green/20 focus:outline-none focus:ring-2 focus:ring-primary-green/30 transition-colors"
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
      p({ children }) {
        // The answer format ends with an optional "Note:" warning line; show it as a small callout.
        if (/^\s*note:/i.test(leadingText(children))) {
          return (
            <p className="my-2.5 last:mb-0 flex gap-2 rounded-xl border border-warning/50 bg-warning/10 px-3 py-2 text-[13px] text-amber-900">
              <Info className="w-4 h-4 mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
              <span className="min-w-0">{children}</span>
            </p>
          );
        }
        return <p className="mb-2.5 last:mb-0 leading-relaxed">{children}</p>;
      },
      ul: ({ children }) => (
        <ul className="mb-2.5 last:mb-0 list-disc pl-5 space-y-1.5 marker:text-primary-green">{children}</ul>
      ),
      ol: ({ children }) => (
        <ol className="mb-2.5 last:mb-0 list-decimal pl-5 space-y-1.5 marker:text-text-secondary">{children}</ol>
      ),
      li: ({ children }) => <li className="pl-0.5 leading-relaxed">{children}</li>,
      strong: ({ children }) => <strong className="font-semibold text-text-primary">{children}</strong>,
      code: ({ children }) => <code className="px-1 rounded bg-gray-100 text-xs">{children}</code>,
      table: ({ children }) => (
        <div className="mb-2 overflow-x-auto">
          <table className="w-full text-xs border border-border">{children}</table>
        </div>
      ),
      th: ({ children }) => <th className="px-2 py-1 bg-gray-50 text-left font-semibold border-b border-border">{children}</th>,
      td: ({ children }) => <td className="px-2 py-1 border-b border-border">{children}</td>,
    }),
    [citationByN, done]
  );

  if (route === "emergency") return <EmergencyBanner />;

  // While streaming, a caret link at the end renders inline after the last word (even inside a list item).
  const markdown = linkCitations(separateBlocks(message.content)) + (streaming ? ` [](${CARET_HREF})` : "");

  return (
    <div className="max-w-[92%] min-w-0">
      {meta?.escalated && <EscalationBanner status={meta.escalationStatus} />}

      <div className="px-3.5 py-3 rounded-2xl rounded-bl-md bg-white border border-gray-100 shadow-[0_4px_10px_var(--color-card-shadow)] text-sm text-text-primary wrap-break-word">
        <span className="sr-only">MedAssist: </span>
        <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={components}>
          {markdown}
        </ReactMarkdown>

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

        <CitationList
          messageId={message.id}
          citations={citations}
          open={sourcesOpen}
          onToggle={() => setSourcesOpen((o) => !o)}
          highlighted={highlighted}
        />
      </div>

      {meta?.products?.length > 0 && (
        <div className="mt-2 space-y-2">
          {meta.products.map((p) => (
            <ProductMiniCard key={productKey(p)} product={p} onAdd={onAdd} addingId={addingId} />
          ))}
        </div>
      )}

      {/* Only label-based answers get the FDA footer: not escalated, product, out-of-scope or
          no-evidence messages (PR-10 B5). Shown once meta arrives, in the answer's language. */}
      {!meta?.escalated && FDA_ROUTES.has(route) && <Disclaimer language={meta?.language} />}
      {done && (
        <div className="mt-1 flex items-center justify-between gap-2">
          <RelativeTime iso={message.createdAt} />
          <div className="flex items-center gap-1">
            <CopyButton text={copyText(message.content, citations)} />
            {!meta.escalated && (
              <FeedbackButtons value={message.feedback} onRate={(rating) => onRate(message.id, rating)} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
