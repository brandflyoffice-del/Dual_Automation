// Server-only: are the paid services able to work right now? Shown as a dashboard banner, in the sidebar and in
// Settings > Integrations, so the client knows when to top up. Launch also checks OpenAI and Apify first, so an
// out-of-credit service never burns the other one's credit (Apify charged for people the AI could not write to).
import { integrationValue, testIntegration } from "@/lib/integrations";

export type HealthLevel = "ok" | "warn" | "error";
export type ServiceHealth = {
  service: "OpenAI" | "Apify" | "Smartlead" | "Cal.com";
  level: HealthLevel;
  /** One short line for the banner / list. */
  detail: string;
  /** Who is affected when it is down. */
  affects: string;
  /** Where to top up or fix it. */
  fix: { label: string; href: string };
  usage?: { usedUsd: number; limitUsd: number; resetsAt: string | null };
};
export type HealthReport = { checkedAt: string; services: ServiceHealth[] };

const TTL_MS = 15 * 60_000;
const g = globalThis as unknown as { __serviceHealth?: HealthReport };

const BILLING = {
  OpenAI: { label: "Add OpenAI credit", href: "https://platform.openai.com/settings/organization/billing/overview" },
  Apify: { label: "Open Apify billing", href: "https://console.apify.com/billing" },
  Smartlead: { label: "Open Smartlead", href: "https://app.smartlead.ai/app/settings/profile" },
  "Cal.com": { label: "Open Cal.com API keys", href: "https://app.cal.com/settings/developer/api-keys" },
} as const;

async function openAi(): Promise<ServiceHealth> {
  const base = { service: "OpenAI" as const, affects: "Writing outreach emails and answering replies", fix: BILLING.OpenAI };
  const t = await testIntegration("OPENAI_API_KEY");
  if (t.ok) return { ...base, level: "ok", detail: "Credit available" };
  if (/no credit/i.test(t.detail)) return { ...base, level: "error", detail: "Out of credit: launches and AI replies are stopped until it is topped up" };
  if (/rate-limit/i.test(t.detail)) return { ...base, level: "warn", detail: "Busy right now (rate limit); it usually clears in a few minutes" };
  return { ...base, level: "error", detail: t.detail === "No key set" ? "No API key set" : t.detail, fix: { label: "Fix the key", href: "/settings?tab=integrations" } };
}

async function apify(): Promise<ServiceHealth> {
  const base = { service: "Apify" as const, affects: "Finding new leads when you launch", fix: BILLING.Apify };
  const token = await integrationValue("APIFY_TOKEN");
  if (!token) return { ...base, level: "error", detail: "No API token set", fix: { label: "Add the token", href: "/settings?tab=integrations" } };
  try {
    const r = await fetch(`https://api.apify.com/v2/users/me/limits?token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
    if (r.status === 401) return { ...base, level: "error", detail: "Apify rejected the token", fix: { label: "Fix the token", href: "/settings?tab=integrations" } };
    const d = ((await r.json()) as { data?: { monthlyUsageCycle?: { endAt?: string }; limits?: { maxMonthlyUsageUsd?: number }; current?: { monthlyUsageUsd?: number } } }).data;
    const used = Number(d?.current?.monthlyUsageUsd ?? 0);
    const limit = Number(d?.limits?.maxMonthlyUsageUsd ?? 0);
    const usage = { usedUsd: Math.round(used * 100) / 100, limitUsd: limit, resetsAt: d?.monthlyUsageCycle?.endAt ?? null };
    if (!limit) return { ...base, level: "ok", detail: `$${usage.usedUsd.toFixed(2)} used this month`, usage };
    const left = limit - used;
    const msg = `$${usage.usedUsd.toFixed(2)} of $${limit} used this month ($${Math.max(0, left).toFixed(2)} left)`;
    if (left <= 0.5) return { ...base, level: "error", detail: `Monthly limit reached: ${msg}. Lead searches stop until it resets or the plan is raised`, usage };
    if (left < Math.max(2, limit * 0.15)) return { ...base, level: "warn", detail: `Running low: ${msg}`, usage };
    return { ...base, level: "ok", detail: msg, usage };
  } catch {
    return { ...base, level: "warn", detail: "Could not reach Apify to check usage" };
  }
}

async function simple(service: "Smartlead" | "Cal.com", key: "SMARTLEAD_API_KEY" | "CAL_API_KEY", affects: string): Promise<ServiceHealth> {
  const t = await testIntegration(key);
  return t.ok
    ? { service, affects, fix: BILLING[service], level: "ok", detail: t.detail }
    : { service, affects, fix: { label: "Fix the key", href: "/settings?tab=integrations" }, level: /reach/i.test(t.detail) ? "warn" : "error", detail: t.detail };
}

/** All services, cached for 15 minutes (force = check now). */
export async function serviceHealth(force = false): Promise<HealthReport> {
  const c = g.__serviceHealth;
  if (!force && c && Date.now() - new Date(c.checkedAt).getTime() < TTL_MS) return c;
  const services = await Promise.all([
    openAi(),
    apify(),
    simple("Smartlead", "SMARTLEAD_API_KEY", "Sending emails, inbox and email analytics"),
    simple("Cal.com", "CAL_API_KEY", "Offering meeting times and booking meetings"),
  ]);
  const report = { checkedAt: new Date().toISOString(), services };
  g.__serviceHealth = report;
  return report;
}

/** Before a launch: OpenAI must have credit and Apify must have room, or the launch would pay for leads it cannot use. */
export async function launchBlocker(provider: string): Promise<string | null> {
  const checks = [openAi(), ...(provider === "apify" ? [apify()] : [])];
  const res = await Promise.all(checks);
  const bad = res.find((s) => s.level === "error");
  if (!bad) return null;
  // refresh the cached report so the banner shows the same thing
  if (g.__serviceHealth) g.__serviceHealth = { ...g.__serviceHealth, services: g.__serviceHealth.services.map((s) => res.find((x) => x.service === s.service) ?? s) };
  return `${bad.service}: ${bad.detail}. The launch was not started, so no lead credit was spent. ${bad.fix.label}: ${bad.fix.href}`;
}
