import { useCallback, useEffect, useRef, useState } from "react";
import { medassistClient, toApiError } from "../api/index.js";

/** Fired after a reply so every escalation hook (sidebar badge, tabs, insights) reloads. */
export const ESCALATIONS_CHANGED_EVENT = "medassist:escalations-changed";

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
      const list = await medassistClient.listEscalations(status);
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
