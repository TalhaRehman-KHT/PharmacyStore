import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AuthContext } from "./AuthContext.jsx";
import { useMedAssistChat } from "../features/medassist/hooks/useMedAssistChat.js";

export const MedAssistContext = createContext(null);

/**
 * App-level MedAssist state, so the chat survives page navigation
 * (each page renders its own layout).
 * - productName: set by product pages so suggestion chips mention the product.
 * - rateLimitedUntil: epoch ms; input is disabled until then after a 429.
 */
export function MedAssistProvider({ children }) {
  const { user } = useContext(AuthContext);
  const [open, setOpen] = useState(false);
  const [productName, setProductNameState] = useState(null);
  const [rateLimitedUntil, setRateLimitedUntil] = useState(0);
  const chat = useMedAssistChat();
  const { error, newChat } = chat;

  const setProductName = useCallback((name) => setProductNameState(name || null), []);

  // A 429 blocks the input for retryAfterSec.
  useEffect(() => {
    if (error?.status === 429 && error.retryAfterSec) {
      setRateLimitedUntil(Date.now() + error.retryAfterSec * 1000);
    }
  }, [error]);

  useEffect(() => {
    if (!rateLimitedUntil) return;
    const t = setTimeout(() => setRateLimitedUntil(0), Math.max(0, rateLimitedUntil - Date.now()));
    return () => clearTimeout(t);
  }, [rateLimitedUntil]);

  // Never show one account's chat to another.
  const userIdRef = useRef(user?.id ?? null);
  useEffect(() => {
    const id = user?.id ?? null;
    if (id !== userIdRef.current) {
      userIdRef.current = id;
      newChat();
    }
  }, [user?.id, newChat]);

  const value = useMemo(
    () => ({ open, setOpen, productName, setProductName, chat, rateLimitedUntil }),
    [open, productName, setProductName, chat, rateLimitedUntil]
  );

  return <MedAssistContext.Provider value={value}>{children}</MedAssistContext.Provider>;
}

export function useMedAssist() {
  const ctx = useContext(MedAssistContext);
  if (!ctx) throw new Error("useMedAssist must be used inside MedAssistProvider");
  return ctx;
}
