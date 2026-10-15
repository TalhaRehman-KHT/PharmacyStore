/**
 * MedAssist data contract. Mirrors the future FastAPI schema exactly (camelCase JSON).
 * The project is plain JS, so the types are JSDoc typedefs; the arrays below are
 * runtime copies of the string unions for validation and UI switches.
 */

/** @typedef {'user' | 'assistant' | 'pharmacist'} Role */
/** @typedef {'knowledge' | 'product' | 'both' | 'out_of_scope' | 'emergency' | 'escalated' | 'no_evidence'} Route */
/** @typedef {'personal_dosing' | 'prescription_only' | 'pregnancy_or_child' | 'no_evidence'} EscalationReason */
/** @typedef {'pending' | 'answered'} EscalationStatus */

/**
 * @typedef {Object} Citation
 * @property {number} n
 * @property {string} drug
 * @property {string} section
 * @property {string} url
 */

/**
 * A shop medicine. In stock: batchId / price / pharmacy of the batch the cart uses.
 * Out of stock: no batchId and no price, maybe in-stock alternatives (same generic).
 * @typedef {Object} ProductCard
 * @property {string} [batchId] medicine_batches.id (absent when out of stock)
 * @property {string} medicineId
 * @property {string} name
 * @property {string} [genericName]
 * @property {number} [price] selling_price (absent when out of stock)
 * @property {string} currency ISO code, e.g. 'USD' (API setting SHOP_CURRENCY)
 * @property {boolean} inStock
 * @property {string} [pharmacyId]
 * @property {string} [pharmacyName]
 * @property {string} [imageUrl]
 * @property {ProductCard[]} [alternatives]
 */

/**
 * @typedef {Object} AnswerMeta
 * @property {string} messageId
 * @property {string} sessionId
 * @property {Route} route
 * @property {boolean} escalated
 * @property {EscalationReason} [escalationReason]
 * @property {EscalationStatus} [escalationStatus]
 * @property {ProductCard[]} [products]
 * @property {number} latencyMs
 * @property {number} [tokens] LLM input + output tokens (absent when no LLM was called)
 */

/**
 * @typedef {Object} ChatMessage
 * @property {string} id
 * @property {string} sessionId
 * @property {Role} role
 * @property {string} content
 * @property {string} createdAt ISO 8601
 * @property {Citation[]} [citations]
 * @property {AnswerMeta} [meta]
 * @property {1 | -1} [feedback]
 */

/**
 * @typedef {Object} ChatSession
 * @property {string} id
 * @property {string} title
 * @property {string} createdAt ISO 8601
 * @property {string} updatedAt ISO 8601
 */

/**
 * @typedef {Object} Escalation
 * @property {string} id
 * @property {string} messageId
 * @property {string} customerFirstName
 * @property {string} question
 * @property {EscalationReason} reason
 * @property {EscalationStatus} status
 * @property {string} createdAt ISO 8601
 * @property {Citation[]} sources
 * @property {string} [reply]
 * @property {string} [answeredAt] ISO 8601
 */

/**
 * @typedef {Object} ApiError
 * @property {number} status HTTP status; 0 = network / client error
 * @property {string} message
 * @property {number} [retryAfterSec]
 */

export const ROLES = ["user", "assistant", "pharmacist"];
export const ROUTES = ["knowledge", "product", "both", "out_of_scope", "emergency", "escalated", "no_evidence"];
export const ESCALATION_REASONS = ["personal_dosing", "prescription_only", "pregnancy_or_child", "no_evidence"];
export const ESCALATION_STATUSES = ["pending", "answered"];
