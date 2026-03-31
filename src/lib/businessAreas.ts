/**
 * Shared vocabulary for:
 * - Seeker `profession_or_study`
 * - Job listing profession/field sought (`jobs.area_of_business` — per role, not employer company sector)
 * - Employer company sector (`profiles.area_of_business` on the company profile)
 */
export const BUSINESS_AREAS = [
  "Technology & IT",
  "Finance & Accounting",
  "Healthcare & Life Sciences",
  "Education & Training",
  "Engineering & Manufacturing",
  "Sales, Marketing & Media",
  "Hospitality & Tourism",
  "Agriculture & Environment",
  "Legal & Compliance",
  "HR & Administration",
  "Operations & Logistics",
  "Creative & Design",
  "Skilled Trades & Technical Services",
  "Other / General",
] as const;

export type BusinessArea = (typeof BUSINESS_AREAS)[number];

export function normalizeAreaFocus(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function areasFocusMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeAreaFocus(a);
  const nb = normalizeAreaFocus(b);
  return na.length > 0 && na === nb;
}
