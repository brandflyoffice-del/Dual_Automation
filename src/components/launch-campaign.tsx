"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Check, ChevronDown, Info, Loader2, MapPin, Plus, Rocket, RotateCcw, Sparkles, Target, Users, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiPicker, type PickerOption } from "@/components/ui/multi-picker";
import {
  DEFAULT_EMPLOYEE_RANGES,
  EMPLOYEE_RANGES,
  ICP,
  INDUSTRY_LABEL,
  LEAD_PROVIDERS,
  LINE_ROLE_HINTS,
  LINE_SERVICE,
  OUTREACH_CAMPAIGNS,
  pickCampaign,
  ROLE_OPTIONS,
  type Industry,
  type LeadProvider,
} from "@/lib/constants";
import {
  apifyIndustryFor,
  CITY_LIST,
  COUNTRY_BY_CODE,
  COUNTRY_LIST,
  DEFAULT_PLACES,
  INDUSTRY_SUGGESTIONS,
  placeKey,
  placeLabel,
  placesPayload,
  REGION_PICKS,
  type PlacePick,
} from "@/lib/places";
import { cn } from "@/lib/utils";
import { CostEstimate, costLabel } from "@/components/cost-estimate";
import type { ServiceLine } from "@/lib/settings-shared";
import type { AiFill } from "@/app/api/leads/interpret/route";

const CORE = [...ICP.industries] as string[];
const PRESET_ROLES = ROLE_OPTIONS.filter((r) => r.preset).map((r) => r.id);
const ROLE_GROUPS = [...new Set(ROLE_OPTIONS.map((r) => r.group))];
const ADD_SUB = "__add__";

const PLACE_OPTIONS: PickerOption[] = [
  ...REGION_PICKS.map((r) => ({ key: `r:${r.id}`, label: r.label, detail: r.id === "EUROPE" ? "15 countries" : "Target market", group: "Target markets" })),
  ...COUNTRY_LIST.map((c) => ({ key: `c:${c.code}`, label: c.name, detail: "Country", group: "Countries" })),
  ...CITY_LIST.map((c) => ({ key: `t:${c.code}:${c.name}`, label: c.name, detail: [c.area, COUNTRY_BY_CODE[c.code]?.name].filter(Boolean).join(", "), group: "Cities & states" })),
];
const INDUSTRY_OPTIONS: PickerOption[] = [
  ...CORE.map((k) => ({ key: `core:${k}`, label: INDUSTRY_LABEL[k as Industry], detail: "Core", group: "Our core industries" })),
  ...INDUSTRY_SUGGESTIONS.map((s) => ({ key: `custom:${s.label.toLowerCase()}`, label: s.label, group: "More industries" })),
];

function pickFromOption(key: string): PlacePick | null {
  const [kind, a, b] = key.split(":");
  if (kind === "r") return { kind: "region", id: a as "US" | "UK" | "EUROPE" | "UAE" };
  if (kind === "c") return { kind: "country", code: a };
  if (kind === "t") {
    const city = CITY_LIST.find((c) => c.code === a && c.name === b);
    return city ? { kind: "city", name: city.name, code: city.code, area: city.area } : null;
  }
  return null;
}

function Section({ step, icon: Icon, title, hint, children, aside }: { step: number; icon: React.ElementType; title: string; hint?: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="shadow-card rounded-xl border border-border bg-card">
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-foreground text-[11px] font-semibold text-background">{step}</span>
          <div className="min-w-0">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Icon className="size-4 text-muted-foreground" />
              {title}
            </h3>
            {hint && <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{hint}</p>}
          </div>
        </div>
        {aside}
      </header>
      <div className="space-y-5 px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}

function Field({ label, hint, help, children, className }: { label: string; hint?: React.ReactNode; help?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Label>{label}</Label>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
      {help && <p className="text-[12px] leading-snug text-muted-foreground">{help}</p>}
    </div>
  );
}

function Toggle({ on, children, onClick, title }: { on: boolean; children: React.ReactNode; onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
        on ? "border-emerald/40 bg-emerald/10 text-emerald-800" : "border-border bg-card text-muted-foreground hover:border-foreground/25 hover:text-foreground",
      )}
    >
      {on && <Check className="size-3" />}
      {children}
    </button>
  );
}

function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex w-full rounded-md border border-input bg-muted p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-[5px] px-2 py-1.5 text-xs font-medium transition-colors",
            value === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function LaunchCampaign({ className, compact = false }: { className?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<LeadProvider>("ai-ark");
  const [sentence, setSentence] = useState("");
  const [filledFrom, setFilledFrom] = useState("");
  const [fill, setFill] = useState<{ changes: string[]; note: string; model: boolean } | null>(null);
  const [name, setName] = useState("");
  const [lines, setLines] = useState<ServiceLine[]>([]);
  const [lineId, setLineId] = useState("AUTO");
  const [sub, setSub] = useState("ANY");
  const [newSub, setNewSub] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState("4238486");
  const [campaignLock, setCampaignLock] = useState(false);
  const [places, setPlaces] = useState<PlacePick[]>(DEFAULT_PLACES);
  const [core, setCore] = useState<string[]>(CORE);
  const [custom, setCustom] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>(PRESET_ROLES);
  const [rolesTouched, setRolesTouched] = useState(false);
  const [extraTitles, setExtraTitles] = useState("");
  const [excludeNote, setExcludeNote] = useState("");
  const [employees, setEmployees] = useState<string[]>(DEFAULT_EMPLOYEE_RANGES);
  const [anyRevenue, setAnyRevenue] = useState(false);
  const [emailType, setEmailType] = useState<"work" | "any">("work");
  const [maxPerCompany, setMaxPerCompany] = useState(2);
  const [limit, setLimit] = useState(40);
  const [keyword, setKeyword] = useState("");
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("fenebris.leadProvider");
      if (saved === "apify" || saved === "ai-ark") setProvider(saved);
    } catch {}
  }, []);

  useEffect(() => {
    if (!open) return;
    fetch("/api/offerings")
      .then((r) => r.json())
      .then((rows: ServiceLine[]) => setLines(Array.isArray(rows) ? rows : []))
      .catch(() => {});
  }, [open]);

  const line = lines.find((l) => l.id === lineId) ?? null;
  const offeringText = sub !== "ANY" ? sub : line ? line.name : "";
  const autoCampaign = line ? line.campaignId : pickCampaign({ offering: offeringText, sentence, industry: custom.join(" ") });

  useEffect(() => {
    if (!campaignLock) setCampaignId(autoCampaign);
  }, [autoCampaign, campaignLock]);

  const bigCompanies = employees.some((e) => Number(e.split(",")[0]) > 200);
  const industryCount = core.length + custom.length;
  const problems = [
    !places.length && "Pick at least one place.",
    !industryCount && "Pick at least one industry.",
    !roles.length && "Pick at least one role.",
    !employees.length && "Pick at least one company size.",
  ].filter(Boolean) as string[];
  const ready = problems.length === 0;

  function chooseProvider(id: LeadProvider) {
    setProvider(id);
    try {
      window.localStorage.setItem("fenebris.leadProvider", id);
    } catch {}
  }

  function chooseLine(id: string, keepRoles = rolesTouched) {
    setLineId(id);
    setSub("ANY");
    setNewSub(null);
    if (!keepRoles) setRoles([...new Set([...PRESET_ROLES, ...(LINE_ROLE_HINTS[id] ?? [])])]);
  }

  async function addSubService(nameIn = newSub ?? "") {
    const subName = nameIn.trim();
    if (!line || subName.length < 2) return;
    const existing = line.items.find((i) => i.name.toLowerCase() === subName.toLowerCase());
    if (existing) {
      setSub(existing.name);
      setNewSub(null);
      return;
    }
    const next = lines.map((l) => (l.id === line.id ? { ...l, items: [...l.items, { name: subName, signals: "" }] } : l));
    const res = await fetch("/api/offerings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(json.error || "Could not add that service");
    setLines(json);
    setSub(subName);
    setNewSub(null);
    toast.success(`Added "${subName}" under ${line.name}`);
  }

  function applyFill(f: AiFill) {
    const changes: string[] = [];
    if (f.cleanedSentence) setSentence(f.cleanedSentence);
    if (f.name) {
      setName(f.name);
      changes.push(`Batch name: ${f.name}`);
    }
    if (f.howMany) {
      setLimit(f.howMany);
      changes.push(`${f.howMany} new leads`);
    }
    if (f.places?.length) {
      setPlaces(f.places);
      changes.push(`Where: ${f.places.map(placeLabel).join(", ")}`);
    }
    if (f.coreIndustries || f.customIndustries) {
      setCore(f.coreIndustries ?? []);
      setCustom(f.customIndustries ?? []);
      changes.push(`Industry: ${[...(f.coreIndustries ?? []).map((k) => INDUSTRY_LABEL[k as Industry]), ...(f.customIndustries ?? [])].join(", ")}`);
    }
    if (f.lineId) {
      const l = lines.find((x) => x.id === f.lineId);
      chooseLine(f.lineId, !!f.roles || rolesTouched);
      setCampaignLock(false);
      if (f.subService) setSub(f.subService);
      if (f.newSubService) setNewSub(f.newSubService);
      changes.push(`Selling: ${f.subService || l?.name || f.lineId}`);
    }
    if (f.roles) {
      setRoles(f.roles);
      setRolesTouched(true);
      changes.push(`Roles: ${f.roles.join(", ")}`);
    }
    if (f.extraTitles?.length) {
      setExtraTitles(f.extraTitles.join(", "));
      changes.push(`Extra titles: ${f.extraTitles.join(", ")}`);
    }
    if (f.excludeTitles?.length) {
      setExcludeNote(f.excludeTitles.join(", "));
      setMore(true);
      changes.push(`Skip titles: ${f.excludeTitles.join(", ")}`);
    }
    if (f.employees) {
      setEmployees(f.employees);
      changes.push(`Company size: ${f.employees.map((e) => EMPLOYEE_RANGES.find((x) => x.id === e)?.label).join(", ")}`);
    }
    if (f.anyRevenue) {
      setAnyRevenue(true);
      changes.push("Any revenue");
    }
    if (f.emailType) {
      setEmailType(f.emailType);
      changes.push("Work or personal emails");
    }
    if (f.maxPerCompany) {
      setMaxPerCompany(f.maxPerCompany);
      changes.push(`Max ${f.maxPerCompany} per company`);
    }
    if (f.keyword) {
      setKeyword(f.keyword);
      setMore(true);
      changes.push(`Must mention: ${f.keyword}`);
    }
    setFill({ changes, note: f.note, model: f.model });
    return changes;
  }

  async function fillWithAi() {
    const text = sentence.trim();
    if (text.length < 3) {
      toast.error("Describe the search first", { description: "For example: Find 50 jewellery companies in Hyderabad" });
      return null;
    }
    setReading(true);
    setFilledFrom(text);
    try {
      const res = await fetch("/api/leads/interpret", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
      const json = (await res.json()) as AiFill & { error?: string };
      if (!res.ok) {
        toast.error(json.error || "Could not read that sentence");
        return null;
      }
      const changes = applyFill(json);
      setFilledFrom(json.cleanedSentence || text);
      toast.success(changes.length ? `AI filled ${changes.length} ${changes.length === 1 ? "field" : "fields"}` : "Nothing new to fill", {
        description: "Check the form, change anything you like, then launch.",
      });
      return json;
    } catch (e) {
      toast.error("Could not reach the AI", { description: (e as Error).message });
      return null;
    } finally {
      setReading(false);
    }
  }

  function reset() {
    setSentence("");
    setFilledFrom("");
    setFill(null);
    setName("");
    setLineId("AUTO");
    setSub("ANY");
    setNewSub(null);
    setCampaignLock(false);
    setPlaces(DEFAULT_PLACES);
    setCore(CORE);
    setCustom([]);
    setRoles(PRESET_ROLES);
    setRolesTouched(false);
    setExtraTitles("");
    setExcludeNote("");
    setEmployees(DEFAULT_EMPLOYEE_RANGES);
    setAnyRevenue(false);
    setEmailType("work");
    setMaxPerCompany(2);
    setLimit(40);
    setKeyword("");
  }

  const summary = useMemo(() => {
    const where = places.map(placeLabel);
    const inds = [...core.map((k) => INDUSTRY_LABEL[k as Industry]), ...custom];
    const sizes = employees.map((e) => e.split(",").map(Number));
    const lo = sizes.length ? Math.min(...sizes.map((s) => s[0])) : 0;
    const hi = sizes.length ? Math.max(...sizes.map((s) => s[1])) : 0;
    const more = (list: string[], n: number) => (list.length > n ? `${list.slice(0, n).join(", ")} +${list.length - n}` : list.join(", "));
    return [
      { label: "Selling", value: sub !== "ANY" ? `${sub} · ${line?.name}` : line ? line.name : "Not chosen (campaign decides)" },
      { label: "Campaign", value: OUTREACH_CAMPAIGNS.find((c) => c.id === campaignId)?.name ?? campaignId },
      { label: "Where", value: more(where, 3) || "—" },
      { label: "Industries", value: more(inds, 2) || "—" },
      { label: "Roles", value: `${roles.length} decision-maker ${roles.length === 1 ? "role" : "roles"}${extraTitles.trim() ? " + extra titles" : ""}` },
      { label: "Company size", value: sizes.length ? `${lo.toLocaleString()}–${hi.toLocaleString()} people · ${anyRevenue ? "any revenue" : "$100k–$10M"}` : "—" },
      { label: "Leads", value: `Up to ${limit} · max ${maxPerCompany}/company · ${emailType === "work" ? "work email" : "work or personal"}` },
    ];
  }, [places, core, custom, employees, anyRevenue, sub, line, campaignId, roles, extraTitles, limit, maxPerCompany, emailType]);

  async function run() {
    if (!ready || busy) return;
    const text = sentence.trim();
    if (text && text !== filledFrom) {
      await fillWithAi();
      toast.info("Filled from your description first", { description: "Check the form, then press Launch again." });
      return;
    }
    setBusy(true);
    try {
      const pp = placesPayload(places);
      const res = await fetch("/api/leads/scrape", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider,
          name: name.trim(),
          places: pp.places,
          placeCountries: pp.placeCountries,
          placeCities: pp.placeCities,
          regions: pp.regions,
          europeCountries: pp.mode === "regions" && pp.regions.includes("EUROPE") ? pp.europeCountries : undefined,
          industries: core,
          industryTerms: custom,
          apifyIndustries: custom.map(apifyIndustryFor).filter(Boolean),
          industryQuery: custom.join(", ").slice(0, 80),
          offering: offeringText.slice(0, 80),
          roles,
          employees,
          anyRevenue,
          extraTitles: extraTitles.trim(),
          excludeNote: excludeNote.trim(),
          service: line ? LINE_SERVICE[line.id] ?? null : null,
          keyword: keyword.trim(),
          emailType,
          maxPerCompany,
          limit,
          campaignId,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Campaign launched", { description: `${limit} leads · ${summary[2].value} · results appear on the Leads page as they are found.` });
        setOpen(false);
      } else {
        toast.error("Campaign not started", { description: json.message ?? json.error ?? "Unknown error" });
      }
    } catch (e) {
      toast.error("Network error", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const placeChips = places.map((p) => ({ key: placeKey(p), label: placeLabel(p) }));
  const industryChips = [
    ...core.map((k) => ({ key: `core:${k}`, label: INDUSTRY_LABEL[k as Industry] })),
    ...custom.map((c) => ({ key: `custom:${c.toLowerCase()}`, label: c })),
  ];
  const placesAreDefault = places.length === DEFAULT_PLACES.length && places.every((p) => p.kind === "region");
  const industriesAreDefault = custom.length === 0 && core.length === CORE.length;
  const rolesAreDefault = roles.length === PRESET_ROLES.length && PRESET_ROLES.every((r) => roles.includes(r));
  const suggestedRoles = line ? LINE_ROLE_HINTS[line.id] ?? [] : [];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className={cn(compact && "h-8 px-2.5 text-xs", className)}>
          <Rocket />
          {compact ? "Launch" : "Launch campaign"}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[min(94dvh,960px)] bg-background p-0 sm:w-[min(72rem,calc(100%-2rem))] sm:p-0">
        <div className="border-b border-border bg-card px-5 pb-4 pt-5 sm:px-6">
          <SheetTitle className="flex items-center gap-2 pr-8 text-lg font-semibold">
            <Rocket className="size-5 text-emerald" />
            Launch a campaign
          </SheetTitle>
          <SheetDescription className="mt-1 text-sm text-muted-foreground">
            Describe who you want in one sentence and let AI fill the form, or set the filters yourself. Every field starts on a sensible default.
          </SheetDescription>
        </div>

        <div className="grid gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-start">
          <div className="min-w-0 space-y-4">
            <Section step={1} icon={Sparkles} title="Describe the search" hint="Write it like you would to a colleague. AI fills every field below; you can change anything after.">
              <div className="space-y-2">
                <Textarea
                  value={sentence}
                  rows={2}
                  maxLength={500}
                  placeholder="e.g. Find 50 jewellery companies in Hyderabad and sell them a Shopify store"
                  className="min-h-16 resize-none text-[15px]"
                  onChange={(e) => setSentence(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      fillWithAi();
                    }
                  }}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12px] text-muted-foreground">Places, industry, how many, roles, company size and what you sell are read from the sentence.</p>
                  <Button type="button" variant="indigo" onClick={fillWithAi} disabled={reading || busy || sentence.trim().length < 3}>
                    {reading ? <Loader2 className="animate-spin" /> : <Wand2 />}
                    {reading ? "Reading…" : "Fill with AI"}
                  </Button>
                </div>
              </div>
              {fill && (
                <div className="rounded-lg border border-indigo/25 bg-indigo/[0.05] px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-[12px] font-semibold text-indigo-700">
                    <Sparkles className="size-3.5" />
                    {fill.model ? (fill.changes.length ? "AI filled these fields" : "AI found nothing new to fill") : "Filled without AI"}
                  </p>
                  {fill.changes.length > 0 && (
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {fill.changes.map((c) => (
                        <li key={c} className="rounded-md border border-indigo/20 bg-card px-2 py-0.5 text-[11px] text-foreground">
                          {c}
                        </li>
                      ))}
                    </ul>
                  )}
                  {fill.note && <p className="mt-1.5 text-[12px] text-muted-foreground">{fill.note}</p>}
                </div>
              )}
            </Section>

            <Section step={2} icon={Target} title="What you are selling" hint="Picks the email campaign and tells the AI what to pitch. Edit the list on the Services page.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Service">
                  <Select value={lineId} onValueChange={(v) => chooseLine(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AUTO">Not sure — let the campaign decide</SelectItem>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>Your services</SelectLabel>
                        {lines.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Specific service" hint={line ? `${line.items.length} in ${line.name}` : undefined}>
                  <Select
                    value={sub}
                    disabled={!line}
                    onValueChange={(v) => {
                      if (v === ADD_SUB) setNewSub("");
                      else setSub(v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a service first" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ANY">{line ? `Any ${line.name}` : "Any"}</SelectItem>
                      {(line?.items.length ?? 0) > 0 && <SelectSeparator />}
                      {(line?.items ?? []).map((i) => (
                        <SelectItem key={i.name} value={i.name}>
                          {i.name}
                        </SelectItem>
                      ))}
                      <SelectSeparator />
                      <SelectItem value={ADD_SUB} className="text-indigo-700">
                        <span className="inline-flex items-center gap-1.5">
                          <Plus className="size-3.5" /> Add a specific service…
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              {newSub !== null && line && (
                <div className="rounded-lg border border-dashed border-indigo/40 bg-indigo/[0.03] p-3">
                  <Label className="text-[12px]">New specific service under {line.name}</Label>
                  <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                    <Input
                      autoFocus
                      value={newSub}
                      maxLength={80}
                      placeholder="e.g. Jewellery e-commerce store"
                      onChange={(e) => setNewSub(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addSubService();
                        }
                        if (e.key === "Escape") setNewSub(null);
                      }}
                    />
                    <div className="flex gap-2">
                      <Button type="button" onClick={() => addSubService()} disabled={newSub.trim().length < 2} className="flex-1 sm:flex-none">
                        <Plus /> Add and select
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setNewSub(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">Saved to the Services page, so it is in this list next time.</p>
                </div>
              )}
              <Field
                label="Email campaign"
                hint={
                  campaignLock ? (
                    <button type="button" className="inline-flex items-center gap-1 text-indigo-700 hover:underline" onClick={() => setCampaignLock(false)}>
                      <RotateCcw className="size-3" /> Follow the service again
                    </button>
                  ) : (
                    "Follows the service"
                  )
                }
                help={`New people are added to this Smartlead campaign. ${OUTREACH_CAMPAIGNS.find((c) => c.id === campaignId)?.hint ?? ""}.`}
              >
                <Select
                  value={campaignId}
                  onValueChange={(value) => {
                    setCampaignLock(true);
                    setCampaignId(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OUTREACH_CAMPAIGNS.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </Section>

            <Section step={3} icon={MapPin} title="Where and which businesses" hint="Starts on our target markets and core industries. Remove them and type your own to search anywhere.">
              <Field
                label="Places"
                hint={
                  !placesAreDefault && (
                    <button type="button" className="inline-flex items-center gap-1 text-indigo-700 hover:underline" onClick={() => setPlaces(DEFAULT_PLACES)}>
                      <RotateCcw className="size-3" /> Our 4 markets
                    </button>
                  )
                }
                help="Type a city, state or country — e.g. Hyderabad, Dubai, Texas, India. Not in the list? Press Enter to add it as typed."
              >
                <MultiPicker
                  chips={placeChips}
                  options={PLACE_OPTIONS}
                  placeholder="Search a city or country…"
                  customHint="Search for"
                  onPick={(o) => {
                    const p = pickFromOption(o.key);
                    if (p) setPlaces((v) => [...v, p]);
                  }}
                  onCustom={(text) => setPlaces((v) => [...v, { kind: "custom", name: text.slice(0, 60) }])}
                  onRemove={(key) => setPlaces((v) => v.filter((p) => placeKey(p) !== key))}
                />
              </Field>
              <Field
                label="Industries"
                hint={
                  !industriesAreDefault && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-indigo-700 hover:underline"
                      onClick={() => {
                        setCore(CORE);
                        setCustom([]);
                      }}
                    >
                      <RotateCcw className="size-3" /> Our 5 core industries
                    </button>
                  )
                }
                help="Pick from the list or type any industry (e.g. Jewellery) and press Enter. A typed industry is searched as written."
              >
                <MultiPicker
                  chips={industryChips}
                  options={INDUSTRY_OPTIONS}
                  placeholder="Search an industry…"
                  customHint="Add industry"
                  onPick={(o) => {
                    if (o.key.startsWith("core:")) setCore((v) => [...v, o.key.slice(5)]);
                    else setCustom((v) => [...v, o.label]);
                  }}
                  onCustom={(text) => {
                    const t = text.slice(0, 60);
                    setCustom((v) => (v.some((x) => x.toLowerCase() === t.toLowerCase()) ? v : [...v, t]));
                  }}
                  onRemove={(key) => {
                    if (key.startsWith("core:")) setCore((v) => v.filter((k) => k !== key.slice(5)));
                    else setCustom((v) => v.filter((c) => `custom:${c.toLowerCase()}` !== key));
                  }}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
                <Field label="Company size (employees)" help={bigCompanies && !anyRevenue ? "Companies over 200 people usually earn more than $10M. Set revenue to “Any” so they are not dropped." : undefined}>
                  <div className="flex flex-wrap gap-1.5">
                    {EMPLOYEE_RANGES.map((e) => (
                      <Toggle key={e.id} on={employees.includes(e.id)} onClick={() => setEmployees((v) => toggle(v, e.id))}>
                        {e.label}
                      </Toggle>
                    ))}
                  </div>
                </Field>
                <Field label="Yearly revenue">
                  <Segmented
                    value={anyRevenue ? "any" : "icp"}
                    options={[
                      { value: "icp", label: "$100k–$10M" },
                      { value: "any", label: "Any" },
                    ]}
                    onChange={(v) => setAnyRevenue(v === "any")}
                  />
                </Field>
              </div>
            </Section>

            <Section
              step={4}
              icon={Users}
              title="Who to contact"
              hint="Only decision-makers. The usual owners and leaders are on; add more for what you sell."
              aside={
                !rolesAreDefault && (
                  <button
                    type="button"
                    className="inline-flex shrink-0 items-center gap-1 text-[12px] text-indigo-700 hover:underline"
                    onClick={() => {
                      setRoles(PRESET_ROLES);
                      setRolesTouched(false);
                    }}
                  >
                    <RotateCcw className="size-3" /> Defaults
                  </button>
                )
              }
            >
              {suggestedRoles.some((r) => !roles.includes(r)) && (
                <button
                  type="button"
                  onClick={() => {
                    setRoles((v) => [...new Set([...v, ...suggestedRoles])]);
                    setRolesTouched(true);
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-indigo/25 bg-indigo/[0.04] px-3 py-2 text-left text-[12px] text-indigo-800 hover:bg-indigo/[0.08]"
                >
                  <span>
                    <span className="font-semibold">Suggested for {line?.name}:</span> {suggestedRoles.join(", ")}
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 font-medium">
                    <Plus className="size-3.5" /> Add
                  </span>
                </button>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {ROLE_GROUPS.map((g) => (
                  <div key={g} className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {ROLE_OPTIONS.filter((r) => r.group === g).map((r) => (
                        <Toggle
                          key={r.id}
                          on={roles.includes(r.id)}
                          title={`Searches: ${r.titles.join(", ")}`}
                          onClick={() => {
                            setRoles((v) => toggle(v, r.id));
                            setRolesTouched(true);
                          }}
                        >
                          {r.id}
                        </Toggle>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <Field label="Also include these titles" hint="Optional, comma-separated">
                <Input value={extraTitles} maxLength={120} placeholder="e.g. Head of Sales, Store Manager" onChange={(e) => setExtraTitles(e.target.value)} />
              </Field>
            </Section>

            <Section step={5} icon={Building2} title="How many and how to reach them">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="New leads" hint="5–200">
                  <div className="flex gap-1.5">
                    <Input
                      type="number"
                      min={5}
                      max={200}
                      value={limit}
                      className="w-20 shrink-0"
                      onChange={(e) => setLimit(Math.min(200, Math.max(5, Number(e.target.value) || 5)))}
                    />
                    <Segmented
                      value={[25, 50, 100].includes(limit) ? limit : 0}
                      options={[
                        { value: 25, label: "25" },
                        { value: 50, label: "50" },
                        { value: 100, label: "100" },
                      ]}
                      onChange={(v) => v && setLimit(v)}
                    />
                  </div>
                </Field>
                <Field label="Max people per company">
                  <Segmented
                    value={maxPerCompany}
                    options={[1, 2, 3, 5].map((n) => ({ value: n, label: String(n) }))}
                    onChange={setMaxPerCompany}
                  />
                </Field>
                <Field label="Email address">
                  <Segmented
                    value={emailType}
                    options={[
                      { value: "work", label: "Work only" },
                      { value: "any", label: "Work or personal" },
                    ]}
                    onChange={setEmailType}
                  />
                </Field>
              </div>

              <div className="rounded-lg border border-border">
                <button type="button" onClick={() => setMore((v) => !v)} className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] font-medium">
                  More filters
                  <span className="flex items-center gap-2 text-[12px] font-normal text-muted-foreground">
                    {[keyword && "keyword", excludeNote && "skipped titles", name && "batch name"].filter(Boolean).join(", ") || "Optional"}
                    <ChevronDown className={cn("size-4 transition-transform", more && "rotate-180")} />
                  </span>
                </button>
                {more && (
                  <div className="grid gap-4 border-t border-border p-3 sm:grid-cols-2">
                    <Field label="Company must mention" help="Only companies whose profile mentions this word, e.g. Shopify, diamonds, B2B. Leave empty for no extra filter.">
                      <Input value={keyword} maxLength={60} placeholder="e.g. Shopify" onChange={(e) => setKeyword(e.target.value)} />
                    </Field>
                    <Field label="Skip these titles" help="People whose title contains one of these words are left out.">
                      <Input value={excludeNote} maxLength={120} placeholder="e.g. Intern, Assistant, Student" onChange={(e) => setExcludeNote(e.target.value)} />
                    </Field>
                    <Field label="Batch name" help="Only for your own tracking on the Leads page." className="sm:col-span-2">
                      <Input value={name} maxLength={80} placeholder="e.g. Hyderabad jewellery — November" onChange={(e) => setName(e.target.value)} />
                    </Field>
                  </div>
                )}
              </div>
            </Section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-4">
            <div className="shadow-card rounded-xl border border-border bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Lead source</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {LEAD_PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => chooseProvider(p.id)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left transition-colors",
                      provider === p.id ? "border-emerald bg-emerald/[0.07] ring-1 ring-emerald/30" : "border-border hover:bg-foreground/[0.03]",
                    )}
                  >
                    <span className={cn("block text-sm font-semibold", provider === p.id ? "text-emerald-800" : "text-foreground")}>{p.label}</span>
                    <span className="block text-[11px] text-muted-foreground">{p.id === "apify" ? "Pay per lead, cheapest" : "Credits, mailbox-checked"}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{LEAD_PROVIDERS.find((p) => p.id === provider)?.detail}</p>
            </div>

            <div className="shadow-card rounded-xl border border-border bg-card">
              <p className="border-b border-border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">This launch</p>
              <dl className="divide-y divide-border/70">
                {summary.map((s) => (
                  <div key={s.label} className="grid grid-cols-[92px_minmax(0,1fr)] gap-2 px-4 py-2 text-[12px]">
                    <dt className="text-muted-foreground">{s.label}</dt>
                    <dd className="font-medium text-foreground">{s.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="flex gap-2 border-t border-border px-4 py-2.5 text-[11px] leading-snug text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                Each person is checked by AI, gets 4 personal emails, and is added to the campaign as a draft. Nothing is sent until the campaign is started in Smartlead.
              </p>
            </div>

            <CostEstimate provider={provider} leads={limit} compact />

            {!ready && (
              <ul className="space-y-1 rounded-lg border border-rose-500/30 bg-rose-500/[0.06] px-3 py-2 text-[12px] text-rose-700">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
          </aside>
        </div>

        <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-border bg-card px-5 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-6">
          <span className="text-center text-[12px] text-muted-foreground sm:mr-auto sm:text-left">
            {limit} leads via {provider === "apify" ? "Apify" : "AI Ark"} · est. <span className="font-metric font-semibold text-foreground">{costLabel(provider, limit)}</span>
          </span>
          <Button type="button" variant="secondary" onClick={reset} disabled={busy}>
            <RotateCcw /> Reset
          </Button>
          <Button onClick={run} disabled={busy || reading || !ready} className="min-w-36">
            {busy || reading ? <Loader2 className="animate-spin" /> : <Rocket />}
            {busy ? "Launching…" : reading ? "Reading…" : "Launch campaign"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
