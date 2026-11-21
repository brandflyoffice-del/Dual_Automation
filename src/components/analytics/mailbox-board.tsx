"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pause, Play } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Box = {
  id: string;
  name: string;
  email: string;
  ok: boolean;
  dailyLimit: number;
  sentToday: number;
  stopped: boolean;
  stoppedUntil: string | null;
  warmupOn: boolean;
  reputation: string;
  warmupSent: number;
  warmupSpam: number;
};
type Camp = { id: string; name: string; status: string; mailboxIds: string[] };
type Board = { mailboxes: Box[]; campaigns: Camp[] };

const shortName = (n: string) => n.split(/\s+[—–-]\s+/).pop() || n;
const repNum = (r: string) => Number(String(r).replace("%", "")) || 0;
const repTone = (r: string) => (!r ? "text-muted-foreground" : repNum(r) >= 85 ? "text-emerald" : repNum(r) >= 70 ? "text-amber-700" : "text-rose-600");
const statusLabel: Record<string, string> = { ACTIVE: "Sending", PAUSED: "Paused", DRAFTED: "Draft", COMPLETED: "Done", STOPPED: "Stopped" };
const fmtUntil = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });

/**
 * Email Analytics: one grid of mailboxes × campaigns. Tick = that mailbox sends for that campaign. Per mailbox: daily limit
 * (shared by all its campaigns), Stop for today / Stop until started again / Start. Warm-up keeps running while stopped.
 */
export function MailboxBoard() {
  const [data, setData] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // which cell or row is saving

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/smartlead/mailbox-board", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Could not load mailboxes");
      setData(j);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function act(key: string, payload: Record<string, unknown>, done: string) {
    setBusy(key);
    try {
      const r = await fetch("/api/smartlead/mailbox-board", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Not saved");
      setData({ mailboxes: j.mailboxes, campaigns: j.campaigns });
      toast.success(done);
    } catch (e) {
      toast.error("Not changed", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  function toggle(box: Box, camp: Camp) {
    const on = camp.mailboxIds.includes(box.id);
    if (on && camp.status === "ACTIVE") {
      const left = camp.mailboxIds.filter((id) => id !== box.id && !data?.mailboxes.find((m) => m.id === id)?.stopped).length;
      if (left === 0 && !window.confirm(`${shortName(camp.name)} is sending and this is its last working mailbox. Without one it sends nothing. Remove it anyway?`)) return;
    }
    act(
      `${box.id}:${camp.id}`,
      { action: on ? "detach" : "attach", campaignId: camp.id, mailboxId: box.id },
      on ? `${box.email} no longer sends for ${shortName(camp.name)}` : `${box.email} now sends for ${shortName(camp.name)}`,
    );
  }

  if (error && !data) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-rose-600">{error}</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mailboxes and campaigns</CardTitle>
        <CardDescription>
          Tick which mailboxes send for each campaign. A mailbox&apos;s daily limit is shared by all its campaigns. If a mailbox&apos;s reputation drops, stop it here:
          it stays in its campaigns but sends nothing, and warm-up keeps running so it can recover.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {!data ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading mailboxes and campaigns…
          </div>
        ) : (
          <table className="w-full min-w-[900px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border align-bottom">
                <th className="py-2 pr-3 font-medium">Mailbox</th>
                <th className="py-2 pr-3 text-right font-medium" title="Warm-up reputation, and warm-up emails that landed in spam over the last 7 days">
                  Reputation · spam (7 d)
                </th>
                <th className="py-2 pr-3 text-right font-medium">Per day</th>
                {data.campaigns.map((c) => (
                  <th key={c.id} className="w-24 px-1 py-2 text-center font-medium">
                    <div className="leading-tight text-foreground">{shortName(c.name)}</div>
                    <div className={cn("text-[10px]", c.status === "ACTIVE" ? "text-emerald" : "text-muted-foreground")}>{statusLabel[c.status] ?? c.status}</div>
                  </th>
                ))}
                <th className="py-2 pl-3 text-right font-medium">Sending</th>
              </tr>
            </thead>
            <tbody>
              {data.mailboxes.map((m) => {
                const spamPct = m.warmupSent ? Math.round((m.warmupSpam / m.warmupSent) * 100) : null;
                return (
                  <tr key={m.id} className={cn("border-b border-border last:border-b-0", m.stopped && "bg-rose-50/50")}>
                    <td className="py-2.5 pr-3">
                      <div className="font-medium">{m.email}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {m.name}
                        {!m.ok && <span className="ml-1 text-rose-600">· connection broken</span>}
                        {!m.warmupOn && <span className="ml-1 text-amber-700">· warm-up off</span>}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-right font-metric">
                      <span className={repTone(m.reputation)}>{m.reputation || "–"}</span>
                      <span className="text-muted-foreground"> · {spamPct === null ? "–" : `${spamPct}%`}</span>
                    </td>
                    <td className="py-2.5 pr-3 text-right">
                      <LimitInput box={m} saving={busy === `limit:${m.id}`} onSave={(limit) => act(`limit:${m.id}`, { action: "limit", mailboxId: m.id, limit }, `${m.email}: up to ${limit} emails a day`)} />
                      <div className="mt-0.5 text-[10px] text-muted-foreground">{m.sentToday} sent today</div>
                    </td>
                    {data.campaigns.map((c) => {
                      const on = c.mailboxIds.includes(m.id);
                      const key = `${m.id}:${c.id}`;
                      return (
                        <td key={c.id} className="px-1 py-2.5 text-center">
                          {busy === key ? (
                            <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" />
                          ) : (
                            <input
                              type="checkbox"
                              checked={on}
                              disabled={!!busy}
                              onChange={() => toggle(m, c)}
                              aria-label={`${m.email} sends for ${c.name}`}
                              className="size-4 cursor-pointer accent-emerald-600"
                            />
                          )}
                        </td>
                      );
                    })}
                    <td className="py-2.5 pl-3 text-right">
                      {m.stopped ? (
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="rose">{m.stoppedUntil ? `Stopped until ${fmtUntil(m.stoppedUntil)}` : "Stopped"}</Badge>
                          <Button size="xs" variant="secondary" disabled={!!busy} onClick={() => act(`row:${m.id}`, { action: "start", mailboxId: m.id }, `${m.email} sends again`)}>
                            {busy === `row:${m.id}` ? <Loader2 className="animate-spin" /> : <Play />} Start
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="emerald">On</Badge>
                          <div className="flex gap-1">
                            <Button size="xs" variant="ghost" disabled={!!busy} title="Sends nothing until midnight New York time, then starts again by itself"
                              onClick={() => act(`row:${m.id}`, { action: "stop", mailboxId: m.id, today: true }, `${m.email} stopped for today`)}>
                              <Pause /> Stop today
                            </Button>
                            <Button size="xs" variant="destructive" disabled={!!busy} title="Sends nothing until you press Start"
                              onClick={() => window.confirm(`Stop ${m.email} until you start it again? It stays in its campaigns; warm-up keeps running.`) && act(`row:${m.id}`, { action: "stop", mailboxId: m.id, today: false }, `${m.email} stopped`)}>
                              {busy === `row:${m.id}` ? <Loader2 className="animate-spin" /> : <Pause />} Stop
                            </Button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!data.mailboxes.length && (
                <tr>
                  <td colSpan={4 + data.campaigns.length} className="py-6 text-center text-muted-foreground">No mailbox connected in Smartlead yet.</td>
                </tr>
              )}
            </tbody>
            {data.mailboxes.length > 0 && (
              <tfoot>
                <tr className="border-t border-border text-[11px] text-muted-foreground">
                  <td className="py-2 pr-3" colSpan={3}>
                    Working mailboxes per campaign · most emails a day (limits are shared, so campaigns split them)
                  </td>
                  {data.campaigns.map((c) => {
                    const working = data.mailboxes.filter((m) => c.mailboxIds.includes(m.id) && !m.stopped);
                    const perDay = working.reduce((s, m) => s + m.dailyLimit, 0);
                    return (
                      <td key={c.id} className={cn("px-1 py-2 text-center font-metric", c.status === "ACTIVE" && !working.length && "font-semibold text-rose-600")}>
                        {working.length} · {perDay}
                      </td>
                    );
                  })}
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function LimitInput({ box, saving, onSave }: { box: Box; saving: boolean; onSave: (n: number) => void }) {
  const [v, setV] = useState(String(box.dailyLimit));
  useEffect(() => setV(String(box.dailyLimit)), [box.dailyLimit]);
  const commit = () => {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n) || n < 1 || n > 200) return setV(String(box.dailyLimit));
    if (n !== box.dailyLimit) onSave(n);
  };
  return (
    <div className="flex items-center justify-end gap-1">
      {saving && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
      <Input
        type="number"
        min={1}
        max={200}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="h-7 w-16 text-right text-xs"
        aria-label={`Daily limit for ${box.email}`}
      />
    </div>
  );
}
