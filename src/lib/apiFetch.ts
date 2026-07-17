import { supabase } from "./supabase";
import { logoutToHome } from "./sessionExpiry";

/**
 * Same as `fetch`, but attaches `Authorization: Bearer <access_token>` when the user is signed in.
 * Use for API routes that bind identity to the JWT (`server/auth.ts`).
 * If a sent token is rejected (401), signs out and redirects home.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(input, { ...init, headers });

  if (res.status === 401 && token) {
    await logoutToHome("API rejected session (401)");
  }

  return res;
}
