import { useCallback, useEffect, useRef, useState } from "react";
import { medassistClient, toApiError } from "../api/index.js";

/** Fired after a reply so every escalation hook (sidebar badge, tabs, insights) reloads. */
export const ESCALATIONS_CHANGED_EVENT = "medassist:escalations-changed";

/** request key -> the request still in flight. */
const inflight = new Map();

/**
 * Callers that ask for the same key while a request is running get that request's promise.
 * The sidebar badge, the tabs, the insights card and React StrictMode's second mount all load at
 * once, so this turns 2-4 identical fetches into one (PR-10 B6).
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} load
 * @returns {Promise<T>}
 */
export function shareInFlight(key, load) {
  if (!inflight.has(key)) {
    inflight.set(key, load().finally(() => inflight.delete(key)));
  }
  return inflight.get(key);
}

/** listEscalations(status), shared while in flight. @param {'pending' | 'answered'} status */
export const fetchEscalations = (status) =>
  shareInFlight(`escalations:${status}`, () => medassistClient.listEscalations(status));

/**
 * Pharmacist queue of escalated questions.
 * @param {'pending' | 'answered'} [status='pending']
 * @param {{ enabled?: boolean }} [options] enabled=false skips loading (e.g. for admins)
 */
export function useEscalations(status = "pending", { enabled = true } = {}) {
  /** @type {[import("../types.js").Escalation[], Function]} */
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(enabled);
  /** @type {[import("../types.js").ApiError | null, Function]} */
  const [error, setError] = useState(null);
  const [replyingId, setReplyingId] = useState(null);
  const requestRef = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const list = await fetchEscalations(status);
      if (request === requestRef.current) setEscalations(list);
    } catch (e) {
      if (request === requestRef.current) setError(toApiError(e));
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [status]);

  /**
   * Answer an escalation; all escalation hooks reload. Throws ApiError so the caller can toast it.
   * @param {string} id
   * @param {string} text
   */
  const reply = useCallback(async (id, text) => {
    setReplyingId(id);
    try {
      await medassistClient.replyEscalation(id, text);
      inflight.clear(); // a list loaded before the reply is stale: the reload must fetch again
      window.dispatchEvent(new Event(ESCALATIONS_CHANGED_EVENT));
    } catch (e) {
      throw toApiError(e);
    } finally {
      setReplyingId(null);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh();
    window.addEventListener(ESCALATIONS_CHANGED_EVENT, refresh);
    return () => {
      requestRef.current += 1;
      window.removeEventListener(ESCALATIONS_CHANGED_EVENT, refresh);
    };
  }, [enabled, refresh]);

  return { escalations, loading, error, replyingId, refresh, reply };
}
