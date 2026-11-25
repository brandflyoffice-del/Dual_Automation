// Server-only. Turns the industries a person typed into LinkedIn industry names the people search understands.
// Rules first (src/lib/places.ts), then OpenAI for whatever the rules do not know, choosing ONLY from the checked list.
// null = nothing fits; the search then uses the typed word as a headline keyword (wf1 does that only when no industry maps).
import { apifyIndustryFor } from "@/lib/places";
import { LINKEDIN_INDUSTRIES, linkedinIndustry } from "@/lib/linkedin-industries";
import { integrationValue } from "@/lib/integrations";

export type IndustryMap = Record<string, string | null>; // key = typed industry, lower case

export async function openAiConfig(): Promise<{ key: string; model: string } | null> {
  const key = await integrationValue("OPENAI_API_KEY");
  return key ? { key, model: (await integrationValue("OPENAI_MODEL")) || "gpt-4o" } : null;
}

/** One chat call that must answer JSON. Returns null on any problem (no key, credit, timeout, bad JSON). */
export async function askJson(system: string, user: string, effort: "low" | "medium" = "low"): Promise<Record<string, unknown> | null> {
  const ai = await openAiConfig();
  if (!ai) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${ai.key}`, "content-type": "application/json" },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        model: ai.model,
        // reasoning models (gpt-5.x, gpt-6.x) take no temperature but accept reasoning_effort
        ...(/^(gpt-4|gpt-3\.5|chatgpt-4o)/i.test(ai.model) ? { temperature: 0 } : { reasoning_effort: effort }),
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return JSON.parse(body.choices?.[0]?.message?.content || "{}") as Record<string, unknown>;
  } catch {
    return null;
  }
}

const norm = (s: string) => s.replace(/^[-–•\s]+/, "").trim();

/** Rules, then AI for the rest. Never throws; an industry nothing fits maps to null. */
export async function mapIndustries(labels: string[]): Promise<{ map: IndustryMap; usedAi: boolean }> {
  const map: IndustryMap = {};
  const unknown: string[] = [];
  for (const raw of [...new Set(labels.map(norm).filter((l) => l.length >= 2))].slice(0, 30)) {
    const rule = apifyIndustryFor(raw);
    if (rule) map[raw.toLowerCase()] = rule;
    else unknown.push(raw);
  }
  if (!unknown.length) return { map, usedAi: false };

  const out = await askJson(
    `You map business industries typed by a salesperson to LinkedIn industry names, for a B2B people search.
Return ONLY JSON: {"map": {"<typed industry exactly as given>": "<one name from LIST>" | null}}.
Rules: choose the single best fitting name from LIST, copied exactly. Prefer the broader industry the typed business sits in (e.g. "Pest Control" -> "Facilities Services", "Barber Shops" -> "Wellness and Fitness Services", "Spas" -> "Wellness and Fitness Services", "Waste Management" -> "Environmental Services", "Moving Companies" -> "Transportation, Logistics, Supply Chain and Storage"). Use null only when nothing in LIST fits at all. Never invent a name.
LIST: ${JSON.stringify(LINKEDIN_INDUSTRIES)}`,
    JSON.stringify(unknown),
  );
  const got = ((out?.map ?? {}) as Record<string, unknown>) || {};
  for (const u of unknown) {
    const picked = linkedinIndustry(got[u] ?? Object.entries(got).find(([k]) => k.toLowerCase() === u.toLowerCase())?.[1]);
    map[u.toLowerCase()] = picked ?? null;
  }
  return { map, usedAi: !!out };
}
