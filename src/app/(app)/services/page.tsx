"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OUTREACH_CAMPAIGNS } from "@/lib/constants";
import type { ServiceLine } from "@/lib/settings-shared";

const campaignName = (id: string) => OUTREACH_CAMPAIGNS.find((c) => c.id === id)?.name ?? id;
const slug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "service";

function AddSub({ onAdd }: { onAdd: (name: string, signals: string) => Promise<boolean> }) {
  const [name, setName] = useState("");
  const [signals, setSignals] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        if (await onAdd(name.trim(), signals.trim())) {
          setName("");
          setSignals("");
        }
        setBusy(false);
      }}
    >
      <Input value={name} maxLength={80} placeholder="Specific service, e.g. Shopify Plus" onChange={(e) => setName(e.target.value)} />
      <Input value={signals} maxLength={240} placeholder="What suggests a company needs it (optional)" onChange={(e) => setSignals(e.target.value)} />
      <Button type="submit" variant="secondary" disabled={busy || name.trim().length < 2}>
        {busy ? <Loader2 className="animate-spin" /> : <Plus />}
        Add
      </Button>
    </form>
  );
}

export default function ServicesPage() {
  const [lines, setLines] = useState<ServiceLine[] | null>(null);
  const [newLine, setNewLine] = useState({ name: "", campaignId: OUTREACH_CAMPAIGNS[0].id as string, hint: "" });

  useEffect(() => {
    fetch("/api/offerings")
      .then((r) => r.json())
      .then(setLines)
      .catch(() => toast.error("Could not load services"));
  }, []);

  async function save(next: ServiceLine[], ok: string) {
    const res = await fetch("/api/offerings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Could not save");
      return false;
    }
    setLines(json);
    toast.success(ok);
    return true;
  }

  if (!lines) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading services…
      </div>
    );
  }

  const update = (id: string, fn: (l: ServiceLine) => ServiceLine) => lines.map((l) => (l.id === id ? fn(l) : l));

  return (
    <>
      <PageHeader
        title="Services you sell"
        description="Each service has its own email campaign and a list of specific services. Launch shows these as two dropdowns, and the AI uses the signals to match a prospect."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {lines.map((l) => (
          <Card key={l.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle>{l.name}</CardTitle>
                  <CardDescription className="mt-1">{l.hint || "No description"}</CardDescription>
                </div>
                <Button
                  size="xs"
                  variant="ghost"
                  aria-label={`Delete ${l.name}`}
                  disabled={lines.length < 2}
                  onClick={() => {
                    if (window.confirm(`Delete "${l.name}" and its ${l.items.length} specific services?`)) save(lines.filter((x) => x.id !== l.id), "Service deleted");
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                <Mail className="size-3.5" /> Email campaign
                <Select value={l.campaignId} onValueChange={(v) => save(update(l.id, (x) => ({ ...x, campaignId: v })), "Email campaign changed")}>
                  <SelectTrigger className="h-7 w-auto min-w-48 text-xs">
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
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {l.items.map((i) => (
                  <li key={i.name} className="group flex items-start justify-between gap-2 rounded-lg border border-border px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{i.name}</div>
                      <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{i.signals || "No signal note"}</div>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${i.name}`}
                      className="mt-0.5 text-muted-foreground opacity-60 hover:text-rose-600 hover:opacity-100"
                      onClick={() => save(update(l.id, (x) => ({ ...x, items: x.items.filter((y) => y.name !== i.name) })), `Removed ${i.name}`)}
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              <AddSub
                onAdd={(name, signals) => {
                  if (l.items.some((i) => i.name.toLowerCase() === name.toLowerCase())) {
                    toast.error("Already on this list");
                    return Promise.resolve(false);
                  }
                  return save(update(l.id, (x) => ({ ...x, items: [...x.items, { name, signals }] })), `Added ${name}`);
                }}
              />
            </CardContent>
          </Card>
        ))}

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Add a new service</CardTitle>
            <CardDescription>A new thing to sell, with the email campaign that should carry it. Add its specific services after.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={newLine.name} maxLength={60} placeholder="e.g. Cyber security" onChange={(e) => setNewLine({ ...newLine, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Short description</Label>
              <Input value={newLine.hint} maxLength={120} placeholder="e.g. Audits, penetration tests, compliance" onChange={(e) => setNewLine({ ...newLine, hint: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Email campaign</Label>
              <Select value={newLine.campaignId} onValueChange={(v) => setNewLine({ ...newLine, campaignId: v })}>
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
              <p className="text-[11px] text-muted-foreground">
                Uses the emails of &ldquo;{campaignName(newLine.campaignId)}&rdquo;. A brand-new campaign has to be created in Smartlead first.
              </p>
            </div>
            <Button
              disabled={newLine.name.trim().length < 2}
              onClick={async () => {
                let id = slug(newLine.name);
                while (lines.some((l) => l.id === id)) id += "-2";
                const ok = await save([...lines, { id, name: newLine.name.trim(), campaignId: newLine.campaignId, hint: newLine.hint.trim(), items: [] }], "Service added");
                if (ok) setNewLine({ name: "", campaignId: OUTREACH_CAMPAIGNS[0].id, hint: "" });
              }}
            >
              <Plus />
              Add service
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
