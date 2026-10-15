/**
 * HTTP client for the MedAssist FastAPI service (medassist-api).
 *
 * Every request sends `X-User-Id` (the logged-in user's id, same trust model as the main app;
 * see medassist-api/CLAUDE.md "Hard rules", Auth). Failures are thrown / reported as ApiError.
 *
 * @typedef {import("./client.js").MedAssistClient} MedAssistClient
 * @typedef {import("../types.js").ApiError} ApiError
 */
import { getCurrentUserId } from "./currentUser.js";
import { createSseParser } from "./sse.js";

export const MEDASSIST_API_URL = String(import.meta.env.VITE_MEDASSIST_API_URL || "http://localhost:8000")
  .trim()
  .replace(/\/$/, "");

const NOT_LOGGED_IN = { status: 401, message: "Please log in again" };
const UNREACHABLE = { status: 0, message: "Cannot reach MedAssist" };

/** @returns {ApiError} */
function apiError(status, message, retryAfterSec) {
  return retryAfterSec == null ? { status, message } : { status, message, retryAfterSec };
}

function isAbort(err) {
  return err?.name === "AbortError";
}

/** Turn a non-2xx response into an ApiError (server body is { status, message }). */
async function errorFrom(res) {
  if (res.status === 401) return NOT_LOGGED_IN;
  let body = null;
  try {
    body = await res.json();
  } catch {
    // not JSON
  }
  const message = typeof body?.message === "string" && body.message ? body.message : `Request failed (${res.status})`;
  if (res.status === 429) {
    const header = Number(res.headers.get("Retry-After"));
    const retry = Number.isFinite(header) && header > 0 ? header : Number(body?.retryAfterSec) || undefined;
    return apiError(429, message, retry);
  }
  return apiError(res.status, message);
}

/** fetch with X-User-Id; throws ApiError on no user, network failure or non-2xx. */
async function request(path, { method = "GET", body, signal } = {}) {
  const userId = getCurrentUserId();
  if (!userId) throw NOT_LOGGED_IN;
  const headers = { "X-User-Id": userId };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let res;
  try {
    res = await fetch(`${MEDASSIST_API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (isAbort(err)) throw err;
    throw UNREACHABLE;
  }
  if (!res.ok) throw await errorFrom(res);
  return res;
}

async function json(path, options) {
  const res = await request(path, options);
  return res.status === 204 ? null : res.json();
}

function parseData(data) {
  try {
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

/** @type {MedAssistClient} */
export const httpClient = {
  /**
   * POST /ask/stream and read Server-Sent Events: token (many), citations, meta, done; or error.
   * Abort (Stop button) resolves silently without calling any handler.
   */
  async askStream({ question, sessionId }, h, signal) {
    let res;
    try {
      res = await request("/ask/stream", { method: "POST", body: { question, sessionId }, signal });
    } catch (err) {
      if (!isAbort(err)) h.onError(err);
      return;
    }

    let finished = false;
    const parser = createSseParser(({ event, data }) => {
      if (finished || signal?.aborted) return;
      const payload = parseData(data);
      if (event === "token") h.onToken(String(payload.text ?? ""));
      else if (event === "citations") h.onCitations(Array.isArray(payload) ? payload : []);
      else if (event === "meta") h.onMeta(payload);
      else if (event === "done") {
        finished = true;
        h.onDone();
      } else if (event === "error") {
        finished = true;
        const retry = Number(payload.retryAfterSec) || undefined; // 429 when the AI is busy
        h.onError(apiError(Number(payload.status) || 500, payload.message || "Something went wrong", retry));
      }
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    try {
      while (!finished) {
        const { value, done } = await reader.read();
        if (done) break;
        parser.push(decoder.decode(value, { stream: true }));
      }
      parser.push(decoder.decode());
      parser.end();
    } catch (err) {
      if (isAbort(err) || signal?.aborted) return;
      finished = true;
      h.onError(UNREACHABLE);
      return;
    } finally {
      if (finished) reader.cancel().catch(() => {});
    }
    if (!finished && !signal?.aborted) h.onError(apiError(0, "The answer was cut off. Please try again."));
  },

  async listSessions() {
    return json("/sessions");
  },

  async getMessages(sessionId) {
    return json(`/sessions/${encodeURIComponent(sessionId)}/messages`);
  },

  async clearHistory() {
    await json("/sessions", { method: "DELETE" });
  },

  async sendFeedback(messageId, rating, comment) {
    const body = comment ? { rating, comment } : { rating };
    await json(`/messages/${encodeURIComponent(messageId)}/feedback`, { method: "POST", body });
  },

  async listEscalations(status) {
    return json(`/escalations?status=${encodeURIComponent(status)}`);
  },

  async replyEscalation(id, reply) {
    await json(`/escalations/${encodeURIComponent(id)}/reply`, { method: "POST", body: { reply } });
  },

  /** GET /insights -> { unhelpfulLast7Days, pendingCount }; the card uses unhelpfulCount. */
  async getFeedbackStats() {
    const data = await json("/insights");
    return { unhelpfulCount: Number(data?.unhelpfulLast7Days) || 0, pendingCount: Number(data?.pendingCount) || 0 };
  },
};
