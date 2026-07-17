import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { logoutToHome } from "../lib/sessionExpiry";

/**
 * Keeps Supabase sessions valid; when the session expires or refresh fails,
 * signs the user out and redirects to the homepage.
 */
export function SessionExpiryGuard() {
  const hadSessionRef = useRef(false);

  useEffect(() => {
    let expiryTimer: number | undefined;
    let pollTimer: number | undefined;

    const clearTimers = () => {
      if (expiryTimer != null) window.clearTimeout(expiryTimer);
      if (pollTimer != null) window.clearInterval(pollTimer);
      expiryTimer = undefined;
    };

    const scheduleExpiryWatch = (expiresAtSec: number | undefined) => {
      if (expiryTimer != null) window.clearTimeout(expiryTimer);
      if (!expiresAtSec) return;

      // Refresh usually happens ~60s before expiry; check shortly after that window.
      const msUntilCheck = expiresAtSec * 1000 - Date.now() + 5_000;
      const delay = Math.max(5_000, Math.min(msUntilCheck, 2_147_000_000));

      expiryTimer = window.setTimeout(async () => {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          await logoutToHome("Session expired");
          return;
        }
        const { data: sess } = await supabase.auth.getSession();
        scheduleExpiryWatch(sess.session?.expires_at);
      }, delay);
    };

    const validateSession = async () => {
      const { data: sessData } = await supabase.auth.getSession();
      const session = sessData.session;

      if (!session) {
        if (hadSessionRef.current) {
          hadSessionRef.current = false;
          await logoutToHome("Session missing after login");
        }
        return;
      }

      hadSessionRef.current = true;
      scheduleExpiryWatch(session.expires_at);

      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        hadSessionRef.current = false;
        await logoutToHome("Session invalid or expired");
      }
    };

    void validateSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        hadSessionRef.current = true;
        scheduleExpiryWatch(session.expires_at);
        return;
      }

      // Refresh failure and explicit sign-out both emit SIGNED_OUT with a null session.
      if (event === "SIGNED_OUT" && hadSessionRef.current) {
        hadSessionRef.current = false;
        void logoutToHome("Signed out");
      }
    });

    // Re-validate when the tab becomes visible again (common expiry gap).
    const onVisibility = () => {
      if (document.visibilityState === "visible") void validateSession();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Safety net while the tab stays open.
    pollTimer = window.setInterval(() => {
      void validateSession();
    }, 5 * 60_000);

    return () => {
      clearTimers();
      if (pollTimer != null) window.clearInterval(pollTimer);
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
