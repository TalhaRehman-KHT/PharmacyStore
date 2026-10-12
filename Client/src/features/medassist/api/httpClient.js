/**
 * HTTP client for the MedAssist FastAPI service. Not wired yet: every method rejects.
 *
 * @typedef {import("./client.js").MedAssistClient} MedAssistClient
 */

export const MEDASSIST_API_URL = String(import.meta.env.VITE_MEDASSIST_API_URL || "")
  .trim()
  .replace(/\/$/, "");

function notImplemented() {
  throw new Error("Not implemented yet");
}

/** @type {MedAssistClient} */
export const httpClient = {
  // TODO: POST `${MEDASSIST_API_URL}/ask` with { question, sessionId } and read the response as
  // Server-Sent Events (fetch + ReadableStream, so `signal` can abort it). Events, in order:
  //   event: token      data: { "text": string }          -> h.onToken(text)    (many)
  //   event: citations  data: Citation[]                  -> h.onCitations(c)   (once, may be [])
  //   event: meta       data: AnswerMeta                  -> h.onMeta(m)        (once; carries messageId + sessionId)
  //   event: done       data: {}                          -> h.onDone()         (once, last)
  // Non-2xx before the stream starts -> h.onError({ status, message, retryAfterSec from Retry-After }).
  // An `error` event mid-stream -> h.onError(...). Abort -> resolve silently, no handler calls.
  async askStream() {
    notImplemented();
  },
  // TODO: GET /sessions -> ChatSession[]
  async listSessions() {
    notImplemented();
  },
  // TODO: GET /sessions/:id/messages -> ChatMessage[]
  async getMessages() {
    notImplemented();
  },
  // TODO: DELETE /sessions
  async clearHistory() {
    notImplemented();
  },
  // TODO: POST /messages/:id/feedback { rating, comment }
  async sendFeedback() {
    notImplemented();
  },
  // TODO: GET /escalations?status=pending|answered (pharmacist only)
  async listEscalations() {
    notImplemented();
  },
  // TODO: POST /escalations/:id/reply { reply } (pharmacist only)
  async replyEscalation() {
    notImplemented();
  },
  // TODO: GET /insights/feedback -> { unhelpfulCount } (pharmacist only; endpoint still to be agreed)
  async getFeedbackStats() {
    notImplemented();
  },
};
