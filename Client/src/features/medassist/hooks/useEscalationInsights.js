import { useCallback, useEffect, useRef, useState } from "react";
import { medassistClient, toApiError } from "../api/index.js";
import { ESCALATIONS_CHANGED_EVENT } from "./useEscalations.js";

const WEEK_MS = 7 * 24 * 60 * 60_000;
const TOP_N = 5;

/**
 * Most asked medicines this week = drugs in the sources of this week's escalations
 * (each escalation counts a drug once).
 * For now this is derived on the client; swap for a server insights endpoint later
 * without changing the hook's return shape.
 * @param {import("../types.js").Escalation[]} escalations
 * @returns {{ drug: string, count: number }[]}
 */
export function topMedicines(escalations, now = Date.now()) {
  const counts = new Map();
  for (const e of escalations) {
    if (now - new Date(e.createdAt).getTime() > WEEK_MS) continue;
    for (const drug of new Set((e.sources || []).map((s) => s.drug.toLowerCase()))) {
      counts.set(drug, (counts.get(drug) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([drug, count]) => ({ drug, count }))
    .sort((a, b) => b.count - a.count || a.drug.localeCompare(b.drug))
    .slice(0, TOP_N);
}

/** Pharmacist insights card data. */
export function useEscalationInsights() {
  const [topMeds, setTopMeds] = useState([]);
  const [unhelpfulCount, setUnhelpfulCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requestRef = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const [pending, answered, stats] = await Promise.all([
        medassistClient.listEscalations("pending"),
        medassistClient.listEscalations("answered"),
        medassistClient.getFeedbackStats(),
      ]);
      if (request !== requestRef.current) return;
      setTopMeds(topMedicines([...pending, ...answered]));
      setUnhelpfulCount(stats.unhelpfulCount);
    } catch (e) {
      if (request === requestRef.current) setError(toApiError(e));
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(ESCALATIONS_CHANGED_EVENT, refresh);
    return () => {
      requestRef.current += 1;
      window.removeEventListener(ESCALATIONS_CHANGED_EVENT, refresh);
    };
  }, [refresh]);

  return { topMedicines: topMeds, unhelpfulCount, loading, error, refresh };
}
