import { createClient } from "@supabase/supabase-js";
import { loadProjectEnv } from "../server/load-env.js";
import { buildProfileSearchOrFilter, escapeIlikePattern } from "../server/admin-search.js";

loadProjectEnv();
const sb = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function trySearch(label: string, orFilter: string) {
  const { data, error, count } = await sb
    .from("profiles")
    .select("email, full_name", { count: "exact" })
    .eq("role", "seeker")
    .or(orFilter)
    .limit(5);
  console.log(label, error?.message ?? `ok (${count} matches)`, data?.map((r) => r.email));
}

const sample = await sb.from("profiles").select("email, full_name").eq("role", "seeker").limit(1).maybeSingle();
console.log("sample:", sample.data);

if (sample.data?.email) {
  const part = String(sample.data.email).split("@")[0].slice(0, 4);
  const pattern = `%${escapeIlikePattern(part)}%`;
  await trySearch("unquoted", `email.ilike.${pattern},full_name.ilike.${pattern}`);
  await trySearch("quoted helper", buildProfileSearchOrFilter(part));

  const fullEmail = String(sample.data.email);
  await trySearch("full email unquoted", `email.ilike.%${fullEmail}%,full_name.ilike.%${fullEmail}%`);
  await trySearch("full email quoted", buildProfileSearchOrFilter(fullEmail));
}

if (sample.data?.full_name) {
  const namePart = String(sample.data.full_name).split(" ")[0].slice(0, 3);
  if (namePart.length >= 2) {
    await trySearch("name quoted", buildProfileSearchOrFilter(namePart));
  }
}
