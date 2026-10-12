/**
 * MedAssist client interface. Both mockClient.js and httpClient.js implement it.
 *
 * @typedef {import("../types.js").Citation} Citation
 * @typedef {import("../types.js").AnswerMeta} AnswerMeta
 * @typedef {import("../types.js").ApiError} ApiError
 * @typedef {import("../types.js").ChatSession} ChatSession
 * @typedef {import("../types.js").ChatMessage} ChatMessage
 * @typedef {import("../types.js").Escalation} Escalation
 */

/**
 * @typedef {Object} StreamHandlers
 * @property {(text: string) => void} onToken
 * @property {(c: Citation[]) => void} onCitations
 * @property {(m: AnswerMeta) => void} onMeta
 * @property {() => void} onDone
 * @property {(e: ApiError) => void} onError
 */

/**
 * @typedef {Object} MedAssistClient
 * @property {(input: { question: string, sessionId?: string }, h: StreamHandlers, signal?: AbortSignal) => Promise<void>} askStream
 * @property {() => Promise<ChatSession[]>} listSessions
 * @property {(sessionId: string) => Promise<ChatMessage[]>} getMessages
 * @property {() => Promise<void>} clearHistory
 * @property {(messageId: string, rating: 1 | -1, comment?: string) => Promise<void>} sendFeedback
 * @property {(status: 'pending' | 'answered') => Promise<Escalation[]>} listEscalations
 * @property {(id: string, reply: string) => Promise<void>} replyEscalation
 * @property {() => Promise<FeedbackStats>} getFeedbackStats Pharmacist insights. Not in the original FastAPI contract yet.
 */

/**
 * @typedef {Object} FeedbackStats
 * @property {number} unhelpfulCount answers rated -1 in the last 7 days
 */

/**
 * Normalize anything thrown by a client call into an ApiError.
 * @param {unknown} err
 * @returns {ApiError}
 */
export function toApiError(err) {
  if (err && typeof err === "object" && typeof err.status === "number" && typeof err.message === "string") {
    return /** @type {ApiError} */ (err);
  }
  return { status: 0, message: err?.message || "Something went wrong" };
}
