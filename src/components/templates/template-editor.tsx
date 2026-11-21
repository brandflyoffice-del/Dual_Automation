"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Monitor, RotateCcw, Save, Smartphone, Undo2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { HEX, MERGE_TAGS, buildEmailHtml, textToHtml, withSamples, type TemplateDesign, type TemplateStep } from "@/lib/email-template";

type Campaign = { id: string; name: string; status: string };
type Data = { campaignId: string; design: TemplateDesign; steps: TemplateStep[]; warnings: string[]; lastBackupAt: string | null };

const fmtWhen = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Email Templates page: edit a Smartlead campaign's emails (text + card design), preview live, save with undo. */
export function TemplateEditor() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [campaignId, setCampaignId] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [original, setOriginal] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [varIdx, setVarIdx] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [samples, setSamples] = useState(true);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const lastFocus = useRef<"subject" | "body">("body");

  useEffect(() => {
    fetch("/api/smartlead/templates", { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Could not load campaigns");
        setCampaigns(j.campaigns);
        if (j.campaigns[0]) setCampaignId(j.campaigns[0].id);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/smartlead/templates?campaignId=${id}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Could not load the emails");
      setData(j);
      setOriginal(JSON.stringify({ design: j.design, steps: j.steps }));
      setStepIdx(0);
      setVarIdx(0);
    } catch (e) {
      setData(null);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (campaignId) load(campaignId);
  }, [campaignId, load]);

  const dirty = !!data && JSON.stringify({ design: data.design, steps: data.steps }) !== original;
  const step = data?.steps[stepIdx];
  const variant = step?.variants[Math.min(varIdx, step.variants.length - 1)];

  // Unsaved edits are lost on reload or close: ask first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const setDesign = (patch: Partial<TemplateDesign>) => setData((d) => (d ? { ...d, design: { ...d.design, ...patch } } : d));
  const setVariant = (patch: Partial<{ subject: string; text: string }>) =>
    setData((d) => {
      if (!d) return d;
      const steps = d.steps.map((s, i) =>
        i !== stepIdx ? s : { ...s, variants: s.variants.map((v, j) => (j !== Math.min(varIdx, s.variants.length - 1) ? v : { ...v, ...patch })) },
      );
      return { ...d, steps };
    });
  const setDelay = (days: number) =>
    setData((d) => (d ? { ...d, steps: d.steps.map((s, i) => (i === stepIdx ? { ...s, delayDays: days } : s)) } : d));

  /** Puts a merge tag where the cursor is (subject or body, whichever was last focused). */
  function insertTag(tag: string) {
    if (!variant) return;
    const inSubject = lastFocus.current === "subject";
    const el = inSubject ? subjectRef.current : bodyRef.current;
    const value = inSubject ? variant.subject : variant.text;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + tag + value.slice(end);
    setVariant(inSubject ? { subject: next } : { text: next });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + tag.length, start + tag.length);
    });
  }

  const preview = useMemo(() => {
    if (!data || !variant) return "";
    const text = samples ? withSamples(variant.text) : variant.text;
    return buildEmailHtml(data.design, textToHtml(text));
  }, [data, variant, samples]);

  function changeCampaign(id: string) {
    if (dirty && !window.confirm("You have unsaved changes. Switch campaign and lose them?")) return;
    setCampaignId(id);
  }

  async function save() {
    if (!data) return;
    const name = campaigns?.find((c) => c.id === data.campaignId)?.name ?? data.campaignId;
    if (!window.confirm(`Save these ${data.steps.length} emails to Smartlead for "${name}"?\n\nThe current version is kept, so "Undo last save" can put it back.`)) return;
    setBusy(true);
    try {
      const r = await fetch("/api/smartlead/templates", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaignId: data.campaignId, design: data.design, steps: data.steps }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Save failed");
      toast.success("Saved to Smartlead", { description: `${name}: new emails go out with this version from now on.` });
      await load(data.campaignId);
    } catch (e) {
      toast.error("Not saved", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (!data?.lastBackupAt) return;
    if (!window.confirm(`Put back the version from before the save on ${fmtWhen(data.lastBackupAt)}?`)) return;
    setBusy(true);
    try {
      const r = await fetch("/api/smartlead/templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaignId: data.campaignId, action: "undo" }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Undo failed");
      toast.success("Previous version is back in Smartlead");
      await load(data.campaignId);
    } catch (e) {
      toast.error("Undo failed", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (error && !data && !loading) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-rose-600">{error}</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Campaign picker + actions */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="min-w-56 flex-1">
            <Label htmlFor="tpl-campaign">Campaign</Label>
            <select
              id="tpl-campaign"
              value={campaignId}
              onChange={(e) => changeCampaign(e.target.value)}
              disabled={!campaigns || busy}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              {!campaigns && <option>Loading…</option>}
              {campaigns?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.status === "DRAFTED" ? "(draft)" : c.status === "ACTIVE" ? "(sending)" : `(${c.status.toLowerCase()})`}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {dirty && <span className="text-xs font-medium text-amber-700">Unsaved changes</span>}
            <Button variant="ghost" size="sm" onClick={() => data && setData({ ...data, ...JSON.parse(original) })} disabled={!dirty || busy}>
              <RotateCcw /> Discard
            </Button>
            <Button variant="secondary" size="sm" onClick={undo} disabled={!data?.lastBackupAt || dirty || busy} title={data?.lastBackupAt ? `Before the save on ${fmtWhen(data.lastBackupAt)}` : "No save from this page yet"}>
              <Undo2 /> Undo last save
            </Button>
            <Button size="sm" onClick={save} disabled={!dirty || busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Save />} Save to Smartlead
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading || !data || !step || !variant ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading the emails from Smartlead…
          </CardContent>
        </Card>
      ) : (
        <>
          {data.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
              {data.warnings.map((w) => (
                <div key={w}>{w}</div>
              ))}
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {/* Editor */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Emails</CardTitle>
                  <CardDescription>Each lead gets these in order. Write in plain text: a blank line starts a new paragraph, lines starting with &quot;- &quot; become a bullet list.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-1.5">
                    {data.steps.map((s, i) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setStepIdx(i);
                          setVarIdx(0);
                        }}
                        className={cn(
                          "rounded-md border px-3 py-1.5 text-[13px] transition-colors",
                          i === stepIdx ? "border-emerald bg-emerald/10 font-medium text-emerald" : "border-border text-muted-foreground hover:bg-foreground/[0.04]",
                        )}
                      >
                        Email {s.seqNumber}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[13px]">
                    {stepIdx === 0 ? (
                      <span className="text-muted-foreground">Sent first, when the lead starts.</span>
                    ) : (
                      <label className="flex items-center gap-2">
                        Sent
                        <Input type="number" min={1} max={60} value={step.delayDays} onChange={(e) => setDelay(Math.max(1, Math.min(60, Number(e.target.value) || 1)))} className="h-8 w-16" />
                        days after email {data.steps[stepIdx - 1].seqNumber}
                      </label>
                    )}
                  </div>

                  {step.variants.length > 1 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
                      <span className="text-muted-foreground">A/B versions (Smartlead sends each to half the leads):</span>
                      {step.variants.map((v, j) => (
                        <button
                          key={v.id ?? j}
                          type="button"
                          onClick={() => setVarIdx(j)}
                          className={cn(
                            "rounded-md border px-2.5 py-1 transition-colors",
                            j === varIdx ? "border-indigo-400 bg-indigo-50 font-medium text-indigo-700" : "border-border text-muted-foreground hover:bg-foreground/[0.04]",
                          )}
                        >
                          Version {v.label ?? String.fromCharCode(65 + j)}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-subject">Subject</Label>
                    <Input
                      id="tpl-subject"
                      ref={subjectRef}
                      value={variant.subject}
                      maxLength={200}
                      onFocus={() => (lastFocus.current = "subject")}
                      onChange={(e) => setVariant({ subject: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-body">Email text</Label>
                    <Textarea
                      id="tpl-body"
                      ref={bodyRef}
                      value={variant.text}
                      rows={14}
                      maxLength={8000}
                      onFocus={() => (lastFocus.current = "body")}
                      onChange={(e) => setVariant({ text: e.target.value })}
                      className="font-[inherit] leading-relaxed"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
                    <span className="text-muted-foreground">Insert:</span>
                    {MERGE_TAGS.map((t) => (
                      <button
                        key={t.tag}
                        type="button"
                        onClick={() => insertTag(t.tag)}
                        title={`Becomes the lead's ${t.label.toLowerCase()}`}
                        className="rounded-md border border-border bg-foreground/[0.03] px-2 py-0.5 font-mono text-[11px] hover:bg-foreground/[0.06]"
                      >
                        {t.tag}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    The button, the signature and the footer are added from the design below, so do not type a sign-off or the booking link in the text.
                  </p>
                </CardContent>
              </Card>

              <DesignCard design={data.design} onChange={setDesign} />
            </div>

            {/* Preview */}
            <Card className="h-fit xl:sticky xl:top-4">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>Preview</CardTitle>
                  <CardDescription>
                    Email {step.seqNumber}
                    {step.variants.length > 1 ? ` · version ${variant.label ?? String.fromCharCode(65 + varIdx)}` : ""}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="mr-2 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <input type="checkbox" checked={samples} onChange={(e) => setSamples(e.target.checked)} />
                    Sample names
                  </label>
                  <Button variant={mobile ? "ghost" : "secondary"} size="xs" onClick={() => setMobile(false)} aria-label="Desktop width">
                    <Monitor />
                  </Button>
                  <Button variant={mobile ? "secondary" : "ghost"} size="xs" onClick={() => setMobile(true)} aria-label="Phone width">
                    <Smartphone />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="rounded-md border border-border bg-foreground/[0.03] px-3 py-2 text-[13px]">
                  <span className="text-muted-foreground">Subject: </span>
                  <span className="font-medium">{samples ? withSamples(variant.subject) : variant.subject}</span>
                </div>
                <div className="flex justify-center overflow-hidden rounded-md border border-border bg-[#eef2f5]">
                  {/* No scripts in the preview; same-origin only so the frame can grow to the email's full height. */}
                  <iframe
                    key={mobile ? "m" : "d"}
                    title="Email preview"
                    srcDoc={preview}
                    sandbox="allow-same-origin"
                    onLoad={(e) => {
                      const doc = e.currentTarget.contentDocument;
                      if (doc) e.currentTarget.style.height = `${Math.max(400, doc.documentElement.scrollHeight)}px`;
                    }}
                    className="border-0 bg-[#eef2f5]"
                    style={{ width: mobile ? 380 : "100%", height: 640 }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <div className="space-y-1">
      <Label className="text-[12px]">{label}</Label>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={HEX.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          aria-label={label}
          className="h-9 w-11 shrink-0 cursor-pointer rounded-md border border-border bg-card p-1"
        />
        <Input
          value={text}
          maxLength={7}
          onChange={(e) => {
            setText(e.target.value);
            if (HEX.test(e.target.value)) onChange(e.target.value.toUpperCase());
          }}
          className={cn("font-mono text-xs", !HEX.test(text) && "border-rose-400")}
        />
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-[12px]">{label}</Label>
      <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function DesignCard({ design: d, onChange }: { design: TemplateDesign; onChange: (p: Partial<TemplateDesign>) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Design</CardTitle>
        <CardDescription>Logo, colours, button and signature. One design for all emails of this campaign.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Header</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Logo text" value={d.logoText1} onChange={(v) => onChange({ logoText1: v })} placeholder="Tapadia" />
            <ColorField label="Logo text colour" value={d.logoColor1} onChange={(v) => onChange({ logoColor1: v })} />
            <TextField label="Second word (optional)" value={d.logoText2} onChange={(v) => onChange({ logoText2: v })} placeholder="Tech" hint="Shown after the logo text in its own colour." />
            <ColorField label="Second word colour" value={d.logoColor2} onChange={(v) => onChange({ logoColor2: v })} />
            <ColorField label="Header background" value={d.headerBg} onChange={(v) => onChange({ headerBg: v })} />
          </div>
        </div>
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Button</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Button text" value={d.buttonText} onChange={(v) => onChange({ buttonText: v })} />
            <ColorField label="Button colour" value={d.buttonBg} onChange={(v) => onChange({ buttonBg: v })} />
            <div className="sm:col-span-2">
              <TextField label="Booking link" value={d.bookingLink} onChange={(v) => onChange({ bookingLink: v })} placeholder="https://cal.com/…" />
            </div>
          </div>
        </div>
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Signature footer</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Sender name" value={d.senderName} onChange={(v) => onChange({ senderName: v })} />
            <ColorField label="Footer background" value={d.footerBg} onChange={(v) => onChange({ footerBg: v })} />
            <TextField label="Website text" value={d.websiteText} onChange={(v) => onChange({ websiteText: v })} placeholder="TapadiaTech.com" />
            <TextField label="Website link" value={d.websiteUrl} onChange={(v) => onChange({ websiteUrl: v })} placeholder="https://…" />
            <TextField label="Phone line" value={d.phone} onChange={(v) => onChange({ phone: v })} hint="Shown in the footer only. Leave empty to hide it." />
            <TextField label="Copyright name" value={d.copyrightName} onChange={(v) => onChange({ copyrightName: v })} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
