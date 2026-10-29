"use client";

import { useMemo, useState } from "react";
import { CalendarCheck, CheckCircle2, Clock, Eye, MousePointerClick, Pause, Play, Reply, Search } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { StepBars } from "@/components/charts";
import { RegionBadge, SentimentBadge, StageBadge } from "@/components/badges";
import { SEQUENCE_STEPS, STAGE_LABEL } from "@/lib/constants";
import { cn, formatIst, formatPct } from "@/lib/utils";
import type { SequenceLead } from "@/lib/types";

type Step = {
  step: number;
  scheduled: number;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  openRate: number;
  replyRate: number;
};

export function SequenceMonitor({ steps, leads }: { steps: Step[]; leads: SequenceLead[] }) {
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string>(leads.find((l) => l.stage !== "SCRAPED")?.id ?? leads[0]?.id);
  const [selectedStep, setSelectedStep] = useState<number>(1);
  const [overrides, setOverrides] = useState<Record<string, Partial<Pick<SequenceLead, "paused" | "stage" | "sentiment">>>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const data = useMemo(() => leads.map((l) => ({ ...l, ...overrides[l.id] })), [leads, overrides]);
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return data.filter((l) => !n || `${l.name} ${l.company} ${STAGE_LABEL[l.stage]}`.toLowerCase().includes(n));
  }, [data, q]);
  const lead = data.find((l) => l.id === selectedId) ?? null;
  const current = lead?.steps.find((s) => s.step === selectedStep) ?? lead?.steps[0];

  async function act(action: "pause" | "resume" | "push_to_booking") {
    if (!lead) return;
    const prev = overrides[lead.id];
    setBusy(action);
    setOverrides((o) => ({
      ...o,
      [lead.id]:
        action === "push_to_booking"
          ? { paused: true, stage: lead.stage === "BOOKED" ? "BOOKED" : "REPLIED", sentiment: "Positive_Booking_Intent" }
          : { ...o[lead.id], paused: action === "pause" },
    }));
    try {
      const res = await fetch(`/api/leads/${lead.id}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "failed");
      const label = { pause: "Follow-ups paused", resume: "Follow-ups resumed", push_to_booking: "Pushed to booking stage" }[action];
      toast.success(`${label} · ${lead.company}`, {
        description: json.n8n?.ok
          ? action === "push_to_booking"
            ? "n8n is sending the AI booking email with open slots"
            : "Outreach platform updated via n8n"
          : "Saved in dashboard. n8n not reachable — outreach platform unchanged",
      });
    } catch {
      setOverrides((o) => ({ ...o, [lead.id]: prev ?? {} }));
      toast.error("Action failed. Reverted.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        {SEQUENCE_STEPS.map((def) => {
          const s = steps.find((x) => x.step === def.step)!;
          return (
            <Card key={def.step}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <Badge variant="indigo" className="font-metric">
                    Day {def.day}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">Email {def.step}</span>
                </div>
                <div className="mt-2 text-[13px] font-medium leading-snug">{def.name}</div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="font-metric text-lg">{s.sent}</div>
                    <div className="text-[10px] text-muted-foreground">sent</div>
                  </div>
                  <div>
                    <div className="font-metric text-lg text-indigo-700">{formatPct(s.openRate, 0)}</div>
                    <div className="text-[10px] text-muted-foreground">opened</div>
                  </div>
                  <div>
                    <div className="font-metric text-lg text-emerald">{formatPct(s.replyRate, 0)}</div>
                    <div className="text-[10px] text-muted-foreground">replied</div>
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">{s.scheduled} scheduled</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Open & reply rate per step</CardTitle>
          <CardDescription>Based on emails actually sent</CardDescription>
        </CardHeader>
        <CardContent>
          <StepBars data={SEQUENCE_STEPS.map((d) => ({ name: `Email ${d.step} · Day ${d.day}`, openRate: steps[d.step - 1].openRate, replyRate: steps[d.step - 1].replyRate }))} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a lead…" className="h-9 pl-8 text-xs" />
            </div>
          </div>
          <ul className="max-h-[640px] divide-y divide-border/60 overflow-y-auto">
            {filtered.map((l) => (
              <li key={l.id}>
                <button
                  onClick={() => {
                    setSelectedId(l.id);
                    setSelectedStep(Math.max(1, l.steps.filter((s) => s.status === "SENT").length));
                  }}
                  className={cn(
                    "w-full cursor-pointer px-4 py-3 text-left transition-colors hover:bg-foreground/[0.04]",
                    selectedId === l.id && "bg-foreground/[0.06]",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{l.company}</span>
                    <RegionBadge region={l.region} />
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {l.name} · {l.role}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <StageBadge stage={l.stage} />
                    {l.paused && <Badge variant="amber">Paused</Badge>}
                  </div>
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No leads found.</li>}
          </ul>
        </Card>

        {lead ? (
          <Card>
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">{lead.company}</CardTitle>
                <CardDescription>
                  {lead.name} · {lead.role}
                </CardDescription>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <StageBadge stage={lead.stage} />
                  <SentimentBadge sentiment={lead.sentiment} />
                  {lead.paused && <Badge variant="amber">Follow-ups paused</Badge>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {lead.paused ? (
                  <Button size="sm" variant="secondary" disabled={busy !== null || lead.stage === "BOOKED"} onClick={() => act("resume")}>
                    <Play /> Resume follow-ups
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" disabled={busy !== null || lead.stage === "BOOKED"} onClick={() => act("pause")}>
                    <Pause /> Pause follow-ups
                  </Button>
                )}
                <Button size="sm" disabled={busy !== null || lead.stage === "BOOKED"} onClick={() => act("push_to_booking")}>
                  <CalendarCheck /> Push to booking
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ol className="relative ml-2 space-y-1 border-l border-border pl-6">
                {SEQUENCE_STEPS.map((def) => {
                  const s = lead.steps.find((x) => x.step === def.step);
                  const sent = s?.status === "SENT";
                  return (
                    <li key={def.step}>
                      <button
                        onClick={() => setSelectedStep(def.step)}
                        className={cn(
                          "relative w-full cursor-pointer rounded-lg border p-3 text-left transition-colors hover:bg-foreground/[0.04]",
                          selectedStep === def.step ? "border-indigo/50 bg-indigo/[0.06]" : "border-border",
                        )}
                      >
                        <span
                          className={cn(
                            "absolute -left-[31px] top-4 flex size-4 items-center justify-center rounded-full border-2 border-background",
                            s?.replied ? "bg-emerald" : sent ? "bg-indigo" : "bg-zinc-600",
                          )}
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium">
                            Email {def.step}
                            <span className="text-xs font-normal text-muted-foreground">Day {def.day} · {def.name}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                            {sent ? (
                              <>
                                <span className="inline-flex items-center gap-1">
                                  <CheckCircle2 className="size-3.5 text-indigo-700" /> Sent
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <Eye className="size-3.5" />
                                  <span className="font-metric">{s?.opens ?? 0}</span>
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <MousePointerClick className="size-3.5" />
                                  <span className="font-metric">{s?.clicks ?? 0}</span>
                                </span>
                                {s?.replied && (
                                  <span className="inline-flex items-center gap-1 text-emerald">
                                    <Reply className="size-3.5" /> Replied
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="inline-flex items-center gap-1">
                                <Clock className="size-3.5" />
                                {lead.paused ? "Paused" : "Scheduled"}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="font-metric mt-1 text-[11px] text-muted-foreground/80">
                          {sent && s?.sentAt ? formatIst(s.sentAt) : s?.scheduledAt ? `Due ${formatIst(s.scheduledAt)}` : "—"}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ol>

              {current && (
                <div className="mt-5 rounded-xl border border-border bg-background p-4">
                  <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
                    <span>Exact email — Email {current.step} (AI-personalised)</span>
                    <Badge variant={current.status === "SENT" ? "indigo" : "outline"}>{current.status === "SENT" ? "Sent" : "Preview"}</Badge>
                  </div>
                  <div className="mb-2 text-sm font-medium">{current.subject}</div>
                  <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-muted-foreground">{current.body}</pre>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-10 text-center text-sm text-muted-foreground">Select a lead to see its sequence timeline.</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
