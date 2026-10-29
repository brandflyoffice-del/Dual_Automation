import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ICP } from "@/lib/constants";

export const dynamic = "force-dynamic";

const schema = z.object({
  text: z.string().trim().max(500).optional().default(""),
  form: z
    .object({
      name: z.string().max(80).optional().default(""),
      places: z.string().max(300).optional().default(""),
      industryQuery: z.string().max(80).optional().default(""),
      offering: z.string().max(80).optional().default(""),
      keyword: z.string().max(80).optional().default(""),
      extraTitles: z.string().max(120).optional().default(""),
      excludeNote: z.string().max(120).optional().default(""),
      regions: z.array(z.string()).optional().default([]),
      europeCountries: z.array(z.string()).optional().default([]),
      industries: z.array(z.string()).optional().default([]),
      roles: z.array(z.string()).optional().default([]),
      employees: z.array(z.string()).optional().default([]),
      service: z.string().max(40).optional().default("AUTO"),
      emailType: z.enum(["work", "any"]).optional().default("work"),
      maxPerCompany: z.number().int().min(1).max(5).optional().default(2),
      limit: z.number().int().min(5).max(200).optional().default(40),
    })
    .optional(),
});

function openAi(): { key: string; model: string } | null {
  const fromEnv = process.env.OPENAI_API_KEY?.trim();
  if (fromEnv) return { key: fromEnv, model: process.env.OPENAI_MODEL?.trim() || "gpt-4o" };
  try {
    const cfg = JSON.parse(readFileSync(join(process.cwd(), "n8n", "config.local.json"), "utf8")) as {
      OPENAI_API_KEY?: string;
      OPENAI_MODEL?: string;
    };
    const key = cfg.OPENAI_API_KEY?.trim();
    if (!key) return null;
    return { key, model: cfg.OPENAI_MODEL?.trim() || "gpt-4o" };
  } catch {
    return null;
  }
}

function fallback(text: string) {
  const lower = text.toLowerCase();
  const count = Number((lower.match(/\b(\d{1,4})\b/) || [])[1] || "");
  return {
    cleanedSentence: text.trim(),
    howMany: count >= 5 && count <= 200 ? count : null,
    places: [] as string[],
    industryQuery: "",
    industries: null as string[] | null,
    offering: "",
    extraTitles: [] as string[],
    excludeTitles: [] as string[],
    roles: [...ICP.roles],
    note: "I could not check this with the model, so nothing was guessed. Decision-makers stay selected.",
    model: false,
  };
}

/** Checks a filled launch form. Fixes spelling and fills a blank only when the sentence already says it. */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Could not read the form" }, { status: 400 });
  const text = parsed.data.text;
  const form = parsed.data.form;
  if (text.length < 3 && !form?.places && !form?.industryQuery && !form?.name) {
    return NextResponse.json({ error: "Add a sentence or a place first" }, { status: 400 });
  }
  const ai = openAi();
  if (!ai) return NextResponse.json({ ...fallback(text), form });

  const system = `You check one filled BrandFly search form. Return only this JSON shape:
{"cleanedSentence":"","name":"","places":[],"howMany":null,"industryQuery":"","offering":"","keyword":"","extraTitles":[],"excludeTitles":[],"regions":[],"europeCountries":[],"industries":[],"roles":[],"employees":[],"emailType":"work","maxPerCompany":2,"service":"AUTO","note":""}
Fix spelling in the sentence and in text fields. Example: hydrabad becomes Hyderabad, peple becomes people, jewelery becomes jewelry.
If the sentence gives a number of people, set howMany to that number.
If the sentence or the places field names a city, put the corrected city in places.
Do not add a city, industry, or number that was not written.
If the sentence names a kind of business, put those corrected words in industryQuery. Otherwise leave industryQuery empty and copy industries unchanged.
Copy regions, roles, employees, and europeCountries back unchanged.
note is "Looks right." or one sentence naming the spelling you fixed.`;

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
          { role: "user", content: JSON.stringify({ sentence: text, form: form ?? {} }) },
        ],
      }),
    });
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    if (!res.ok) return NextResponse.json({ ...fallback(text), form });
    const raw = JSON.parse(body.choices?.[0]?.message?.content || "{}") as Record<string, unknown>;
    const howRaw = raw.howMany ?? raw.limit;
    const howNum = howRaw == null || howRaw === "" ? null : Number(howRaw);
    const howMany = howNum != null && Number.isFinite(howNum) ? Math.min(200, Math.max(5, Math.round(howNum))) : null;
    const places = (Array.isArray(raw.places) ? raw.places : typeof raw.places === "string" ? raw.places.split(",") : [])
      .map((p) => String(p).trim())
      .filter((p) => p.length >= 2 && p.length <= 60)
      .slice(0, 8);
    const keep = (value: unknown, allowed: readonly string[]) => {
      const list = (Array.isArray(value) ? value : []).map((v) => String(v).trim()).filter((v) => allowed.includes(v));
      return list.length ? list : null;
    };
    const words = (value: unknown) =>
      (Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [])
        .map((v) => String(v).trim())
        .filter((v) => v.length >= 2 && v.length <= 40)
        .slice(0, 6);
    return NextResponse.json({
      cleanedSentence: String(raw.cleanedSentence || text).slice(0, 500),
      name: String(raw.name || form?.name || "").trim().slice(0, 80),
      howMany: howMany && howMany >= 5 ? howMany : null,
      places,
      industryQuery: String(raw.industryQuery || "").trim().slice(0, 80),
      industries: keep(raw.industries, ICP.industries),
      offering: String(raw.offering || "").trim().slice(0, 80),
      keyword: String(raw.keyword || "").trim().slice(0, 80),
      extraTitles: words(raw.extraTitles),
      excludeTitles: words(raw.excludeTitles),
      roles: keep(raw.roles, ICP.roles) || [...ICP.roles],
      regions: keep(raw.regions, ICP.regions),
      europeCountries: keep(raw.europeCountries, ["de", "fr", "nl", "es", "it", "se", "ie", "dk", "be", "ch", "at", "pl", "pt", "fi", "no"]),
      employees: keep(raw.employees, ["1,10", "11,20", "21,50", "51,100", "101,200"]),
      emailType: raw.emailType === "any" ? "any" : "work",
      maxPerCompany: Math.min(5, Math.max(1, Number(raw.maxPerCompany) || form?.maxPerCompany || 2)),
      service: String(raw.service || form?.service || "AUTO").slice(0, 40),
      note: String(raw.note || "Looks right.").trim().slice(0, 280),
      model: true,
    });
  } catch {
    return NextResponse.json({ ...fallback(text), form });
  }
}
