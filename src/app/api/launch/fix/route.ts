import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { APIFY_MAX_TITLES, EMPLOYEE_RANGES, ICP, INDUSTRY_LABEL, ROLE_OPTIONS, apifyTitleList, type Industry } from "@/lib/constants";
import { clean, toPlaces } from "@/lib/ai-places";
import { askJson, mapIndustries } from "@/lib/industry-map";
import { readLaunchForm, type LaunchFormState } from "@/lib/launch-form";
import { placeLabel } from "@/lib/places";

export const dynamic = "force-dynamic";

const schema = z.object({ runId: z.string().uuid().optional(), form: z.record(z.string(), z.unknown()) });

const CORE_KEYS = ICP.industries as readonly string[];
const ROLE_KEYS = ROLE_OPTIONS.map((r) => r.id);
const SIZE_KEYS = EMPLOYEE_RANGES.map((e) => e.id);
const strip = (s: string) => clean(s.replace(/^[-–•*\s]+/, ""), 60);
const subset = (v: unknown, allowed: readonly string[]) => (Array.isArray(v) ? [...new Set(v.map((x) => String(x).trim()).filter((x) => allowed.includes(x)))] : null);
const words = (v: unknown, max: number) => (Array.isArray(v) ? [...new Set(v.map((x) => strip(String(x))).filter((x) => x.length >= 2))].slice(0, max) : null);

/**
 * Launch card "Fix filters with AI": reads the filters of a launch that found nobody (and what the search said), and
 * returns the same form with the blocking filters repaired or widened, plus a plain-language list of what changed.
 * Nothing is launched here: the form opens with the changes and the person presses Launch.
 */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Send the launch filters" }, { status: 400 });
  const form = readLaunchForm(parsed.data.form);
  if (!form) return NextResponse.json({ error: "These filters could not be read" }, { status: 400 });
  const run = parsed.data.runId ? await db.launchRun.findUnique({ where: { id: parsed.data.runId } }).catch(() => null) : null;

  const changes: string[] = [];
  const before: Partial<LaunchFormState> = JSON.parse(JSON.stringify(form));
  const next: Partial<LaunchFormState> = { ...form };

  // 1. Always: tidy typed industries (a leading "-" from a pasted list), and drop the headline word. Apify requires BOTH the
  //    headline word and the industry to match, which is the usual reason a search finds nobody.
  const custom0 = (form.custom ?? []).map(strip).filter((x) => x.length >= 2);
  if (custom0.join("|") !== (form.custom ?? []).join("|")) changes.push("Cleaned up the typed industries (removed stray dashes and duplicates).");
  next.custom = [...new Set(custom0)];
  if (form.keyword?.trim()) {
    changes.push(`Removed the "must mention ${form.keyword.trim()}" word: the search needs it on every person's headline, which cuts the results a lot.`);
    next.keyword = "";
  }

  // 2. AI: what else blocks the search, and how to widen it without changing what is being sold.
  const diagnosis = run
    ? `Stage "${run.stage}". Found ${run.found}, matched the filters ${run.matched}, already in the list ${run.known}. Message shown to the user: "${run.message || "none"}".`
    : "The previous launch added no new leads.";
  const titlesUsed = (apifyTitleList(form.roles ?? [], form.extraTitles ?? "") as string[]).length;
  const out = await askJson(
    `You repair the filters of a B2B lead search that found no NEW people. Return ONLY JSON:
{"customIndustries":[string]|null,"coreIndustries":[string]|null,"roles":[string]|null,"extraTitles":string|null,"employees":[string]|null,"revenue":"any"|null,"maxPerCompany":number|null,"places":[{"name":"","kind":"city","country":""}]|null,"clearSkipTitles":boolean,"changes":[string],"note":string}
How the search works: every filter must match at the same time (people's job titles, company industry, company size, country or city). People found by earlier launches are skipped, so an old filter set eventually runs dry: that is the usual reason for "no new leads". Each typed industry is later turned into a LinkedIn industry, so write typed industries as plain business types ("Dental Clinics", "HVAC", "Med Spas").
What to do: keep the intent of the search (what is sold, the market, the kind of buyer). Make the SMALLEST changes that should bring new people: add 2-4 closely related business types to customIndustries (keep the existing ones, fix typos, remove junk); add 1-3 related decision-maker roles from ROLES; add adjacent company sizes from SIZES; set revenue to "any" if revenue was restricting; raise maxPerCompany by 1 (max 5) if it is 1-2; if places are only one or two cities or a small state, add the state or neighbouring metro areas; clearSkipTitles true only if skip-titles are set and look too broad. Use null for anything you leave unchanged. At most ${APIFY_MAX_TITLES} job titles are searched (each role is one) and ${titlesUsed} are already used: add a role ONLY if a slot is free, otherwise leave roles null.
"changes": one short plain sentence per change you made, written for a salesperson (no jargon, no field names). "note": one sentence on why the last search found nobody.
ROLES: ${JSON.stringify(ROLE_KEYS)}  SIZES: ${JSON.stringify(EMPLOYEE_RANGES.map((e) => ({ id: e.id, label: e.label })))}  CORE_INDUSTRIES: ${JSON.stringify(CORE_KEYS.map((k) => ({ key: k, label: INDUSTRY_LABEL[k as Industry] })))}`,
    `Current filters: ${JSON.stringify({
      places: (form.places ?? []).map(placeLabel),
      coreIndustries: form.core ?? [],
      customIndustries: next.custom,
      roles: form.roles ?? [],
      extraTitles: form.extraTitles ?? "",
      skipTitles: form.excludeNote ?? "",
      companySizes: form.employees ?? [],
      revenue: form.revenue ?? "icp",
      maxPerCompany: form.maxPerCompany ?? 2,
      provider: form.provider ?? "apify",
      selling: form.sub && form.sub !== "ANY" ? form.sub : form.lineId,
    })}\nWhat happened: ${diagnosis}`,
    "medium",
  );

  if (out) {
    const cust = words(out.customIndustries, 20);
    if (cust && cust.length) next.custom = [...new Set([...(next.custom ?? []), ...cust])].slice(0, 20);
    const core = subset(out.coreIndustries, CORE_KEYS);
    if (core && core.length) next.core = [...new Set([...(form.core ?? []), ...core])];
    const roles = subset(out.roles, ROLE_KEYS);
    if (roles && roles.length) next.roles = [...new Set([...(form.roles ?? []), ...roles])];
    const sizes = subset(out.employees, SIZE_KEYS);
    if (sizes && sizes.length) next.employees = [...new Set([...(form.employees ?? []), ...sizes])];
    if (out.revenue === "any" && form.revenue !== "any") next.revenue = "any";
    const mpc = Number(out.maxPerCompany);
    if (Number.isFinite(mpc) && mpc > (form.maxPerCompany ?? 2)) next.maxPerCompany = Math.min(5, Math.round(mpc));
    if (typeof out.extraTitles === "string" && out.extraTitles.trim()) next.extraTitles = clean(out.extraTitles, 400);
    const places = toPlaces(out.places);
    if (places && places.length) next.places = places.slice(0, 10);
    if (out.clearSkipTitles === true && form.excludeNote?.trim()) next.excludeNote = "";
    for (const c of Array.isArray(out.changes) ? out.changes : []) {
      const t = clean(c, 220);
      if (t.length > 4) changes.push(t);
    }
  }

  // 3. Apify takes at most 10 job titles: drop the roles that were just added before the oldest ones.
  if ((next.provider ?? form.provider) === "apify" || (next.provider ?? form.provider) === undefined) {
    const original = form.roles ?? [];
    let roles = next.roles ?? original;
    while (roles.length > original.length && (apifyTitleList(roles, next.extraTitles ?? "") as string[]).length > APIFY_MAX_TITLES) roles = roles.slice(0, -1);
    const dropped = (next.roles ?? original).filter((r) => !roles.includes(r));
    next.roles = roles;
    // A change that talks about a role that did not fit must not be reported.
    for (const r of dropped) for (let i = changes.length - 1; i >= 0; i--) if (changes[i].toLowerCase().includes(r.toLowerCase())) changes.splice(i, 1);
  }

  // 4. Every typed industry → a LinkedIn industry (rules first, then AI from the checked list).
  const { map, usedAi } = await mapIndustries(next.custom ?? []);
  next.industryMap = { ...(form.industryMap ?? {}), ...map };
  const shown = (next.custom ?? []).filter((c) => map[c.toLowerCase()] !== undefined).slice(0, 5);
  if (shown.length) {
    changes.push(
      `Each industry is now searched by its LinkedIn category: ${shown.map((c) => `${c} → ${map[c.toLowerCase()] ?? "headline word (no category fits)"}`).join("; ")}${(next.custom ?? []).length > shown.length ? "…" : ""}.`,
    );
  }

  const patchKeys = (Object.keys(next) as (keyof LaunchFormState)[]).filter((k) => JSON.stringify(next[k]) !== JSON.stringify(before[k]));
  const note = clean(out?.note, 280) || (run?.message ? clean(run.message, 280) : "The previous search found no new people.");
  return NextResponse.json({
    patch: Object.fromEntries(patchKeys.map((k) => [k, next[k]])),
    changes: changes.length ? changes : ["The filters already look fine; try a different place, industry or role."],
    note,
    usedAi: !!out || usedAi,
    aiAvailable: !!out,
  });
}
