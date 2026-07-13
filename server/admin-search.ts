/** Escape user input for PostgREST `ilike` patterns. */
export function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

export function normalizeAdminSearchQuery(raw: unknown): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length < 2) return null;
  return trimmed.slice(0, 120);
}

/** PostgREST `.or()` filter for profile email + full_name search (values must be quoted). */
export function buildProfileSearchOrFilter(searchQuery: string): string {
  const pattern = `%${escapeIlikePattern(searchQuery)}%`;
  const quoted = `"${pattern.replace(/"/g, '""')}"`;
  return `email.ilike.${quoted},full_name.ilike.${quoted}`;
}
