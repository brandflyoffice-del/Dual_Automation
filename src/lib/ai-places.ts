// Model output → known places (shared by "Fill with AI" and "Fix filters with AI"). Pure functions, server or browser.
import { CITY_LIST, COUNTRY_BY_CODE, COUNTRY_LIST, type PlacePick } from "@/lib/places";

export const clean = (v: unknown, max = 60) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** A city we list keeps its country; an unknown city with a valid country code is still searchable. */
export function toPlaces(raw: unknown): PlacePick[] | null {
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
