import type { SupabaseClient } from "@supabase/supabase-js";

const selectWithEmployer = `
  *,
  employer:profiles!posted_by (
    full_name,
    company_name,
    office_location,
    area_of_business
  )
`;

/** Active job listings with employer profile embed (same shape as the home board). */
export async function fetchOpenJobsWithEmployer(client: SupabaseClient): Promise<any[]> {
  let { data, error } = await client
    .from("jobs")
    .select(selectWithEmployer)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    const fallback = await client.from("jobs").select("*").order("created_at", { ascending: false });
    data = fallback.data;
  }

  if (!data?.length) return [];

  const normalized = data.map((row: Record<string, unknown>) => {
    const raw = row.employer as unknown;
    const emp = Array.isArray(raw) ? raw[0] : raw;
    const { employer: _drop, ...job } = row;
    return {
      ...job,
      employer:
        emp && typeof emp === "object" && emp !== null ? (emp as Record<string, unknown>) : null,
    };
  });

  return normalized.filter(
    (j: any) => !j.closes_at || new Date(j.closes_at) > new Date()
  );
}
