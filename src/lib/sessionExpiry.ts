import { supabase } from "./supabase";

let redirectingHome = false;

/** Clear local auth and send the user to the homepage (idempotent). */
export async function logoutToHome(reason?: string): Promise<void> {
  if (redirectingHome) return;
  redirectingHome = true;
  if (reason) console.info("[auth]", reason);

  try {
    await supabase.auth.signOut();
  } catch {
    /* still redirect */
  }

  const path = window.location.pathname;
  if (path !== "/" && path !== "") {
    window.location.assign("/");
    return;
  }
  // Already on home — allow future logouts after a short settle.
  window.setTimeout(() => {
    redirectingHome = false;
  }, 1500);
}
