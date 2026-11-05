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

const PRESETS = [
  { id: "same", label: "Same server as my mailboxes", smtpHost: "smtp.yearncliff.com", smtpPort: 465, imapHost: "imap.yearncliff.com", imapPort: 993 },
  { id: "google", label: "Google Workspace (app password)", smtpHost: "smtp.gmail.com", smtpPort: 465, imapHost: "imap.gmail.com", imapPort: 993 },
  { id: "microsoft", label: "Microsoft 365", smtpHost: "smtp.office365.com", smtpPort: 587, imapHost: "outlook.office365.com", imapPort: 993 },
  { id: "zoho", label: "Zoho Mail", smtpHost: "smtp.zoho.com", smtpPort: 465, imapHost: "imap.zoho.com", imapPort: 993 },
];

/** Add a sending mailbox (SMTP/IMAP) from the dashboard: created in Smartlead with warm-up, then watched for replies. */
export function AddMailbox() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    fromName: "",
    fromEmail: "",
    username: "",
    password: "",
    smtpHost: PRESETS[0].smtpHost,
    smtpPort: String(PRESETS[0].smtpPort),
    imapHost: PRESETS[0].imapHost,
    imapPort: String(PRESETS[0].imapPort),
    dailyLimit: "20",
    warmup: true,
  });
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  const field = "mt-0.5 h-8 w-full rounded-md border border-border bg-card px-2.5 text-[13px] outline-none focus:border-emerald/60";

  async function submit() {
    setBusy(true);
    const { ok, j } = await post("/api/mailboxes", {
      ...f,
      smtpPort: Number(f.smtpPort),
      imapPort: Number(f.imapPort),
      dailyLimit: Number(f.dailyLimit) || 20,
      username: f.username || undefined,
    });
    setBusy(false);
    if (ok) {
      toast.success("Mailbox added", { description: `${f.fromEmail} is in Smartlead (warm-up ${f.warmup ? "on" : "off"}); replies to it are answered within seconds.` });
      setOpen(false);
      router.refresh();
    } else toast.error("Mailbox not added", { description: j?.error || "Check the email, password and server settings." });
  }

  return (
    <>
      <Button size="xs" variant="default" onClick={() => setOpen(true)}>
        + Add mailbox
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3" onClick={() => !busy && setOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 text-base font-semibold">Add a sending mailbox</div>
            <p className="mb-3 text-[12px] text-muted-foreground">
              For mailboxes with a password or app password (SMTP/IMAP). Gmail or Outlook mailboxes connected with &quot;Sign in with Google/Microsoft&quot; are
              added in Smartlead, then use <b>Sync from Smartlead</b>.
            </p>
            <div className="mb-3 flex flex-wrap gap-1">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setF((o) => ({ ...o, smtpHost: p.smtpHost, smtpPort: String(p.smtpPort), imapHost: p.imapHost, imapPort: String(p.imapPort) }))}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px]",
                    f.smtpHost === p.smtpHost ? "border-emerald/40 bg-emerald/10 font-medium text-emerald" : "border-border text-muted-foreground",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <label className="col-span-2">
                Sender name
                <input className={field} value={f.fromName} onChange={(e) => set("fromName", e.target.value)} placeholder="Jay Tap" />
              </label>
              <label className="col-span-2">
                Email address
                <input className={field} value={f.fromEmail} onChange={(e) => set("fromEmail", e.target.value)} placeholder="jay@yourdomain.com" />
              </label>
              <label className="col-span-2">
                Password or app password
                <input className={field} type="password" value={f.password} onChange={(e) => set("password", e.target.value)} />
              </label>
              <label className="col-span-2">
                Login username (if not the email)
                <input className={field} value={f.username} onChange={(e) => set("username", e.target.value)} placeholder="usually the email address" />
              </label>
              <label>
                SMTP server
                <input className={field} value={f.smtpHost} onChange={(e) => set("smtpHost", e.target.value)} />
              </label>
              <label>
                SMTP port
                <input className={field} inputMode="numeric" value={f.smtpPort} onChange={(e) => set("smtpPort", e.target.value)} />
              </label>
              <label>
                IMAP server
                <input className={field} value={f.imapHost} onChange={(e) => set("imapHost", e.target.value)} />
              </label>
              <label>
                IMAP port
                <input className={field} inputMode="numeric" value={f.imapPort} onChange={(e) => set("imapPort", e.target.value)} />
              </label>
              <label>
                Emails per day
                <input className={field} inputMode="numeric" value={f.dailyLimit} onChange={(e) => set("dailyLimit", e.target.value)} />
              </label>
              <label className="flex items-end gap-2 pb-1.5">
                <input type="checkbox" checked={f.warmup} onChange={(e) => set("warmup", e.target.checked)} className="size-4 accent-[var(--emerald)]" /> Start warm-up
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button size="sm" onClick={submit} disabled={busy || !f.fromEmail.includes("@") || f.password.length < 4 || f.fromName.trim().length < 2}>
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : null} Add mailbox
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Smartlead tests the login before saving. The password is stored encrypted.</p>
          </div>
        </div>
      )}
    </>
  );
}

export function SyncMailboxes() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="xs"
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const r = await fetch("/api/mailboxes/sync", { method: "POST" }).catch(() => null);
        const j = (await r?.json().catch(() => null)) as { imported?: number; skipped?: string[]; error?: string } | null;
        setBusy(false);
        if (r?.ok) {
          toast.success(`${j?.imported ?? 0} mailboxes synced from Smartlead`, {
            description: j?.skipped?.length ? `Not importable: ${j.skipped.join(", ")}` : "They are used for answers and watched for replies.",
          });
        } else toast.error("Sync failed", { description: j?.error || "Try again" });
        router.refresh();
      }}
    >
      {busy ? <Loader2 className="size-3 animate-spin" /> : null} Sync from Smartlead
    </Button>
  );
}
