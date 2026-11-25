// The Launch form's filters as one plain object: saved with every launch (launch_runs.form) so "Fix filters with AI" can
// read them later, sent to /api/launch/fix, and applied back onto the form. JSON-safe on purpose.
import type { PlacePick } from "@/lib/places";

export type LaunchFormState = {
  provider: "ai-ark" | "apify";
  lineId: string;
  sub: string;
  campaignId: string;
  campaignLock: boolean;
  places: PlacePick[];
  core: string[];
  custom: string[];
  /** typed industry (lower case) → LinkedIn industry, or null when nothing fits (then it is searched as a headline word) */
  industryMap: Record<string, string | null>;
  roles: string[];
  employees: string[];
  revenue: "small" | "icp" | "any";
  emailType: "work" | "any";
  maxPerCompany: number;
  limit: number;
  extraTitles: string;
  excludeNote: string;
  keyword: string;
  name: string;
};

/** Keeps only what the form can hold; a bad or old value is dropped instead of breaking the form. */
export function readLaunchForm(v: unknown): Partial<LaunchFormState> | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const strs = (x: unknown, max: number) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === "string").slice(0, max) : undefined);
  const out: Partial<LaunchFormState> = {};
  if (o.provider === "apify" || o.provider === "ai-ark") out.provider = o.provider;
  if (typeof o.lineId === "string") out.lineId = o.lineId;
  if (typeof o.sub === "string") out.sub = o.sub;
  if (typeof o.campaignId === "string") out.campaignId = o.campaignId;
  if (typeof o.campaignLock === "boolean") out.campaignLock = o.campaignLock;
  if (Array.isArray(o.places)) out.places = o.places.filter((p) => p && typeof p === "object" && typeof (p as { kind?: unknown }).kind === "string").slice(0, 30) as PlacePick[];
  out.core = strs(o.core, 20);
  out.custom = strs(o.custom, 30);
  if (o.industryMap && typeof o.industryMap === "object") {
    out.industryMap = Object.fromEntries(Object.entries(o.industryMap as Record<string, unknown>).filter(([, val]) => val === null || typeof val === "string").slice(0, 40)) as Record<string, string | null>;
  }
  out.roles = strs(o.roles, 30);
  out.employees = strs(o.employees, 12);
  if (o.revenue === "small" || o.revenue === "icp" || o.revenue === "any") out.revenue = o.revenue;
  if (o.emailType === "work" || o.emailType === "any") out.emailType = o.emailType;
  if (typeof o.maxPerCompany === "number") out.maxPerCompany = Math.min(5, Math.max(1, Math.round(o.maxPerCompany)));
  if (typeof o.limit === "number") out.limit = Math.min(200, Math.max(5, Math.round(o.limit)));
  for (const k of ["extraTitles", "excludeNote", "keyword", "name"] as const) if (typeof o[k] === "string") out[k] = (o[k] as string).slice(0, 400);
  for (const k of Object.keys(out) as (keyof LaunchFormState)[]) if (out[k] === undefined) delete out[k];
  return out;
}
