import { useCallback, useContext, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { AuthContext } from "../../../context/AuthContext.jsx";
import { useMedAssist } from "../../../context/MedAssistContext.jsx";
import ChatLauncher from "./ChatLauncher.jsx";
import ChatPanel from "./ChatPanel.jsx";

const CUSTOMER_ROLES = ["user", "doctor"];
const ASSISTANT_PATH = "/user/assistant";

/**
 * Floating MedAssist for customers. Mounted once in App.jsx.
 * Visible on /user/* for customers, and on the start page for logged-out visitors.
 */
export default function MedAssistWidget() {
  const { user, loading } = useContext(AuthContext);
  const { open, setOpen, chat, productName, rateLimitedUntil } = useMedAssist();
  const { pathname } = useLocation();
  const launcherRef = useRef(null);
  const wasOpenRef = useRef(open);

  const loggedIn = Boolean(user) && CUSTOMER_ROLES.includes(user.role);
  // /user/assistant is the full-page chat, so the launcher is not shown there.
  const onAssistantPage = pathname === ASSISTANT_PATH || pathname.startsWith(`${ASSISTANT_PATH}/`);
  const visible =
    !loading && (loggedIn ? pathname.startsWith("/user") && !onAssistantPage : !user && pathname === "/");

  const close = useCallback(() => setOpen(false), [setOpen]);

  // Focus returns to the launcher on close.
  useEffect(() => {
    if (wasOpenRef.current && !open) launcherRef.current?.focus();
    wasOpenRef.current = open;
  }, [open]);

  if (!visible) return null;

  return open ? (
    <ChatPanel
      chat={chat}
      loggedIn={loggedIn}
      productName={productName}
      rateLimitedUntil={rateLimitedUntil}
      onClose={close}
    />
  ) : (
    <ChatLauncher ref={launcherRef} onClick={() => setOpen(true)} />
  );
}
