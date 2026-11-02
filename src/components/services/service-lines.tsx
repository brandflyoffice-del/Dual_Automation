"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Layers, Loader2, Mail, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { OUTREACH_CAMPAIGNS } from "@/lib/constants";
import type { ServiceLine, SubService } from "@/lib/settings-shared";
import { cn } from "@/lib/utils";

const campaignName = (id: string) => OUTREACH_CAMPAIGNS.find((c) => c.id === id)?.name ?? id;
const slug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "service";
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

type Save = (next: ServiceLine[], ok: string) => Promise<boolean>;

function CampaignSelect({ value, onChange, disabled, className }: { value: string; onChange: (v: string) => void; disabled?: boolean; className?: string }) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={className}>
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
  );
}

/** One sub-service row: view, inline edit, or inline remove confirmation. */
function SubRow({ item, siblings, busy, onSave, onRemove }: { item: SubService; siblings: SubService[]; busy: boolean; onSave: (s: SubService) => Promise<boolean>; onRemove: () => void }) {
  const [mode, setMode] = useState<"view" | "edit" | "confirm">("view");
  const [name, setName] = useState(item.name);
  const [signals, setSignals] = useState(item.signals);
  const clash = !same(name, item.name) && siblings.some((s) => same(s.name, name));
  const valid = name.trim().length >= 2 && !clash;

  async function commit() {
    if (!valid) return;
    if (name.trim() === item.name && signals.trim() === item.signals) return setMode("view");
    if (await onSave({ name: name.trim(), signals: signals.trim() })) setMode("view");
  }

  if (mode === "edit") {
    return (
      <li className="bg-indigo/[0.03] px-4 py-3">
        <form
          className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            commit();
          }}
          onKeyDown={(e) => e.key === "Escape" && setMode("view")}
        >
          <div>
            <Input autoFocus value={name} maxLength={80} aria-label="Sub-service name" onChange={(e) => setName(e.target.value)} className={cn(clash && "border-rose-500")} />
            {clash && <p className="mt-1 text-[11px] text-rose-600">Already on this list.</p>}
          </div>
          <Input value={signals} maxLength={240} aria-label="Signals" placeholder="What suggests a company needs it (optional)" onChange={(e) => setSignals(e.target.value)} />
          <div className="flex gap-1.5">
            <Button type="submit" size="sm" disabled={busy || !valid}>
              {busy ? <Loader2 className="animate-spin" /> : <Check />}
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setName(item.name);
                setSignals(item.signals);
                setMode("view");
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-4 py-2.5 transition-colors hover:bg-foreground/[0.02] md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] md:items-center">
      <div className="min-w-0 text-sm font-medium">{item.name}</div>
      <div className={cn("col-span-2 row-start-2 min-w-0 text-[12px] leading-snug md:col-span-1 md:row-start-auto", item.signals ? "text-muted-foreground" : "italic text-muted-foreground/70")}>
        {item.signals || "No signals yet"}
      </div>
      {mode === "confirm" ? (
        <div className="col-start-2 row-start-1 flex items-center gap-1 md:col-start-auto md:row-start-auto">
          <span className="mr-1 text-[12px] text-muted-foreground">Remove?</span>
          <Button size="xs" variant="destructive" disabled={busy} onClick={onRemove}>
            Remove
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setMode("view")}>
            Keep
          </Button>
        </div>
      ) : (
        <div className="col-start-2 row-start-1 flex gap-0.5 md:col-start-auto md:row-start-auto md:opacity-60 md:group-hover:opacity-100">
          <Button size="icon" variant="ghost" className="size-7" aria-label={`Edit ${item.name}`} disabled={busy} onClick={() => setMode("edit")}>
            <Pencil className="size-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="size-7 hover:text-rose-600" aria-label={`Remove ${item.name}`} disabled={busy} onClick={() => setMode("confirm")}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      )}
    </li>
  );
}

function AddSubRow({ line, busy, onAdd }: { line: ServiceLine; busy: boolean; onAdd: (s: SubService) => Promise<boolean> }) {
  const [name, setName] = useState("");
  const [signals, setSignals] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const clash = line.items.some((i) => same(i.name, name));
  return (
    <form
      className="grid gap-2 border-t border-dashed border-border bg-muted/40 px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto]"
      onSubmit={async (e) => {
        e.preventDefault();
        if (name.trim().length < 2 || clash) return;
        if (await onAdd({ name: name.trim(), signals: signals.trim() })) {
          setName("");
          setSignals("");
          nameRef.current?.focus();
        }
      }}
    >
      <div>
        <Input ref={nameRef} value={name} maxLength={80} aria-label={`New sub-service under ${line.name}`} placeholder="New sub-service, e.g. Shopify Plus" onChange={(e) => setName(e.target.value)} className={cn(clash && "border-rose-500")} />
        {clash && <p className="mt-1 text-[11px] text-rose-600">Already on this list.</p>}
      </div>
      <Input value={signals} maxLength={240} aria-label="Signals for the new sub-service" placeholder="Signals: what suggests a company needs it (optional)" onChange={(e) => setSignals(e.target.value)} />
      <Button type="submit" variant="secondary" disabled={busy || name.trim().length < 2 || clash}>
        {busy ? <Loader2 className="animate-spin" /> : <Plus />}
        Add
      </Button>
    </form>
  );
}

function LineCard({ line, lines, busy, save }: { line: ServiceLine; lines: ServiceLine[]; busy: boolean; save: Save }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState(line.name);
  const [hint, setHint] = useState(line.hint);
  const update = (fn: (l: ServiceLine) => ServiceLine) => lines.map((l) => (l.id === line.id ? fn(l) : l));
  const clash = lines.some((l) => l.id !== line.id && same(l.name, name));

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
        {editing ? (
          <form
            className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]"
            onSubmit={async (e) => {
              e.preventDefault();
              if (name.trim().length < 2 || clash) return;
              if (await save(update((l) => ({ ...l, name: name.trim(), hint: hint.trim() })), "Service updated")) setEditing(false);
            }}
            onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
          >
            <div>
              <Input autoFocus value={name} maxLength={60} aria-label="Service name" onChange={(e) => setName(e.target.value)} className={cn(clash && "border-rose-500")} />
              {clash && <p className="mt-1 text-[11px] text-rose-600">Another service has this name.</p>}
            </div>
            <Input value={hint} maxLength={120} aria-label="Short description" placeholder="Short description" onChange={(e) => setHint(e.target.value)} />
            <div className="flex gap-1.5">
              <Button type="submit" size="sm" disabled={busy || name.trim().length < 2 || clash}>
                <Check /> Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setName(line.name);
                  setHint(line.hint);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald/10 text-base font-semibold text-emerald">{line.name.charAt(0).toUpperCase()}</span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[15px] font-semibold tracking-tight">{line.name}</h2>
                <Badge variant="outline">
                  {line.items.length} sub-service{line.items.length === 1 ? "" : "s"}
                </Badge>
              </div>
              <p className="mt-0.5 text-[12px] text-muted-foreground">{line.hint || "No description yet"}</p>
            </div>
          </div>
        )}

        {!editing && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Mail className="size-3.5 text-muted-foreground" />
              <span className="sr-only">Email campaign</span>
              <CampaignSelect
                value={line.campaignId}
                disabled={busy}
                className="h-8 w-52 text-xs"
                onChange={(v) => save(update((l) => ({ ...l, campaignId: v })), `${line.name} now uses ${campaignName(v)}`)}
              />
            </div>
            {confirmDelete ? (
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => save(lines.filter((l) => l.id !== line.id), `${line.name} deleted`)}
                >
                  {line.items.length ? `Delete with ${line.items.length} sub-services` : "Delete service"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Keep
                </Button>
              </div>
            ) : (
              <div className="flex gap-0.5">
                <Button size="icon" variant="ghost" className="size-8" aria-label={`Rename ${line.name}`} disabled={busy} onClick={() => setEditing(true)}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 hover:text-rose-600"
                  aria-label={`Delete ${line.name}`}
                  title={lines.length < 2 ? "Keep at least one service" : undefined}
                  disabled={busy || lines.length < 2}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {line.items.length > 0 && (
        <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_64px] gap-3 bg-muted/50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid">
          <span>Sub-service</span>
          <span>Signals the AI looks for</span>
          <span />
        </div>
      )}
      <ul className="divide-y divide-border">
        {line.items.map((item) => (
          <SubRow
            key={item.name}
            item={item}
            siblings={line.items}
            busy={busy}
            onSave={(s) => save(update((l) => ({ ...l, items: l.items.map((x) => (x.name === item.name ? s : x)) })), `Saved ${s.name}`)}
            onRemove={() => save(update((l) => ({ ...l, items: l.items.filter((x) => x.name !== item.name) })), `Removed ${item.name}`)}
          />
        ))}
        {line.items.length === 0 && <li className="px-4 py-5 text-center text-[13px] text-muted-foreground">No sub-services yet. Add the first one below.</li>}
      </ul>
      <AddSubRow line={line} busy={busy} onAdd={(s) => save(update((l) => ({ ...l, items: [...l.items, s] })), `Added ${s.name} under ${line.name}`)} />
    </Card>
  );
}

function AddLineDialog({ open, onOpenChange, lines, save }: { open: boolean; onOpenChange: (v: boolean) => void; lines: ServiceLine[]; save: Save }) {
  const [form, setForm] = useState({ name: "", hint: "", campaignId: OUTREACH_CAMPAIGNS[0].id as string, subs: "" });
  const [busy, setBusy] = useState(false);
  const clash = lines.some((l) => same(l.name, form.name));
  const subs = [...new Map(form.subs.split(/[,\n]/).map((s) => s.trim()).filter((s) => s.length >= 2).map((s) => [s.toLowerCase(), s.slice(0, 80)])).values()];
  const ok = form.name.trim().length >= 2 && !clash;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="center" className="p-0">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!ok) return;
            setBusy(true);
            let id = slug(form.name);
            while (lines.some((l) => l.id === id)) id += "-2";
            const next = [...lines, { id, name: form.name.trim(), campaignId: form.campaignId, hint: form.hint.trim(), items: subs.map((name) => ({ name, signals: "" })) }];
            const done = await save(next, `${form.name.trim()} added`);
            setBusy(false);
            if (done) {
              setForm({ name: "", hint: "", campaignId: OUTREACH_CAMPAIGNS[0].id, subs: "" });
              onOpenChange(false);
            }
          }}
        >
          <div className="border-b border-border px-5 py-4">
            <SheetTitle className="pr-8 text-base font-semibold">Add a service</SheetTitle>
            <SheetDescription className="mt-1 text-[13px] text-muted-foreground">A new thing to sell. It appears in Launch under &ldquo;What do you want to sell?&rdquo;.</SheetDescription>
          </div>
          <div className="space-y-4 px-5 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-line-name">Name</Label>
              <Input id="new-line-name" autoFocus value={form.name} maxLength={60} placeholder="e.g. Cyber security" onChange={(e) => setForm({ ...form, name: e.target.value })} className={cn(clash && "border-rose-500")} />
              {clash && <p className="text-[11px] text-rose-600">A service with this name already exists.</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-line-hint">Short description</Label>
              <Input id="new-line-hint" value={form.hint} maxLength={120} placeholder="e.g. Audits, penetration tests, compliance" onChange={(e) => setForm({ ...form, hint: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Email campaign</Label>
              <CampaignSelect value={form.campaignId} onChange={(v) => setForm({ ...form, campaignId: v })} />
              <p className="text-[11px] text-muted-foreground">
                New leads for this service get the emails of &ldquo;{campaignName(form.campaignId)}&rdquo;. A brand-new campaign has to be created in Smartlead first.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-line-subs">Sub-services (optional)</Label>
              <Input id="new-line-subs" value={form.subs} placeholder="e.g. Pen testing, ISO 27001, Security audit" onChange={(e) => setForm({ ...form, subs: e.target.value })} />
              <p className="text-[11px] text-muted-foreground">Separate with commas. You can add signals to each one afterwards.</p>
              {subs.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {subs.map((s) => (
                    <Badge key={s} variant="emerald">
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !ok}>
              {busy ? <Loader2 className="animate-spin" /> : <Plus />}
              Add service
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function ServiceLines() {
  const [lines, setLines] = useState<ServiceLine[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetch("/api/offerings")
      .then((r) => r.json())
      .then((rows) => setLines(Array.isArray(rows) ? rows : []))
      .catch(() => toast.error("Could not load services"));
  }, []);

  /** Optimistic: show the change at once, roll back if the server refuses it. */
  const save: Save = async (next, ok) => {
    const before = lines;
    setLines(next);
    setBusy(true);
    try {
      const res = await fetch("/api/offerings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
      const json = await res.json();
      if (!res.ok) {
        setLines(before);
        toast.error(json.error || "Could not save");
        return false;
      }
      setLines(json);
      toast.success(ok);
      return true;
    } catch (e) {
      setLines(before);
      toast.error("Network error", { description: (e as Error).message });
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!lines) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading services…
      </div>
    );
  }

  const subCount = lines.reduce((n, l) => n + l.items.length, 0);
  const campaigns = new Set(lines.map((l) => l.campaignId)).size;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
          {[
            { label: "Services", value: lines.length },
            { label: "Sub-services", value: subCount },
            { label: "Email campaigns used", value: campaigns },
          ].map((s) => (
            <div key={s.label} className="flex items-baseline gap-1.5">
              <dt className="text-muted-foreground">{s.label}</dt>
              <dd className="font-metric font-semibold">{s.value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex items-center gap-2">
          {busy && (
            <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Saving…
            </span>
          )}
          <Button onClick={() => setAdding(true)} disabled={lines.length >= 20}>
            <Plus /> Add service
          </Button>
        </div>
      </div>

      <div className="flex gap-2.5 rounded-lg border border-border bg-muted/50 px-3.5 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
        <Layers className="mt-0.5 size-4 shrink-0 text-emerald" />
        <span>
          <span className="font-medium text-foreground">How this is used.</span> Launch shows each service and its sub-services as two dropdowns; the chosen one decides the email
          campaign. <span className="font-medium text-foreground">Signals</span> are the clues the AI looks for on a prospect&apos;s website to pick the right sub-service.
        </span>
      </div>

      <div className="space-y-4">
        {lines.map((l) => (
          <LineCard key={l.id} line={l} lines={lines} busy={busy} save={save} />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setAdding(true)}
        disabled={lines.length >= 20}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-5 text-sm font-medium text-muted-foreground transition-colors hover:border-emerald/40 hover:bg-emerald/[0.03] hover:text-emerald disabled:opacity-50"
      >
        <Plus className="size-4" /> Add another service
      </button>

      <AddLineDialog open={adding} onOpenChange={setAdding} lines={lines} save={save} />
    </div>
  );
}
