import { NextResponse } from "next/server";
import { z } from "zod";
import { EMPLOYEE_RANGES, ICP, INDUSTRY_LABEL, ROLE_OPTIONS } from "@/lib/constants";
import { CITY_LIST, COUNTRY_BY_CODE, COUNTRY_LIST, INDUSTRY_SUGGESTIONS, type PlacePick } from "@/lib/places";
import { getSetting } from "@/lib/settings";
import { integrationValue } from "@/lib/integrations";

export const dynamic = "force-dynamic";

const schema = z.object({
  text: z.string().trim().min(3).max(500),
  form: z.record(z.string(), z.unknown()).optional(),
});

/** What the form receives. null = "the sentence says nothing about this, keep what the form has". */
export type AiFill = {
  cleanedSentence: string;
  name: string | null;
  howMany: number | null;
  places: PlacePick[] | null;
  coreIndustries: string[] | null;
  customIndustries: string[] | null;
  lineId: string | null;
  subService: string | null;
  newSubService: string | null;
  roles: string[] | null;
  extraTitles: string[] | null;
  excludeTitles: string[] | null;
  employees: string[] | null;
  anyRevenue: boolean | null;
  emailType: "work" | "any" | null;
  maxPerCompany: number | null;
  keyword: string | null;
  note: string;
  model: boolean;
};

// Settings > Integrations first, else the server config (src/lib/integrations.ts).
async function openAi(): Promise<{ key: string; model: string } | null> {
  const key = await integrationValue("OPENAI_API_KEY");
  return key ? { key, model: (await integrationValue("OPENAI_MODEL")) || "gpt-4o" } : null;
}

const CORE_KEYS = ICP.industries as readonly string[];
const ROLE_KEYS = ROLE_OPTIONS.map((r) => r.id);
const SIZE_KEYS = EMPLOYEE_RANGES.map((e) => e.id);
const clean = (v: unknown, max = 60) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const list = (v: unknown, max = 8, len = 60) =>
  (Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : []).map((x) => clean(x, len)).filter((x) => x.length >= 2).slice(0, max);
const subset = (v: unknown, allowed: readonly string[]) => {
  if (!Array.isArray(v)) return null;
  const hit = [...new Set(v.map((x) => String(x).trim()).filter((x) => allowed.includes(x)))];
  return hit.length ? hit : null;
};

/** Model output → known places. A city we list keeps its country; an unknown city with a valid country code is still searchable. */
function toPlaces(raw: unknown): PlacePick[] | null {
  if (!Array.isArray(raw) || !raw.length) return null;
  const out: PlacePick[] = [];
  for (const r of raw.slice(0, 10)) {
    const o = (r ?? {}) as Record<string, unknown>;
    const name = clean(o.name, 60);
    const code = clean(o.country, 2).toLowerCase();
    if (name.length < 2) continue;
    const country = COUNTRY_LIST.find((c) => c.name.toLowerCase() === name.toLowerCase() || (o.kind === "country" && c.code === code));
    if (country && o.kind !== "city") {
      out.push({ kind: "country", code: country.code });
      continue;
    }
    const city = CITY_LIST.find((c) => c.name.toLowerCase() === name.toLowerCase() && (!code || c.code === code));
    if (city) out.push({ kind: "city", name: city.name, code: city.code, area: city.area });
    else if (COUNTRY_BY_CODE[code]) out.push({ kind: "city", name, code });
    else out.push({ kind: "custom", name });
  }
  return out.length ? out : null;
}

/** No OpenAI key: still pick up a number, places and industries we know by name. Nothing is guessed. */
function fallback(text: string): AiFill {
  const lower = ` ${text.toLowerCase()} `;
  const count = Number((lower.match(/\b(\d{1,4})\b/) || [])[1] || "");
  const has = (w: string) => new RegExp(`[^a-z]${w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^a-z]`).test(lower);
  const places: PlacePick[] = [
    ...CITY_LIST.filter((c) => has(c.name)).map((c): PlacePick => ({ kind: "city", name: c.name, code: c.code, area: c.area })),
    ...COUNTRY_LIST.filter((c) => has(c.name)).map((c): PlacePick => ({ kind: "country", code: c.code })),
  ].slice(0, 8);
  const custom = INDUSTRY_SUGGESTIONS.filter((s) => s.label.split(/[^A-Za-z]+/).some((w) => w.length >= 4 && lower.includes(w.toLowerCase().slice(0, 5)))).map((s) => s.label);
  return {
    cleanedSentence: text,
    name: null,
    howMany: count >= 5 && count <= 200 ? count : null,
    places: places.length ? places : null,
    coreIndustries: custom.length ? [] : null,
    customIndustries: custom.length ? custom.slice(0, 3) : null,
    lineId: null,
    subService: null,
    newSubService: null,
    roles: null,
    extraTitles: null,
    excludeTitles: null,
    employees: null,
    anyRevenue: null,
    emailType: null,
    maxPerCompany: null,
    keyword: null,
    note: "The AI was not available, so only the number, places and industries named in your sentence were filled.",
    model: false,
  };
}

/** Launch form "Fill with AI": reads one sentence and fills every field it implies. Fields it says nothing about stay as they are. */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Write a sentence first, e.g. Find 50 jewellery companies in Hyderabad" }, { status: 400 });
  const text = parsed.data.text;
  const ai = await openAi();
  if (!ai) return NextResponse.json(fallback(text));

  const lines = (await getSetting("service_lines")).value;
  const catalog = {
    CORE_INDUSTRIES: CORE_KEYS.map((k) => ({ key: k, label: INDUSTRY_LABEL[k as keyof typeof INDUSTRY_LABEL] })),
    SUGGESTED_INDUSTRIES: INDUSTRY_SUGGESTIONS.map((s) => s.label),
    LINES: lines.map((l) => ({ id: l.id, name: l.name, items: l.items.map((i) => i.name) })),
    ROLES: ROLE_OPTIONS.map((r) => ({ id: r.id, group: r.group })),
    SIZES: EMPLOYEE_RANGES.map((e) => e.id),
  };

  const system = `You fill a B2B lead-search form from ONE sentence written by a salesperson (it may be in English, Hinglish or Hindi). Return ONLY this JSON:
{"cleanedSentence":"","name":"","howMany":null,"places":[{"name":"","kind":"city","country":""}],"coreIndustries":null,"customIndustries":null,"lineId":null,"subService":null,"newSubService":null,"roles":null,"extraTitles":null,"excludeTitles":null,"employees":null,"anyRevenue":null,"emailType":null,"maxPerCompany":null,"keyword":"","note":""}
Rules (null means "the sentence does not say, keep the form as it is"):
- cleanedSentence: the sentence in clear English with spelling fixed (hydrabad -> Hyderabad, jewelery -> jewellery).
- places: every city, state or country named. kind is "city" (also for a state/area) or "country"; country is the ISO 3166-1 alpha-2 code in lower case (Hyderabad -> "in", Dubai -> "ae", London -> "gb"). [] if none is named.
- howMany: the number of companies or people asked for, clamped to 5..200, else null.
- If a kind of business is named: coreIndustries = keys from CORE_INDUSTRIES only when it clearly is one of them, otherwise []; customIndustries = short Title Case English names for the rest (prefer an exact label from SUGGESTED_INDUSTRIES, e.g. "Jewelry"). If no business is named, both null.
- lineId: a LINES id only when the sentence says what WE want to sell them (e.g. "sell them SEO" -> the SEO line). subService: an exact item of that line when one fits. newSubService: a short name when the sentence names a specific service that is not in the items. Otherwise null.
- roles: ROLES ids when the sentence names job roles ("owners" -> Owner, Founder; "CTOs" -> CTO). Titles not in ROLES go to extraTitles. If no role is named, null.
- employees: SIZES ids only when size is stated: "small" -> 1,10 to 51,100; "startups" -> 1,10 to 21,50; "mid-size" -> 51,100 to 501,1000; "large"/"enterprise" -> 201,500 to 1001,5000. Else null.
- anyRevenue: true when the sentence asks for large/enterprise companies or any revenue; else null.
- emailType: "any" only when personal emails are allowed; else null. maxPerCompany: only when stated (1..5); else null.
- keyword: one technology or niche word the companies must mention when stated ("using Shopify" -> "Shopify"); else "".
- excludeTitles: titles the sentence says to skip; else null.
- name: a short batch name such as "Hyderabad jewellery - 50" (max 60 chars).
- note: one short plain sentence saying what you filled and anything you could not map.
Never invent places, industries, numbers or services that the sentence does not imply.
CATALOG: ${JSON.stringify(catalog)}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${ai.key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: ai.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: text },
        ],
      }),
    });
    if (!res.ok) return NextResponse.json(fallback(text));
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = JSON.parse(body.choices?.[0]?.message?.content || "{}") as Record<string, unknown>;

    const howNum = raw.howMany == null || raw.howMany === "" ? null : Number(raw.howMany);
    const line = lines.find((l) => l.id === raw.lineId) ?? null;
    const sub = line && typeof raw.subService === "string" ? line.items.find((i) => i.name.toLowerCase() === String(raw.subService).toLowerCase())?.name ?? null : null;
    const custom = raw.customIndustries == null ? null : list(raw.customIndustries, 6, 60).map((c) => INDUSTRY_SUGGESTIONS.find((s) => s.label.toLowerCase() === c.toLowerCase())?.label ?? c);
    const core = raw.coreIndustries == null ? null : subset(raw.coreIndustries, CORE_KEYS) ?? [];
    const named = custom !== null || (core !== null && core.length > 0);
    const out: AiFill = {
      cleanedSentence: clean(raw.cleanedSentence || text, 500),
      name: clean(raw.name, 60) || null,
      howMany: howNum != null && Number.isFinite(howNum) ? Math.min(200, Math.max(5, Math.round(howNum))) : null,
      places: toPlaces(raw.places),
      coreIndustries: named ? core ?? [] : null,
      customIndustries: named ? custom ?? [] : null,
      lineId: line?.id ?? null,
      subService: sub,
      newSubService: line && !sub && raw.newSubService ? clean(raw.newSubService, 80) || null : null,
      roles: subset(raw.roles, ROLE_KEYS),
      extraTitles: raw.extraTitles == null ? null : list(raw.extraTitles, 6, 40),
      excludeTitles: raw.excludeTitles == null ? null : list(raw.excludeTitles, 6, 40),
      employees: subset(raw.employees, SIZE_KEYS),
      anyRevenue: raw.anyRevenue === true ? true : null,
      emailType: raw.emailType === "any" ? "any" : null,
      maxPerCompany: raw.maxPerCompany == null ? null : Math.min(5, Math.max(1, Number(raw.maxPerCompany) || 2)),
      keyword: clean(raw.keyword, 60) || null,
      note: clean(raw.note || "Filled from your sentence.", 280),
      model: true,
    };
    return NextResponse.json(out);
  } catch {
    return NextResponse.json(fallback(text));
  }
}
