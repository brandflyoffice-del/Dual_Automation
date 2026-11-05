"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, Flame, Loader2, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  const j = (await r?.json().catch(() => null)) as { ok?: boolean; error?: string; failed?: string[]; attached?: number; changed?: number } | null;
  return { ok: !!r?.ok && j?.ok !== false, j };
}

/** Two-step button: the first click arms it, the second does the action (avoids starting sends by accident). */
function ConfirmButton({
  label,
  confirmLabel,
  icon: Icon,
  variant = "outline",
  onConfirm,
  className,
}: {
  label: string;
  confirmLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "outline" | "default" | "secondary" | "indigo";
  onConfirm: () => Promise<void>;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="xs"
      variant={armed ? "indigo" : variant}
      disabled={busy}
      className={className}
      onBlur={() => setArmed(false)}
      onClick={async () => {
        if (!armed) return setArmed(true);
        setBusy(true);
        await onConfirm();
        setBusy(false);
        setArmed(false);
      }}
    >
      {busy ? <Loader2 className="size-3 animate-spin" /> : <Icon className="size-3" />}
      {armed ? confirmLabel : label}
    </Button>
  );
}

/** Whole-account switch at the top of Email Analytics. */
export function SendingSwitch({ active, campaigns, leadsWaiting }: { active: number; campaigns: number; leadsWaiting: number }) {
  const router = useRouter();
  const on = active > 0;
  async function set(next: boolean) {
    const { ok, j } = await post("/api/smartlead/sending", { all: true, on: next });
    if (ok) toast.success(next ? "Sending started" : "Sending paused", { description: next ? `Email 1 goes out on each campaign's schedule${j?.attached ? `; ${j.attached} mailbox links added` : ""}.` : "Launch keeps adding leads; nothing is emailed until you start again." });
    else toast.error("Smartlead did not accept it", { description: j?.failed?.join(" · ") || j?.error || "Try again" });
    router.refresh();
  }
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3", on ? "border-emerald/30 bg-emerald/[0.05]" : "border-amber-500/30 bg-amber-500/[0.06]")}>
      <div className="flex items-center gap-2.5">
        <span className={cn("size-2.5 rounded-full", on ? "bg-emerald" : "bg-amber-500")} />
        <div>
          <div className="text-sm font-semibold">{on ? `Sending is ON · ${active} of ${campaigns} campaigns active` : "Sending is OFF · collecting leads only"}</div>
          <div className="text-[11px] text-muted-foreground">
            {on ? "Email 1 and follow-ups go out within each mailbox's daily limit." : `${leadsWaiting} leads are waiting. Launch keeps adding leads; nobody is emailed until you start sending.`}
          </div>
        </div>
      </div>
      <div className="flex gap-1.5">
        {on ? (
          <ConfirmButton label="Pause all sending" confirmLabel="Click again to pause all" icon={Pause} onConfirm={() => set(false)} />
        ) : (
          <ConfirmButton label="Start sending (all campaigns)" confirmLabel="Click again to start sending" icon={Play} variant="default" onConfirm={() => set(true)} />
        )}
      </div>
    </div>
  );
}

export function CampaignSendingButton({ campaignId, status, leads }: { campaignId: string; status: string; leads: number }) {
  const router = useRouter();
  const active = status === "ACTIVE";
  async function set(next: boolean) {
    const { ok, j } = await post("/api/smartlead/sending", { campaignId, on: next });
    if (ok) toast.success(next ? "Campaign started" : "Campaign paused", { description: next && j?.attached ? `${j.attached} mailboxes linked to it.` : undefined });
    else toast.error("Smartlead did not accept it", { description: j?.failed?.join(" · ") || j?.error || "Try again" });
    router.refresh();
  }
  if (active) return <ConfirmButton label="Pause" confirmLabel="Confirm pause" icon={Pause} onConfirm={() => set(false)} />;
  if (!leads) return <span className="text-[11px] text-muted-foreground">No leads yet</span>;
  return <ConfirmButton label="Start" confirmLabel={`Start ${leads} leads?`} icon={Play} onConfirm={() => set(true)} />;
}

export function WarmupButton({ mailboxId, on }: { mailboxId?: string; on: boolean }) {
  const router = useRouter();
  const all = !mailboxId;
  async function set(next: boolean) {
    const { ok, j } = await post("/api/smartlead/warmup", all ? { all: true, enabled: next } : { mailboxId, enabled: next });
    if (ok) toast.success(next ? `Warm-up on${all ? ` for ${j?.changed ?? "all"} mailboxes` : ""}` : "Warm-up off");
    else toast.error("Smartlead did not accept it", { description: j?.failed?.join(" · ") || j?.error || "Try again" });
    router.refresh();
  }
  if (all) return <ConfirmButton label="Warm-up on for all" confirmLabel="Click again to confirm" icon={Flame} onConfirm={() => set(true)} />;
  return on ? (
    <ConfirmButton label="Stop" confirmLabel="Stop warm-up?" icon={Pause} onConfirm={() => set(false)} />
  ) : (
    <ConfirmButton label="Start warm-up" confirmLabel="Confirm" icon={Flame} onConfirm={() => set(true)} />
  );
}

/** One-click links to the tools behind the dashboard, each opening in a new tab. */
export function ToolLinks({ links }: { links: { label: string; href: string }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground hover:border-emerald/40 hover:text-foreground"
        >
          <ExternalLink className="size-3" /> {l.label}
        </a>
      ))}
    </div>
  );
}
