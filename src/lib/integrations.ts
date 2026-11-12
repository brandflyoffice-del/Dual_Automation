// Server-only: API keys managed in Settings > Integrations. Stored encrypted (AES-GCM, src/lib/secret-box.ts) in
// app_settings "integrations". The active value of each key is: saved in the dashboard, else the server config
// (n8n/config.local.json, mounted read-only into the container), else the environment. Never send these to the browser.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { open, seal } from "@/lib/secret-box";
import { INTEGRATION_FIELDS, INTEGRATION_KEYS, type IntegrationKey, type IntegrationStatus } from "@/lib/integrations-shared";

const SETTING = "integrations";
type Stored = Partial<Record<IntegrationKey, { v: string; at: string }>>;

let cache: { at: number; stored: Stored } | null = null;
const TTL_MS = 30_000;

function fileConfig(): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "n8n", "config.local.json"), "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function stored(): Promise<Stored> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.stored;
  let s: Stored = {};
  try {
    const row = await db.appSetting.findUnique({ where: { key: SETTING } });
    s = (row?.value as Stored | null) ?? {};
  } catch {
    // DB unreachable: fall back to the server config below
  }
  cache = { at: Date.now(), stored: s };
  return s;
}

function serverValue(key: IntegrationKey, cfg = fileConfig()): string {
  const v = process.env[key]?.trim() || String(cfg[key] ?? "").trim();
  return v;
}

function savedValue(s: Stored, key: IntegrationKey): string {
  const row = s[key];
  if (!row?.v) return "";
  try {
    return open(row.v).trim();
  } catch {
    return "";
  }
}

/** The active value of one key ("" when none is set anywhere). */
export async function integrationValue(key: IntegrationKey): Promise<string> {
  return savedValue(await stored(), key) || serverValue(key);
}

/** All active values (for n8n's run-time key lookup). */
export async function integrationValues(): Promise<Record<IntegrationKey, string>> {
  const s = await stored();
  const cfg = fileConfig();
  return Object.fromEntries(INTEGRATION_KEYS.map((k) => [k, savedValue(s, k) || serverValue(k, cfg)])) as Record<IntegrationKey, string>;
}

/** What the Settings page shows: where each key comes from and its last characters, never the key itself. */
export async function integrationStatus(): Promise<IntegrationStatus[]> {
  const s = await stored();
  const cfg = fileConfig();
  return INTEGRATION_FIELDS.map((f) => {
    const saved = savedValue(s, f.key);
    const value = saved || serverValue(f.key, cfg);
    const hint = !value ? "" : f.secret ? `••••${value.slice(-4)}` : value;
    return { key: f.key, source: saved ? "dashboard" : value ? "server" : "none", hint, updatedAt: saved ? (s[f.key]?.at ?? null) : null };
  });
}

/** Saves new values (a string sets the key, "" or null removes the dashboard value so the server one is used again). */
export async function saveIntegrations(patch: Partial<Record<IntegrationKey, string | null>>) {
  const s = { ...(await stored()) };
  const now = new Date().toISOString();
  for (const [k, v] of Object.entries(patch) as [IntegrationKey, string | null][]) {
    if (!INTEGRATION_KEYS.includes(k)) continue;
    const val = (v ?? "").trim();
    if (val) s[k] = { v: seal(val), at: now };
    else delete s[k];
  }
  const json = s as unknown as Prisma.InputJsonValue;
  await db.appSetting.upsert({ where: { key: SETTING }, create: { key: SETTING, value: json }, update: { value: json } });
  cache = { at: Date.now(), stored: s };
}

type TestResult = { ok: boolean; detail: string };

async function call(url: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000), cache: "no-store" });
  return { status: r.status, body: await r.json().catch(() => null) };
}

/** Checks a key against its service with a free read-only call. */
export async function testIntegration(key: IntegrationKey, value?: string): Promise<TestResult> {
  const v = (value ?? (await integrationValue(key))).trim();
  if (!v) return { ok: false, detail: "No key set" };
  try {
    if (key === "APIFY_TOKEN") {
      const r = await call(`https://api.apify.com/v2/users/me?token=${encodeURIComponent(v)}`);
      const d = (r.body as { data?: { username?: string; plan?: { id?: string } } } | null)?.data;
      return r.status === 200 ? { ok: true, detail: `Connected as ${d?.username ?? "?"} (${d?.plan?.id ?? "plan ?"})` } : { ok: false, detail: "Apify rejected this token" };
    }
    if (key === "SMARTLEAD_API_KEY") {
      const r = await call(`https://server.smartlead.ai/api/v1/campaigns?api_key=${encodeURIComponent(v)}`);
      return r.status === 200 && Array.isArray(r.body) ? { ok: true, detail: `Connected: ${r.body.length} campaigns` } : { ok: false, detail: "Smartlead rejected this key" };
    }
    if (key === "OPENAI_API_KEY") {
      const r = await call("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${v}` } });
      return r.status === 200 ? { ok: true, detail: "Connected" } : { ok: false, detail: r.status === 429 ? "OpenAI says the account is out of credit or rate-limited" : "OpenAI rejected this key" };
    }
    if (key === "CAL_API_KEY") {
      const r = await call("https://api.cal.com/v2/me", { headers: { Authorization: `Bearer ${v}`, "cal-api-version": "2024-08-13" } });
      const d = (r.body as { data?: { email?: string } } | null)?.data;
      return r.status === 200 ? { ok: true, detail: `Connected${d?.email ? ` as ${d.email}` : ""}` } : { ok: false, detail: "Cal.com rejected this key" };
    }
    return { ok: true, detail: "Saved. It is checked on the next launch." };
  } catch {
    return { ok: false, detail: "Could not reach the service. Try again in a minute." };
  }
}
