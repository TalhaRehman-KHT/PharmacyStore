import { lazy, Suspense, useCallback, useContext, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { AuthContext } from "../../../context/AuthContext.jsx";
import { useMedAssist } from "../hooks/useMedAssist.js";
import ChatLauncher from "./ChatLauncher.jsx";

// The panel (and react-markdown) loads on first open; the launcher is tiny and shows at once.
const ChatPanel = lazy(() => import("./ChatPanel.jsx"));

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

  // No user id = logged out (the "Log in to use MedAssist" state), never mock data.
  const loggedIn = Boolean(user?.id) && CUSTOMER_ROLES.includes(user.role);
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
    <Suspense fallback={null}>
      <ChatPanel
        chat={chat}
        loggedIn={loggedIn}
        productName={productName}
        rateLimitedUntil={rateLimitedUntil}
        onClose={close}
      />
    </Suspense>
  ) : (
    <ChatLauncher ref={launcherRef} onClick={() => setOpen(true)} />
  );
}
