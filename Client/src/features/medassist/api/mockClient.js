import { formatPrice } from "../utils.js";
import {
  ALTERNATIVES,
  DEFAULT_DRUG,
  DRUGS,
  EMERGENCY_MESSAGE,
  NO_EVIDENCE_MESSAGE,
  PRODUCTS,
  cite,
  createSeedState,
} from "../mocks/fixtures.js";

/**
 * In-memory MedAssist client. Keeps sessions, messages and escalations in module memory
 * (reset on page reload) so every UI state can be exercised without the FastAPI server.
 *
 * @typedef {import("./client.js").MedAssistClient} MedAssistClient
 * @typedef {import("./client.js").StreamHandlers} StreamHandlers
 * @typedef {import("../types.js").ChatMessage} ChatMessage
 */

export const LOADING_DELAY_MS = 600;
export const TOKEN_INTERVAL_MS = 30;
const LIST_DELAY_MS = 250;

/**
 * @typedef {'product_in_stock' | 'product_out_of_stock' | 'escalated' | 'emergency' | 'no_evidence' | 'rate_limit' | 'server_error' | 'knowledge'} Scenario
 */

/**
 * Pick the mock scenario from keywords in the question (case-insensitive).
 * Order matters: safety first (emergency, escalation), then errors, then product cases,
 * so "Panadol kitni leni hai?" escalates instead of returning a product card.
 * @param {string} question
 * @returns {Scenario}
 */
export function pickScenario(question) {
  const q = String(question || "").toLowerCase();
  if (/overdose|chest pain|saans/.test(q)) return "emergency";
  if (/\blimit\b/.test(q)) return "rate_limit";
  if (/\berror\b/.test(q)) return "server_error";
  if (/dose|kitni|pregnant|child|bachay/.test(q)) return "escalated";
  // Word boundary so "about" / "without" don't match.
  if (/\bout\b/.test(q)) return "product_out_of_stock";
  if (/stock|available|hai\?/.test(q)) return "product_in_stock";
  if (/unknown|xyz/.test(q)) return "no_evidence";
  return "knowledge";
}

/** Find the drug named in the question (generic, brand or alias). Falls back to paracetamol. */
export function detectDrug(question) {
  const q = String(question || "").toLowerCase();
  const hit = Object.values(DRUGS).find((d) => d.aliases.some((a) => q.includes(a)));
  return hit ? hit.generic : DEFAULT_DRUG;
}

function isRomanUrdu(question) {
  return /\b(hai|kya|kitni|mein|bachay|ka|ki|ko|de sakte|chahiye)\b/i.test(question);
}

const clone = (v) => (v == null ? v : structuredClone(v));

let idCounter = 0;
function newId(prefix) {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

/** Resolves after `ms`, or early (with `false`) if the signal aborts. */
function wait(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve(false);
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve(true);
    }, ms);
    function onAbort() {
      clearTimeout(t);
      resolve(false);
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** First name of the signed-in customer, for escalation records. */
function currentFirstName() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    const first = String(user?.name || "").trim().split(/\s+/)[0];
    return first || "Customer";
  } catch {
    return "Customer";
  }
}

function titleFrom(question) {
  const t = question.trim().replace(/\s+/g, " ");
  return t.length > 48 ? `${t.slice(0, 45)}…` : t;
}

/**
 * Build the answer for a scenario.
 * @returns {{ content: string, citations: import("../types.js").Citation[], route: import("../types.js").Route,
 *   escalated: boolean, escalationReason?: import("../types.js").EscalationReason, products?: import("../types.js").ProductCard[] }}
 */
export function buildAnswer(scenario, question) {
  const drugKey = detectDrug(question);
  const d = DRUGS[drugKey];
  const product = PRODUCTS[drugKey];

  switch (scenario) {
    case "product_in_stock": {
      const content = isRomanUrdu(question)
        ? `Ji haan, **${product.name}** stock mein hai. Qeemat ${formatPrice(product.price)} hai.`
        : `Yes, **${product.name}** is in stock for ${formatPrice(product.price)}.`;
      return { content, citations: [], route: "product", escalated: false, products: [{ ...product }] };
    }
    case "product_out_of_stock": {
      const out = { ...product, inStock: false, alternatives: clone(ALTERNATIVES[drugKey]) };
      return {
        content:
          `**${product.name}** is currently out of stock. These alternatives contain the same active ingredient ` +
          `(${product.genericName}) and are available now:`,
        citations: [],
        route: "product",
        escalated: false,
        products: [out],
      };
    }
    case "escalated": {
      const child = /pregnant|child|bachay/i.test(question);
      return {
        content:
          (child
            ? "Medicines during pregnancy or for children need a pharmacist's advice, so I've sent your question to our pharmacist. "
            : "Your exact dose depends on your health and other medicines, so I've sent your question to our pharmacist. ") +
          `In general, ${d.generic} (${d.brand}) is used for ${d.uses} [1]. ` +
          `Label dosing differs by age, weight and kidney or liver function [2]. ` +
          "You'll get a reply here, usually within a few hours.",
        citations: [
          cite(1, d.generic, "Indications and Usage"),
          cite(2, d.generic, child ? "Use in Specific Populations" : "Dosage and Administration"),
        ],
        route: "escalated",
        escalated: true,
        escalationReason: child ? "pregnancy_or_child" : "personal_dosing",
      };
    }
    case "emergency":
      return { content: EMERGENCY_MESSAGE, citations: [], route: "emergency", escalated: false };
    case "no_evidence":
      return { content: NO_EVIDENCE_MESSAGE, citations: [], route: "no_evidence", escalated: false };
    case "knowledge":
    default:
      return {
        content:
          `**${d.generic[0].toUpperCase()}${d.generic.slice(1)}** (brand: ${d.brand}) is commonly used for ${d.uses} [1].\n\n` +
          `- **How it works:** ${d.howItWorks} [1]\n` +
          `- **Common side effects:** ${d.sideEffects} [2]\n` +
          `- **Important warning:** ${d.warning} [3]\n\n` +
          "Ask a pharmacist before use if you take other medicines or have a long-term condition.",
        citations: [
          cite(1, d.generic, "Indications and Usage"),
          cite(2, d.generic, "Adverse Reactions"),
          cite(3, d.generic, "Warnings and Precautions"),
        ],
        route: "knowledge",
        escalated: false,
      };
  }
}

/**
 * @param {{ loadingDelayMs?: number, tokenIntervalMs?: number, listDelayMs?: number }} [options]
 * @returns {MedAssistClient}
 */
export function createMockClient(options = {}) {
  const loadingDelayMs = options.loadingDelayMs ?? LOADING_DELAY_MS;
  const tokenIntervalMs = options.tokenIntervalMs ?? TOKEN_INTERVAL_MS;
  const listDelayMs = options.listDelayMs ?? LIST_DELAY_MS;

  const db = createSeedState();
  /** @type {Record<string, string>} messageId -> comment */
  const feedbackComments = {};

  function findMessage(messageId) {
    for (const list of Object.values(db.messages)) {
      const m = list.find((x) => x.id === messageId);
      if (m) return m;
    }
    return null;
  }

  function touchSession(sessionId) {
    const s = db.sessions.find((x) => x.id === sessionId);
    if (s) s.updatedAt = new Date().toISOString();
  }

  return {
    async askStream({ question, sessionId }, h, signal) {
      const startedAt = Date.now();
      if (!(await wait(loadingDelayMs, signal))) return;

      const scenario = pickScenario(question);
      if (scenario === "rate_limit") {
        h.onError({ status: 429, message: "Too many questions. Please wait before asking again.", retryAfterSec: 1200 });
        return;
      }
      if (scenario === "server_error") {
        h.onError({ status: 500, message: "MedAssist is having a problem. Please try again." });
        return;
      }

      let sid = sessionId && db.messages[sessionId] ? sessionId : null;
      if (!sid) {
        sid = newId("sess");
        const now = new Date().toISOString();
        db.sessions.push({ id: sid, title: titleFrom(question), createdAt: now, updatedAt: now });
        db.messages[sid] = [];
      }
      db.messages[sid].push({
        id: newId("msg"),
        sessionId: sid,
        role: "user",
        content: question,
        createdAt: new Date().toISOString(),
      });
      touchSession(sid);

      const answer = buildAnswer(scenario, question);
      const messageId = newId("msg");
      // Keep whitespace as part of the next word so joined tokens equal the content.
      const tokens = answer.content.match(/\s*\S+/g) || [];
      let streamed = "";

      /** Save what the user saw (full or partial) so getMessages matches the UI. */
      const save = (meta) => {
        if (!streamed) return;
        db.messages[sid].push({
          id: messageId,
          sessionId: sid,
          role: "assistant",
          content: streamed,
          createdAt: new Date().toISOString(),
          ...(meta ? { citations: clone(answer.citations), meta: clone(meta) } : {}),
        });
        touchSession(sid);
      };

      for (const token of tokens) {
        if (!(await wait(tokenIntervalMs, signal))) {
          save(null);
          return;
        }
        streamed += token;
        h.onToken(token);
      }

      /** @type {import("../types.js").AnswerMeta} */
      const meta = {
        messageId,
        sessionId: sid,
        route: answer.route,
        escalated: answer.escalated,
        latencyMs: Date.now() - startedAt,
      };
      if (answer.escalated) {
        meta.escalationReason = answer.escalationReason;
        meta.escalationStatus = "pending";
        db.escalations.push({
          id: newId("esc"),
          messageId,
          customerFirstName: currentFirstName(),
          question,
          reason: answer.escalationReason,
          status: "pending",
          createdAt: new Date().toISOString(),
          sources: clone(answer.citations),
        });
      }
      if (answer.products) meta.products = answer.products;

      save(meta);
      h.onCitations(clone(answer.citations));
      h.onMeta(clone(meta));
      h.onDone();
    },

    async listSessions() {
      await wait(listDelayMs);
      return clone([...db.sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    },

    async getMessages(sessionId) {
      await wait(listDelayMs);
      const list = db.messages[sessionId];
      if (!list) throw { status: 404, message: "Chat not found" };
      return clone(list);
    },

    async clearHistory() {
      await wait(listDelayMs);
      db.sessions.length = 0;
      for (const key of Object.keys(db.messages)) delete db.messages[key];
    },

    async sendFeedback(messageId, rating, comment) {
      await wait(listDelayMs);
      const m = findMessage(messageId);
      if (!m) throw { status: 404, message: "Message not found" };
      m.feedback = rating;
      if (comment) feedbackComments[messageId] = comment;
    },

    async listEscalations(status) {
      await wait(listDelayMs);
      return clone(
        db.escalations
          .filter((e) => e.status === status)
          .sort((a, b) =>
            status === "pending"
              ? a.createdAt.localeCompare(b.createdAt) // oldest first: answer in order
              : (b.answeredAt || "").localeCompare(a.answeredAt || "")
          )
      );
    },

    async getFeedbackStats() {
      await wait(listDelayMs);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
      const unhelpfulCount = Object.values(db.messages)
        .flat()
        .filter((m) => m.feedback === -1 && m.createdAt >= weekAgo).length;
      return { unhelpfulCount };
    },

    async replyEscalation(id, reply) {
      await wait(listDelayMs);
      const text = String(reply || "").trim();
      if (!text) throw { status: 422, message: "Reply cannot be empty" };
      const esc = db.escalations.find((e) => e.id === id);
      if (!esc) throw { status: 404, message: "Escalation not found" };
      if (esc.status === "answered") throw { status: 409, message: "Already answered" };

      const now = new Date().toISOString();
      esc.status = "answered";
      esc.reply = text;
      esc.answeredAt = now;

      // Customers outside this browser's sessions have no thread here; only the record is updated.
      const original = findMessage(esc.messageId);
      if (original) {
        if (original.meta) original.meta.escalationStatus = "answered";
        db.messages[original.sessionId].push({
          id: newId("msg"),
          sessionId: original.sessionId,
          role: "pharmacist",
          content: text,
          createdAt: now,
        });
        touchSession(original.sessionId);
      }
    },
  };
}

export const mockClient = createMockClient();
