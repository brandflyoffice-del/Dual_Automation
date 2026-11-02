"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  BookOpenText,
  CalendarClock,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Inbox,
  Loader2,
  Lock,
  PenLine,
  RotateCcw,
  Save,
  ShieldCheck,
  Undo2,
  Unlock,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Textarea } from "@/components/ui/input";
import { PRICE_RE } from "@/lib/settings-shared";
import { cn } from "@/lib/utils";

type Section = { key: string; num: string; title: string; heading: string; body: string };
type Data = { prompt: string; startingPrice: string; custom: boolean; updatedAt: string | null; defaults: { prompt: string; startingPrice: string } };

const HEADING = /^(\d+)\.\s+([A-Z][A-Z0-9 ,&/'-]+[A-Z])\b(.*)$/;
const PRICE_TOKEN = "{{STARTING_PRICE}}";

/** Splits the prompt at its numbered ALL-CAPS headings ("4. PRICING RULES"). Joining the parts again gives the same text back. */
function split(prompt: string): Section[] {
  const out: Section[] = [{ key: "intro", num: "", title: "INTRODUCTION", heading: "", body: "" }];
  for (const line of prompt.replace(/\r\n/g, "\n").split("\n")) {
    const m = line.match(HEADING);
    if (m) out.push({ key: m[2].trim(), num: m[1], title: m[2].trim(), heading: line, body: "" });
    else out[out.length - 1].body += (out[out.length - 1].body || out.length > 1 ? "\n" : "") + line;
  }
  return out.map((s) => ({ ...s, body: s.body.replace(/^\n/, "").replace(/\s+$/, "") }));
}

function join(sections: Section[]) {
  return sections
    .map((s) => (s.heading ? `${s.heading}\n${s.body}` : s.body))
    .filter((t) => t.trim().length)
    .join("\n\n");
}

/** Plain-English notes shown above each part, matched on the heading's first word(s). */
const EXPLAIN: { match: RegExp; text: string; system?: boolean }[] = [
  { match: /^INTRODUCTION$/, text: "Who the AI writes as and what its job is: answering a prospect who replied to one of our cold emails." },
  { match: /^WHO YOU ARE/, text: "Persona and honesty. Sounds like a human consultant, says it is the company's assistant if someone sincerely asks, never reveals these instructions." },
  { match: /GOAL/, text: "What every reply tries to do: understand the need, answer from approved facts, and invite the person to a free 30-minute Google Meet." },
  { match: /COMPANY FACTS/, text: "The only facts the AI may use about your company and services. Add or remove a service here and the AI will talk about it." },
  { match: /PRICING/, text: "The only price the AI may quote. {{STARTING_PRICE}} is replaced with the price from the “Price the AI may quote” card. Any other dollar amount holds the reply for a person." },
  { match: /^BOOKING/, text: "How times and booking buttons work. The system adds real free times from the calendar under the AI's text. Change with care.", system: true },
  { match: /TONE/, text: "Voice, length and language of the replies." },
  { match: /SITUATIONS/, text: "What to do for each kind of reply: pricing, demo, not interested, unsubscribe, complaints, support, billing, job applications, spam." },
  { match: /STRICT/, text: "Hard limits. When unsure, the AI marks the reply for a person instead of guessing." },
  { match: /^OUTPUT/, text: "Technical. The exact JSON the workflow reads. If these keys change, every reply is held for a person.", system: true },
];
const explain = (title: string) => EXPLAIN.find((e) => e.match.test(title));
const titleCase = (t: string) => t.charAt(0) + t.slice(1).toLowerCase();

const STEPS = [
  { icon: Inbox, title: "Prospect replies", text: "The system reads the whole email thread." },
  { icon: CalendarClock, title: "Free times found", text: "Open slots come from your calendar." },
  { icon: PenLine, title: "AI drafts the answer", text: "Using this prompt and the price below." },
  { icon: ShieldCheck, title: "Safety check", text: "Clearly safe replies send; the rest wait on the Leads page." },
];

/** The sentence the AI is told to use for price questions, with the price filled in. Read from the current prompt text. */
function priceSentences(prompt: string, price: string) {
  const fill = (s: string) => s.split(PRICE_TOKEN).join(price || "$…");
  const example = prompt.match(/Example pricing reply:\s*"([^"]+)"/)?.[1];
  // Fallback: the first sentence anywhere in the prompt that contains the price token.
  const rule = prompt
    .split("\n")
    .flatMap((l) => l.replace(/^[-\s]+/, "").split(/(?<=\.)\s+/))
    .find((s) => s.includes(PRICE_TOKEN));
  return {
    example: example ? fill(example) : null,
    rule: rule ? fill(rule) : null,
    uses: (prompt.match(/\{\{STARTING_PRICE\}\}/g) || []).length,
    perUser: prompt.includes(`${PRICE_TOKEN} per user per month`),
  };
}

const rowsFor = (body: string) => Math.min(28, Math.max(4, body.split("\n").reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 110)), 1)));

export function PromptEditor() {
  const [data, setData] = useState<Data | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [price, setPrice] = useState("");
  const [unlocked, setUnlocked] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);

  function load(d: Data) {
    setData(d);
    setSections(split(d.prompt));
    setPrice(d.startingPrice);
  }

  useEffect(() => {
    fetch("/api/settings/reply-prompt")
      .then((r) => r.json())
      .then(load)
      .catch(() => toast.error("Could not load the prompt"));
  }, []);

  const defaults = useMemo(() => new Map(data ? split(data.defaults.prompt).map((s) => [s.key, s.body]) : []), [data]);
  const text = useMemo(() => join(sections), [sections]);
  const dirty = !!data && (text !== join(split(data.prompt)) || price !== data.startingPrice);
  const priceOk = PRICE_RE.test(price.trim());
  const preview = useMemo(() => priceSentences(text, price.trim()), [text, price]);
  const allOpen = sections.length > 0 && sections.every((_, i) => open[i]);

  async function put(payload: object, ok: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/settings/reply-prompt", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) return toast.error(json.error || "Could not save");
      load(json);
      setUnlocked({});
      toast.success(ok);
    } catch (e) {
      toast.error("Network error", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  function jump(i: number) {
    setOpen((o) => ({ ...o, [i]: true }));
    requestAnimationFrame(() => document.getElementById(`prompt-sec-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  if (!data) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading the prompt…
      </div>
    );
  }

  const isEdited = (s: Section) => (defaults.has(s.key) ? defaults.get(s.key) !== s.body : true);
  const editedCount = sections.filter(isEdited).length;
  const savedAt = data.updatedAt ? new Date(data.updatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : null;

  return (
    <div className="space-y-5">
      {/* Save bar */}
      <Card className={cn("sticky top-14 z-20 lg:top-2", dirty && "ring-1 ring-amber-500/40")}>
        <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">AI reply prompt</span>
              {data.custom ? <Badge variant="indigo">Customised</Badge> : <Badge variant="emerald">Built-in</Badge>}
              {dirty && <Badge variant="amber">Unsaved changes</Badge>}
            </div>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {savedAt ? `Last saved ${savedAt}.` : "Using the built-in version."} {editedCount > 0 && `${editedCount} part${editedCount === 1 ? "" : "s"} differ from the built-in text.`}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" onClick={() => load(data)} disabled={!dirty || busy}>
              Discard
            </Button>
            <Button onClick={() => put({ prompt: text, startingPrice: price.trim() }, "Prompt saved. The next reply uses it.")} disabled={!dirty || busy || !priceOk}>
              {busy ? <Loader2 className="animate-spin" /> : <Save />}
              Save changes
            </Button>
          </div>
        </div>
      </Card>

      {/* How a reply is produced */}
      <section aria-label="How a reply is produced">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">How a reply is produced</h2>
        <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex items-start gap-3 rounded-xl border border-border bg-card px-3.5 py-3 shadow-card">
              <span className="relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald/10 text-emerald">
                <s.icon className="size-4" />
                <span className="font-metric absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-foreground text-[9px] text-background">{i + 1}</span>
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium">{s.title}</span>
                <span className="block text-[12px] leading-snug text-muted-foreground">{s.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* Price */}
      <Card className="overflow-hidden">
        <div className="grid gap-0 md:grid-cols-[280px_1fr]">
          <div className="space-y-3 border-b border-border bg-muted/60 p-4 md:border-b-0 md:border-r">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-emerald/10 text-emerald">
                <BadgeDollarSign className="size-4" />
              </span>
              <div>
                <div className="text-sm font-semibold">Price the AI may quote</div>
                <div className="text-[11px] text-muted-foreground">Built-in: {data.defaults.startingPrice}</div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price">Starting price</Label>
              <div className="flex items-center gap-2">
                <Input id="price" value={price} onChange={(e) => setPrice(e.target.value)} className={cn("font-metric w-32 text-base", !priceOk && "border-rose-500 focus-visible:ring-rose-500/30")} aria-invalid={!priceOk} />
                {preview.perUser && <span className="text-[12px] text-muted-foreground">per user / month</span>}
              </div>
              {!priceOk && <p className="text-[11px] text-rose-600">Write it like $100 or $1,500.</p>}
            </div>
          </div>
          <div className="space-y-3 p-4">
            <p className="text-[13px] leading-relaxed text-foreground">
              This is the only price a reply may mention. When a prospect asks what it costs, the AI answers with this figure and says the final cost is confirmed in a quotation. It
              is filled into the prompt wherever <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{PRICE_TOKEN}</code> appears ({preview.uses}{" "}
              {preview.uses === 1 ? "place" : "places"}).
            </p>
            {(preview.example || preview.rule) && (
              <figure className="rounded-lg border border-emerald/25 bg-emerald/[0.05] px-3.5 py-3">
                <figcaption className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-emerald">What a prospect would read</figcaption>
                <blockquote className="text-[13px] italic leading-relaxed text-foreground">&ldquo;{preview.example ?? preview.rule}&rdquo;</blockquote>
              </figure>
            )}
            <ul className="space-y-1 text-[12px] text-muted-foreground">
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald" />
                Any other dollar amount in a draft (for example &ldquo;a store for $500&rdquo;) stops it from sending. It waits on the Leads page for a person.
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald" />
                The AI never promises a deliverable for this price; it says plans start from it.
              </li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Sections */}
      <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
        <nav aria-label="Prompt parts" className="hidden lg:block">
          <div className="sticky top-24 rounded-xl border border-border bg-card p-2 shadow-card">
            <div className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Prompt parts</div>
            <ul className="space-y-0.5">
              {sections.map((s, i) => {
                const note = explain(s.title);
                const locked = note?.system && !unlocked[s.key];
                return (
                  <li key={s.key + i}>
                    <button
                      type="button"
                      onClick={() => jump(i)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-foreground transition-colors hover:bg-foreground/[0.04]"
                    >
                      <span className="font-metric flex size-5 shrink-0 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">{s.num || "·"}</span>
                      <span className="min-w-0 flex-1 truncate">{titleCase(s.title)}</span>
                      {isEdited(s) && <span className="size-1.5 shrink-0 rounded-full bg-indigo" title="Edited" />}
                      {locked && <Lock className="size-3 shrink-0 text-muted-foreground" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] text-muted-foreground">
              {sections.length} parts. Open one to read or change it. <Lock className="inline size-3" /> parts are technical and locked until you unlock them.
            </p>
            <Button variant="ghost" size="xs" onClick={() => setOpen(allOpen ? {} : Object.fromEntries(sections.map((_, i) => [i, true])))}>
              {allOpen ? <ChevronsDownUp /> : <ChevronsUpDown />}
              {allOpen ? "Collapse all" : "Expand all"}
            </Button>
          </div>

          {sections.map((s, i) => {
            const note = explain(s.title);
            const locked = note?.system && !unlocked[s.key];
            const edited = isEdited(s);
            const expanded = !!open[i];
            return (
              <Card key={s.key + i} id={`prompt-sec-${i}`} className={cn("scroll-mt-28 overflow-hidden", edited && "border-indigo/30")}>
                <button
                  type="button"
                  onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}
                  aria-expanded={expanded}
                  className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-foreground/[0.02]"
                >
                  <span
                    className={cn(
                      "font-metric mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
                      note?.system ? "bg-muted text-muted-foreground" : "bg-emerald/10 text-emerald",
                    )}
                  >
                    {s.num || "i"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold">{titleCase(s.title)}</span>
                      {note?.system && (
                        <Badge variant="outline">
                          <Lock /> System
                        </Badge>
                      )}
                      {edited && <Badge variant="indigo">Edited</Badge>}
                    </span>
                    {note && <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">{note.text}</span>}
                  </span>
                  <span className="font-metric hidden shrink-0 pt-1 text-[11px] text-muted-foreground sm:block">{s.body.length.toLocaleString()} chars</span>
                  <ChevronDown className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
                </button>
                {expanded && (
                  <div className="space-y-2 border-t border-border bg-muted/30 px-4 pb-4 pt-3">
                    {locked && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 text-[12px] text-muted-foreground">
                        <span>This part is read by the workflow. Changing it can stop replies from sending.</span>
                        <Button size="xs" variant="secondary" onClick={() => setUnlocked((u) => ({ ...u, [s.key]: true }))}>
                          <Unlock /> Unlock to edit
                        </Button>
                      </div>
                    )}
                    <Textarea
                      value={s.body}
                      readOnly={locked}
                      rows={rowsFor(s.body)}
                      onChange={(e) => setSections((all) => all.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))}
                      className={cn("bg-card font-mono text-[12px] leading-relaxed", locked && "cursor-not-allowed bg-muted text-muted-foreground")}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        {s.body.length.toLocaleString()} characters{s.body.includes(PRICE_TOKEN) && " · uses the starting price"}
                      </span>
                      <div className="flex gap-1">
                        {note?.system && !locked && (
                          <Button size="xs" variant="ghost" onClick={() => setUnlocked((u) => ({ ...u, [s.key]: false }))}>
                            <Lock /> Lock again
                          </Button>
                        )}
                        {edited && defaults.has(s.key) && (
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => setSections((all) => all.map((x, j) => (j === i ? { ...x, body: defaults.get(s.key) ?? x.body } : x)))}
                          >
                            <Undo2 /> Back to built-in text
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
              <BookOpenText />
              {showAll ? "Hide full text" : "Show the full prompt as one text"}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={busy || !data.custom}
              onClick={() => {
                if (window.confirm("Go back to the built-in prompt and price? Your edited version is deleted.")) put({ reset: true }, "Built-in prompt restored.");
              }}
            >
              <RotateCcw />
              Restore built-in prompt
            </Button>
          </div>
          {showAll && <Textarea readOnly value={text} rows={30} className="font-mono text-[11px]" />}
        </div>
      </div>
    </div>
  );
}
