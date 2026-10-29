"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Rocket } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EMPLOYEE_RANGES, EUROPE_COUNTRIES, ICP, INDUSTRY_LABEL, LEAD_PROVIDERS, OUTREACH_CAMPAIGNS, pickCampaign, REGION_META, SERVICES, SERVICE_META, type LeadProvider } from "@/lib/constants";
import { cn } from "@/lib/utils";

const DEFAULT_REGIONS = [...ICP.regions];
const DEFAULT_INDUSTRIES = [...ICP.industries];
const DEFAULT_ROLES = [...ICP.roles];
const DEFAULT_EMPLOYEES = EMPLOYEE_RANGES.map((e) => e.id);
const DEFAULT_EUROPE = EUROPE_COUNTRIES.map((c) => c.code);

type Read = {
  cleanedSentence?: string;
  name?: string;
  howMany?: number | null;
  places?: string[];
  industryQuery?: string;
  industries?: string[] | null;
  offering?: string;
  keyword?: string;
  extraTitles?: string[];
  excludeTitles?: string[];
  roles?: string[] | null;
  regions?: string[] | null;
  europeCountries?: string[] | null;
  employees?: string[] | null;
  emailType?: "work" | "any";
  maxPerCompany?: number;
  service?: string;
  note?: string;
  model?: boolean;
  error?: string;
};

function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs transition-colors",
        on ? "border-emerald bg-emerald/10 font-medium text-emerald" : "border-border bg-card text-muted-foreground hover:bg-foreground/[0.04]",
      )}
    >
      {children}
    </button>
  );
}

function toggle<T extends string>(list: T[], id: T): T[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <Label>{label}</Label>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export function LaunchCampaign({ className, compact = false }: { className?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [sentence, setSentence] = useState("");
  const [places, setPlaces] = useState("");
  const [industryQuery, setIndustryQuery] = useState("");
  const [offering, setOffering] = useState("");
  const [offerings, setOfferings] = useState<{ name: string }[]>([]);
  const [regions, setRegions] = useState<string[]>(DEFAULT_REGIONS);
  const [europe, setEurope] = useState<string[]>([...DEFAULT_EUROPE]);
  const [industries, setIndustries] = useState<string[]>(DEFAULT_INDUSTRIES);
  const [roles, setRoles] = useState<string[]>(DEFAULT_ROLES);
  const [extraTitles, setExtraTitles] = useState("");
  const [employees, setEmployees] = useState<string[]>([...DEFAULT_EMPLOYEES]);
  const [service, setService] = useState("AUTO");
  const [keyword, setKeyword] = useState("");
  const [excludeNote, setExcludeNote] = useState("");
  const [provider, setProvider] = useState<LeadProvider>("ai-ark");
  const [campaignId, setCampaignId] = useState("4238486");
  const [campaignLock, setCampaignLock] = useState(false);
  const [emailType, setEmailType] = useState<"work" | "any">("work");
  const [maxPerCompany, setMaxPerCompany] = useState(2);
  const [limit, setLimit] = useState(40);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);

  const europeOn = regions.includes("EUROPE");
  const ready = regions.length > 0 && industries.length > 0 && roles.length > 0 && employees.length > 0 && (!europeOn || europe.length > 0);

  useEffect(() => {
    const saved = window.localStorage.getItem("fenebris.leadProvider");
    if (saved === "apify" || saved === "ai-ark") setProvider(saved);
  }, []);

  useEffect(() => {
    fetch("/api/offerings")
      .then((r) => r.json())
      .then((rows: { name: string }[]) => setOfferings(rows))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (campaignLock) return;
    setCampaignId(pickCampaign({ offering, service, sentence, industry: industryQuery }));
  }, [offering, service, sentence, industryQuery, campaignLock]);

  function chooseProvider(id: LeadProvider) {
    setProvider(id);
    window.localStorage.setItem("fenebris.leadProvider", id);
  }

  function snapshot() {
    return {
      name,
      places,
      industryQuery,
      offering,
      keyword,
      extraTitles,
      excludeNote,
      regions,
      europeCountries: europe,
      industries,
      roles,
      employees,
      service,
      emailType,
      maxPerCompany,
      limit,
    };
  }

  function applyRead(json: Read) {
    if (json.cleanedSentence) setSentence(json.cleanedSentence);
    if (json.name) setName(json.name);
    if (json.places?.length) setPlaces(json.places.join(", "));
    if (json.industryQuery) setIndustryQuery(json.industryQuery);
    if (json.offering) setOffering(json.offering);
    if (json.keyword) setKeyword(json.keyword);
    if (json.howMany) setLimit(json.howMany);
    if (json.industries?.length) setIndustries(json.industries);
    if (json.roles?.length) setRoles(json.roles);
    if (json.regions?.length) setRegions(json.regions);
    if (json.europeCountries?.length) setEurope(json.europeCountries);
    if (json.employees?.length) setEmployees(json.employees);
    if (json.extraTitles) setExtraTitles(json.extraTitles.join(", "));
    if (json.excludeTitles) setExcludeNote(json.excludeTitles.join(", "));
    if (json.emailType) setEmailType(json.emailType);
    if (json.maxPerCompany) setMaxPerCompany(json.maxPerCompany);
    if (json.service) setService(json.service);
    setNote(json.note || "");
  }

  async function checkForm(quiet = false) {
    if (sentence.trim().length < 3 && places.trim().length < 2 && industryQuery.trim().length < 2) {
      if (!quiet) toast.error("Write a sentence or a place, then check");
      return null;
    }
    setReading(true);
    try {
      const res = await fetch("/api/leads/interpret", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: sentence, form: snapshot() }),
      });
      const json = (await res.json()) as Read;
      if (!res.ok) {
        if (!quiet) toast.error(json.error || "Could not check the form");
        return null;
      }
      applyRead(json);
      if (!quiet) toast.success(json.model ? "Checked. Only spelling and what you already wrote." : "Checker was unavailable. Your choices were left as they are.");
      return json;
    } catch (e) {
      if (!quiet) toast.error("Could not check that", { description: (e as Error).message });
      return null;
    } finally {
      setReading(false);
    }
  }

  const summary = useMemo(() => {
    const place = places.trim() || (regions.length === ICP.regions.length ? "all 4 regions" : regions.map((r) => (r === "EUROPE" ? "Europe" : r)).join(", "));
    const via = provider === "apify" ? "Apify" : "AI Ark";
    return `${via} · ${name.trim() || "Untitled batch"} · up to ${limit} leads · ${place} · ${emailType === "work" ? "work emails" : "work or personal"} · max ${maxPerCompany} per company`;
  }, [provider, name, limit, places, regions, emailType, maxPerCompany]);

  function reset() {
    setName("");
    setSentence("");
    setPlaces("");
    setIndustryQuery("");
    setOffering("");
    setRegions(DEFAULT_REGIONS);
    setEurope([...DEFAULT_EUROPE]);
    setIndustries(DEFAULT_INDUSTRIES);
    setRoles(DEFAULT_ROLES);
    setExtraTitles("");
    setEmployees([...DEFAULT_EMPLOYEES]);
    setService("AUTO");
    setKeyword("");
    setExcludeNote("");
    setEmailType("work");
    setMaxPerCompany(2);
    setLimit(40);
    setCampaignId("4238486");
    setCampaignLock(false);
    setNote("");
  }

  async function run() {
    if (!ready) return;
    setBusy(true);
    try {
      const checked = await checkForm(true);
      const placeList = (checked?.places?.length ? checked.places : places.split(/[,;\n]/))
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/leads/scrape", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider,
          name: (checked?.name || name).trim(),
          places: placeList,
          industryQuery: (checked?.industryQuery || industryQuery).trim(),
          offering: (checked?.offering || offering).trim(),
          regions: checked?.regions?.length ? checked.regions : regions,
          europeCountries: europeOn ? (checked?.europeCountries?.length ? checked.europeCountries : europe) : undefined,
          industries: checked?.industries?.length ? checked.industries : industries,
          roles: checked?.roles?.length ? checked.roles : roles,
          employees: checked?.employees?.length ? checked.employees : employees,
          extraTitles: (checked?.extraTitles ? checked.extraTitles.join(", ") : extraTitles).trim(),
          excludeNote: (checked?.excludeTitles ? checked.excludeTitles.join(", ") : excludeNote).trim(),
          service: (checked?.service || service) === "AUTO" ? null : checked?.service || service,
          keyword: (checked?.keyword || keyword).trim(),
          emailType: checked?.emailType || emailType,
          maxPerCompany: checked?.maxPerCompany || maxPerCompany,
          limit: checked?.howMany || limit,
          campaignId,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success("Campaign launched", { description: summary });
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

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className={cn(compact && "h-8 px-2.5 text-xs", className)}>
          <Rocket />
          {compact ? "Launch" : provider === "apify" ? "Launch · Apify" : "Launch · AI Ark"}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto p-0 sm:p-0">
        <div className="border-b border-border px-5 pb-4 pt-5 sm:px-6">
          <SheetTitle className="pr-8 text-lg font-semibold">Launch campaign</SheetTitle>
          <SheetDescription className="mt-1 text-sm text-muted-foreground">
            Fill the choices below. ChatGPT only checks spelling and whether they match what you wrote.
          </SheetDescription>
        </div>

        <div className="space-y-5 px-5 py-4 sm:px-6">
          <Field label="Lead source" hint="Same filters either way">
            <div className="grid grid-cols-2 gap-2">
              {LEAD_PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => chooseProvider(p.id)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left transition-colors",
                    provider === p.id ? "border-emerald bg-emerald/10" : "border-border bg-card hover:bg-foreground/[0.04]",
                  )}
                >
                  <span className={cn("block text-sm font-medium", provider === p.id ? "text-emerald" : "text-foreground")}>{p.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{p.detail}</span>
                </button>
              ))}
            </div>
          </Field>

          <Field label="Describe the search" hint="Optional. The checker can fill the boxes from this">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input value={sentence} placeholder="Find 50 jewellery companies in Hyderabad" onChange={(e) => setSentence(e.target.value)} />
              <Button type="button" variant="secondary" onClick={() => checkForm()} disabled={reading || busy}>
                {reading ? <Loader2 className="animate-spin" /> : null}
                Check choices
              </Button>
            </div>
          </Field>
          {note && <p className="rounded-lg border border-emerald/30 bg-emerald/10 px-3 py-2 text-sm text-foreground">{note}</p>}

          <Field label="Batch name" hint="Optional, for your own tracking">
            <Input value={name} maxLength={80} placeholder="e.g. UK Shopify founders — October" onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Places" hint="City, state, or country. Used instead of the region chips when filled">
            <Input value={places} placeholder="Hyderabad, Dubai, Germany" onChange={(e) => setPlaces(e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Industry in their words" hint="Optional, e.g. jewellery">
              <Input value={industryQuery} placeholder="jewellery" onChange={(e) => setIndustryQuery(e.target.value)} />
            </Field>
            <Field label="Service you want to sell" hint="From your services list">
              <Input value={offering} list="offerings" placeholder="SEO, ERP, RFID…" onChange={(e) => setOffering(e.target.value)} />
              <datalist id="offerings">
                {offerings.map((o) => (
                  <option key={o.name} value={o.name} />
                ))}
              </datalist>
            </Field>
          </div>

          <Field label="Email campaign" hint="Picked from the product. People found here are added to this campaign.">
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
            <p className="text-[12px] text-muted-foreground">{OUTREACH_CAMPAIGNS.find((c) => c.id === campaignId)?.hint}</p>
          </Field>

          <Field label="Regions" hint="On by default. Skipped when Places is filled">
            <div className="flex flex-wrap gap-1.5">
              {ICP.regions.map((r) => (
                <Chip key={r} on={regions.includes(r)} onClick={() => setRegions((v) => toggle(v, r))}>
                  {REGION_META[r].label}
                </Chip>
              ))}
            </div>
          </Field>
          {europeOn && (
            <Field label="Countries inside Europe" hint="Used when Europe is on and Places is empty">
              <div className="flex flex-wrap gap-1.5">
                {EUROPE_COUNTRIES.map((c) => (
                  <Chip key={c.code} on={europe.includes(c.code)} onClick={() => setEurope((v) => toggle(v, c.code))}>
                    {c.label}
                  </Chip>
                ))}
              </div>
            </Field>
          )}
          <Field label="Industries" hint="On by default until you name one business">
            <div className="flex flex-wrap gap-1.5">
              {ICP.industries.map((i) => (
                <Chip key={i} on={industries.includes(i)} onClick={() => setIndustries((v) => toggle(v, i))}>
                  {INDUSTRY_LABEL[i]}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="Roles" hint="Decision-makers. On by default.">
            <div className="flex flex-wrap gap-1.5">
              {ICP.roles.map((r) => (
                <Chip key={r} on={roles.includes(r)} onClick={() => setRoles((v) => toggle(v, r))}>
                  {r}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="Also include these titles" hint="Optional, comma-separated">
            <Input value={extraTitles} maxLength={120} placeholder="e.g. Head of Ecommerce, VP Operations" onChange={(e) => setExtraTitles(e.target.value)} />
          </Field>
          <Field label="Company size" hint="Default: 1–200 people">
            <div className="flex flex-wrap gap-1.5">
              {EMPLOYEE_RANGES.map((e) => (
                <Chip key={e.id} on={employees.includes(e.id)} onClick={() => setEmployees((v) => toggle(v, e.id))}>
                  {e.label}
                </Chip>
              ))}
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Service to lead with">
              <Select value={service} onValueChange={setService}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AUTO">Match the site audit (default)</SelectItem>
                  {SERVICES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SERVICE_META[s].short}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="New leads" hint="5–200">
              <Input type="number" min={5} max={200} value={limit} onChange={(e) => setLimit(Math.min(200, Math.max(5, Number(e.target.value) || 5)))} />
            </Field>
            <Field label="Emails">
              <Select value={emailType} onValueChange={(v) => setEmailType(v === "any" ? "any" : "work")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="work">Work email only (default)</SelectItem>
                  <SelectItem value="any">Work, or a personal email if that is all we have</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Max people from one company" hint="1–5">
              <Input type="number" min={1} max={5} value={maxPerCompany} onChange={(e) => setMaxPerCompany(Math.min(5, Math.max(1, Number(e.target.value) || 1)))} />
            </Field>
          </div>
          <Field label="Must mention" hint="Optional keyword, added on top of the industry">
            <Input value={keyword} maxLength={80} placeholder="e.g. Shopify, Magento, restaurants" onChange={(e) => setKeyword(e.target.value)} />
          </Field>
          <Field label="Skip these titles" hint="Optional, comma-separated">
            <Input value={excludeNote} maxLength={120} placeholder="e.g. Intern, Assistant, Student" onChange={(e) => setExcludeNote(e.target.value)} />
          </Field>

          <div className="rounded-lg border border-border bg-muted px-3 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">{summary}</span>
            <span className="mt-1 block">A known revenue outside $100k–$10M is dropped. A real work email and a $1,000+ ticket are still required.</span>
          </div>
          {!ready && <p className="text-xs text-rose-600">Keep at least one region, industry, role, and company size. If Europe is on, keep one country.</p>}
        </div>

        <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-border bg-card px-5 py-3 sm:flex-row sm:justify-end sm:px-6">
          <Button type="button" variant="secondary" onClick={reset} disabled={busy}>
            Reset to defaults
          </Button>
          <Button onClick={run} disabled={busy || reading || !ready}>
            {busy || reading ? <Loader2 className="animate-spin" /> : <Rocket />}
            {busy || reading ? "Checking…" : "Launch now"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
