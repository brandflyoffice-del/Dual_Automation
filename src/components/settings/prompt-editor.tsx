"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpenText, Loader2, Lock, RotateCcw, Save, Unlock } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Textarea } from "@/components/ui/input";
import { PRICE_RE } from "@/lib/settings-shared";
import { cn } from "@/lib/utils";

type Section = { key: string; num: string; title: string; heading: string; body: string };
type Data = { prompt: string; startingPrice: string; custom: boolean; updatedAt: string | null; defaults: { prompt: string; startingPrice: string } };

const HEADING = /^(\d+)\.\s+([A-Z][A-Z0-9 ,&/'-]+[A-Z])\b(.*)$/;

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
  { match: /PRICING/, text: "The only price the AI may quote. {{STARTING_PRICE}} is filled in from the Starting price box above. Any other dollar amount is held for a person to check, never sent." },
  { match: /^BOOKING/, text: "How times and booking buttons work. The system adds real free times from the calendar under the AI's text. Change with care.", system: true },
  { match: /TONE/, text: "Voice, length and language of the replies." },
  { match: /SITUATIONS/, text: "What to do for each kind of reply: pricing, demo, not interested, unsubscribe, complaints, support, billing, job applications, spam." },
  { match: /STRICT/, text: "Hard limits. When unsure, the AI marks the reply for a person instead of guessing." },
  { match: /^OUTPUT/, text: "Technical. The exact JSON the workflow reads. If these keys change, every reply is held for a person.", system: true },
];
const explain = (title: string) => EXPLAIN.find((e) => e.match.test(title));

export function PromptEditor() {
  const [data, setData] = useState<Data | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [price, setPrice] = useState("");
  const [unlocked, setUnlocked] = useState<Record<string, boolean>>({});
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

  if (!data) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading the prompt…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="sticky top-14 z-10 lg:top-2">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">AI reply prompt</span>
              {data.custom ? <Badge variant="indigo">Your edited version</Badge> : <Badge variant="emerald">Built-in version</Badge>}
              {dirty && <Badge variant="amber">Unsaved changes</Badge>}
            </div>
            <p className="text-[12px] text-muted-foreground">
              Used every time a prospect replies. Saved changes apply to the next reply, no deploy needed.
              {data.updatedAt && ` Last saved ${new Date(data.updatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}.`}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="price">Starting price</Label>
              <Input id="price" value={price} onChange={(e) => setPrice(e.target.value)} className={cn("w-28", !priceOk && "border-rose-500")} />
            </div>
            <Button variant="secondary" onClick={() => load(data)} disabled={!dirty || busy}>
              Discard
            </Button>
            <Button onClick={() => put({ prompt: text, startingPrice: price.trim() }, "Prompt saved. The next reply uses it.")} disabled={!dirty || busy || !priceOk}>
              {busy ? <Loader2 className="animate-spin" /> : <Save />}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-border bg-muted px-4 py-3 text-[12px] leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">How it works.</span> A prospect replies → the system reads the whole email thread, checks the calendar for
        free times, and gives the AI this prompt. The AI writes the answer; the system adds the time buttons and the sign-off. A reply is sent on its own only
        when it is clearly safe (no other price, no complaint, no billing or legal question). Everything else waits on the Leads page for a person.
      </div>

      {sections.map((s, i) => {
        const note = explain(s.title);
        const locked = note?.system && !unlocked[s.key];
        const edited = defaults.has(s.key) ? defaults.get(s.key) !== s.body : true;
        return (
          <Card key={s.key + i}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                    {s.num && <span className="font-metric flex size-6 items-center justify-center rounded-full bg-emerald/10 text-xs text-emerald">{s.num}</span>}
                    <span className="capitalize">{s.title.toLowerCase()}</span>
                    {note?.system && <Badge variant="outline">System</Badge>}
                    {edited && <Badge variant="indigo">Edited</Badge>}
                  </CardTitle>
                  {note && <CardDescription className="mt-1">{note.text}</CardDescription>}
                </div>
                {note?.system && (
                  <Button size="xs" variant="ghost" onClick={() => setUnlocked((u) => ({ ...u, [s.key]: !u[s.key] }))}>
                    {locked ? <Lock /> : <Unlock />}
                    {locked ? "Unlock" : "Lock"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={s.body}
                readOnly={locked}
                rows={Math.min(30, s.body.split("\n").reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 125)), 1))}
                onChange={(e) => setSections((all) => all.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))}
                className={cn("font-mono text-[12px] leading-relaxed", locked && "bg-muted text-muted-foreground")}
              />
              {edited && defaults.has(s.key) && (
                <button
                  type="button"
                  className="mt-2 text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                  onClick={() => setSections((all) => all.map((x, j) => (j === i ? { ...x, body: defaults.get(s.key) ?? x.body } : x)))}
                >
                  Undo changes in this part
                </button>
              )}
            </CardContent>
          </Card>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-2">
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
  );
}
