"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, KeyRound, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { INTEGRATION_FIELDS, type IntegrationField, type IntegrationStatus } from "@/lib/integrations-shared";
import { cn } from "@/lib/utils";

type Check = { ok: boolean; detail: string } | null;

/** Settings > Integrations: paste a new API key, test it, save it. Takes effect on the next launch or reply, no deploy. */
export function IntegrationsSettings() {
  const [status, setStatus] = useState<IntegrationStatus[] | null>(null);

  useEffect(() => {
    fetch("/api/settings/integrations", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { integrations: IntegrationStatus[] }) => setStatus(d.integrations))
      .catch(() => toast.error("Could not load integrations"));
  }, []);

  const main = INTEGRATION_FIELDS.filter((f) => !f.optional);
  const extra = INTEGRATION_FIELDS.filter((f) => f.optional);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-emerald" /> API keys
          </CardTitle>
          <CardDescription>
            When a service resets its key, paste the new one here. It is checked with the service, stored encrypted, and used from the next launch or
            reply. No developer or deploy needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border p-0">
          {main.map((f) => (
            <IntegrationRow key={f.key} field={f} status={status?.find((s) => s.key === f.key) ?? null} loading={!status} onSaved={setStatus} />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Optional and advanced</CardTitle>
          <CardDescription>Only needed if you use these services, or when asked to change them.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border p-0">
          {extra.map((f) => (
            <IntegrationRow key={f.key} field={f} status={status?.find((s) => s.key === f.key) ?? null} loading={!status} onSaved={setStatus} />
          ))}
        </CardContent>
      </Card>
      <p className="flex items-start gap-1.5 px-1 text-[11px] text-muted-foreground">
        <ShieldCheck className="mt-px size-3.5 shrink-0" /> Keys are never shown again after saving (only the last 4 characters). Removing a key here
        switches back to the one set on the server.
      </p>
    </div>
  );
}

function IntegrationRow({
  field: f,
  status,
  loading,
  onSaved,
}: {
  field: IntegrationField;
  status: IntegrationStatus | null;
  loading: boolean;
  onSaved: (s: IntegrationStatus[]) => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | "clear" | null>(null);
  const [check, setCheck] = useState<Check>(null);

  async function save(next: string | null) {
    setBusy(next === null ? "clear" : "save");
    setCheck(null);
    const r = await fetch("/api/settings/integrations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ values: { [f.key]: next } }) }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { integrations?: IntegrationStatus[]; error?: string } | null;
    setBusy(null);
    if (r?.ok && j?.integrations) {
      onSaved(j.integrations);
      setValue("");
      toast.success(next === null ? `${f.label} removed` : `${f.label} saved`, { description: next === null ? "The key set on the server is used again." : "Used from the next launch or reply." });
    } else toast.error("Not saved", { description: j?.error || "Try again" });
  }

  async function test() {
    setBusy("test");
    const r = await fetch("/api/settings/integrations/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: f.key, value: value.trim() || undefined }) }).catch(() => null);
    setCheck(((await r?.json().catch(() => null)) as Check) ?? { ok: false, detail: "Could not test. Try again." });
    setBusy(null);
  }

  const src = status?.source ?? "none";
  return (
    <div className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-medium">{f.label}</span>
          {loading ? (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          ) : src === "dashboard" ? (
            <Badge variant="emerald">Set here</Badge>
          ) : src === "server" ? (
            <Badge variant="outline">Set on the server</Badge>
          ) : (
            <Badge variant={f.optional ? "outline" : "rose"}>Not set</Badge>
          )}
          {status?.hint && <span className="font-metric text-[11px] text-muted-foreground">{status.hint}</span>}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{f.use}</p>
        <a href={f.link} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] text-emerald hover:underline">
          <ExternalLink className="size-3" /> {f.where}
        </a>
      </div>
      <div className="min-w-0 space-y-2">
        <div className="flex gap-2">
          <input
            type={f.secret ? "password" : "text"}
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setCheck(null);
            }}
            placeholder={f.secret ? (src === "none" ? "Paste the key" : "Paste a new key to replace it") : status?.hint || "Value"}
            className="h-9 min-w-0 flex-1 rounded-md border border-border bg-card px-2.5 font-metric text-[13px] outline-none focus:border-emerald/60"
          />
          <Button size="sm" onClick={() => save(value.trim())} disabled={!value.trim() || busy !== null}>
            {busy === "save" ? <Loader2 className="size-3.5 animate-spin" /> : null} Save
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {f.testable && (
            <Button size="xs" variant="outline" onClick={test} disabled={busy !== null || (src === "none" && !value.trim())}>
              {busy === "test" ? <Loader2 className="size-3 animate-spin" /> : null} {value.trim() ? "Test this key" : "Test current key"}
            </Button>
          )}
          {src === "dashboard" && (
            <Button size="xs" variant="ghost" onClick={() => save(null)} disabled={busy !== null}>
              {busy === "clear" ? <Loader2 className="size-3 animate-spin" /> : null} Remove
            </Button>
          )}
          {check && (
            <span className={cn("inline-flex items-center gap-1 text-[11px]", check.ok ? "text-emerald" : "text-rose-600")}>
              {check.ok ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />} {check.detail}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

