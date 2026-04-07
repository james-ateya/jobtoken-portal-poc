import { supabase } from "./supabase";

/**
 * Same as `fetch`, but attaches `Authorization: Bearer <access_token>` when the user is signed in.
 * Use for API routes that bind identity to the JWT (`server/auth.ts`).
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
  return fetch(input, { ...init, headers });
}
