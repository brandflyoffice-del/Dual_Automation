import Link from "next/link";
import { ExportMenu } from "@/components/export-menu";
import { AlertTriangle, Bot, CalendarCheck2, CheckCircle2, Hourglass, Inbox, MailCheck, MailX, MessageSquareReply, Send, UserMinus, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { LiveRefresh } from "@/components/live-refresh";
import { DailyEmailChart } from "@/components/charts";
import { db } from "@/lib/db";
import { campaignStats, dayWiseStats, listCampaigns, listMailboxes, smartleadConfigured, type SlCampaignStats, type SlDay, type SlMailbox } from "@/lib/smartlead";
import { cn, formatPct, safePct } from "@/lib/utils";
import { config } from "@/lib/config";
import { AddMailbox, CampaignSendingButton, SendingSwitch, SyncMailboxes, ToolLinks, WarmupButton } from "@/components/analytics/controls";

export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90] as const;

function Kpi({ label, value, sub, icon: Icon, tone }: { label: string; value: string; sub: string; icon: React.ComponentType<{ className?: string }>; tone?: "emerald" | "rose" }) {
  return (
    <Card>
      <CardContent className="p-4 pt-4">
        <div className="mb-3 flex items-start justify-between gap-2 text-xs text-muted-foreground">
          <span className="leading-snug">{label}</span>
          <Icon className={cn("size-4 shrink-0", tone === "emerald" && "text-emerald", tone === "rose" && "text-rose-500")} />
        </div>
        <div className={cn("font-metric text-2xl font-semibold sm:text-3xl", tone === "emerald" && "text-emerald")}>{value}</div>
        <div className="mt-1.5 text-[11px] text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}

const STATUS_VARIANT: Record<string, "emerald" | "amber" | "outline" | "rose" | "sky"> = {
  ACTIVE: "emerald",
  PAUSED: "amber",
  DRAFTED: "outline",
  COMPLETED: "sky",
  STOPPED: "rose",
};

async function load(days: number) {
  const end = new Date();
  const start = new Date(end.getTime() - (days - 1) * 86_400_000);
  const since = new Date(start.toISOString().slice(0, 10) + "T00:00:00Z");
  const [smartlead, local] = await Promise.all([
    (async () => {
      try {
        const campaigns = await listCampaigns();
        const [stats, mailboxes, daily] = await Promise.all([
          Promise.all(campaigns.map((c) => campaignStats(c))),
          listMailboxes(),
          dayWiseStats(start, end),
        ]);
        return { stats, mailboxes, daily, error: null as string | null };
      } catch (e) {
        return { stats: [] as SlCampaignStats[], mailboxes: [] as SlMailbox[], daily: [] as SlDay[], error: (e as Error).message };
      }
    })(),
    (async () => {
      const [replies, aiReplies, manualReplies, meetings] = await Promise.all([
        db.emailEvent.groupBy({ by: ["sentiment"], where: { type: "REPLY_RECEIVED", occurredAt: { gte: since } }, _count: { _all: true } }),
        db.emailEvent.count({ where: { type: "AI_REPLY_SENT", occurredAt: { gte: since } } }),
        db.emailEvent.count({ where: { type: "MANUAL_REPLY_SENT", occurredAt: { gte: since } } }),
        db.meeting.count({ where: { createdAt: { gte: since } } }),
      ]).catch(() => [[], 0, 0, 0] as const);
      return { replies, aiReplies, manualReplies, meetings };
    })(),
  ]);
  return { ...smartlead, ...local };
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const sp = await searchParams;
  const days = RANGES.includes(Number(sp.days) as (typeof RANGES)[number]) ? Number(sp.days) : 30;
  const configured = smartleadConfigured();
  const data = configured ? await load(days) : null;

  const sum = (k: keyof Omit<SlDay, "date">) => (data?.daily ?? []).reduce((a, d) => a + d[k], 0);
  const sent = sum("sent");
  const replied = sum("replied");
  const bounced = sum("bounced");
  const unsub = sum("unsubscribed");
  const bySentiment = Object.fromEntries((data?.replies ?? []).map((r) => [r.sentiment ?? "Unclassified", r._count._all])) as Record<string, number>;
  const positive = bySentiment.Positive_Booking_Intent ?? 0;
  const capacity = (data?.mailboxes ?? []).reduce((a, m) => a + m.dailyLimit, 0);
  const sentToday = (data?.mailboxes ?? []).reduce((a, m) => a + m.sentToday, 0);
  const stats = data?.stats ?? [];
  const leadsTotal = stats.reduce((a, c) => a + c.leads.total, 0);
  const contacted = stats.reduce((a, c) => a + c.uniqueSent, 0);
  const notStarted = stats.reduce((a, c) => a + c.leads.notStarted, 0);
  const inProgress = stats.reduce((a, c) => a + c.leads.inProgress, 0);
  const finished = stats.reduce((a, c) => a + c.leads.completed + c.leads.stopped, 0);
  const mailboxesOk = (data?.mailboxes ?? []).filter((m) => m.smtpOk && m.imapOk).length;

  return (
    <>
      <PageHeader
        title="Email Analytics"
        description="Everything Smartlead knows, live: emails sent, replies, bounces, every campaign and every sending mailbox. No need to open Smartlead."
        actions={
          <>
            <div className="flex rounded-md border border-border bg-card p-0.5">
              {RANGES.map((r) => (
                <Link
                  key={r}
                  href={`/analytics?days=${r}`}
                  className={cn("rounded px-2.5 py-1 text-xs", r === days ? "bg-emerald/10 font-medium text-emerald" : "text-muted-foreground hover:text-foreground")}
                >
                  {r} days
                </Link>
              ))}
            </div>
            <ExportMenu dataset="emails" />
            <LiveRefresh />
          </>
        }
      />

      {!configured || data?.error ? (
        <Card className="mb-4 border-amber-500/40">
          <CardContent className="flex items-start gap-2 p-4 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <span>{!configured ? "The Smartlead API key is not configured on this dashboard." : `Smartlead did not answer: ${data?.error}`}</span>
          </CardContent>
        </Card>
      ) : null}

      {configured && !data?.error && (
        <div className="mb-4 space-y-2">
          <SendingSwitch active={stats.filter((c) => c.status === "ACTIVE").length} campaigns={stats.length} leadsWaiting={notStarted} />
          <ToolLinks
            links={[
              { label: "Smartlead campaigns", href: "https://app.smartlead.ai/app/email-campaigns" },
              { label: "Smartlead mailboxes", href: "https://app.smartlead.ai/app/email-accounts" },
              { label: "Smartlead inbox", href: "https://app.smartlead.ai/app/master-inbox" },
              { label: "Apify runs", href: "https://console.apify.com/actors/runs" },
              { label: "n8n workflow", href: `${(process.env.N8N_PUBLIC_URL || "https://n8n.zmart.cloud").replace(/\/$/, "")}/workflow/fenebrisAutopilot01` },
              { label: "Cal.com bookings", href: "https://app.cal.com/bookings/upcoming" },
              { label: "Google Calendar", href: config.calendarUrl },
              { label: "Google Sheet", href: config.sheetUrl },
            ]}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Emails sent" value={String(sent)} sub={`last ${days} days, all campaigns`} icon={Send} />
        <Kpi label="Replies" value={String(replied)} sub={`${formatPct(safePct(replied, sent))} reply rate`} icon={MessageSquareReply} tone="emerald" />
        <Kpi label="Interested" value={String(positive)} sub="AI read the reply as a yes" icon={MailCheck} tone="emerald" />
        <Kpi label="Meetings booked" value={String(data?.meetings ?? 0)} sub={`last ${days} days`} icon={CalendarCheck2} tone="emerald" />
        <Kpi label="Bounced" value={String(bounced)} sub={`${formatPct(safePct(bounced, sent))} of sent`} icon={MailX} tone={bounced ? "rose" : undefined} />
        <Kpi label="Unsubscribed" value={String(unsub)} sub="asked not to be emailed" icon={UserMinus} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Leads uploaded" value={String(leadsTotal)} sub="in all Smartlead campaigns" icon={Users} />
        <Kpi label="Contacted" value={String(contacted)} sub="got at least email 1" icon={MailCheck} />
        <Kpi label="Waiting to start" value={String(notStarted)} sub="queued, not emailed yet" icon={Hourglass} />
        <Kpi label="In sequence" value={String(inProgress)} sub="follow-ups still to go" icon={Send} />
        <Kpi label="Finished" value={String(finished)} sub="replied or all 4 emails sent" icon={CheckCircle2} />
        <Kpi
          label="Mailboxes"
          value={`${mailboxesOk} / ${data?.mailboxes.length ?? 0}`}
          sub={`connected · ${sentToday} of ${capacity} sent today`}
          icon={Inbox}
          tone={(data?.mailboxes.length ?? 0) > mailboxesOk ? "rose" : "emerald"}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Day by day</CardTitle>
            <CardDescription>Sent, replied and bounced per day across every mailbox (Smartlead counts).</CardDescription>
          </CardHeader>
          <CardContent>
            <DailyEmailChart data={data?.daily ?? []} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Replies by intent</CardTitle>
            <CardDescription>How the AI read each reply, and who answered.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              ["Interested / wants a meeting", bySentiment.Positive_Booking_Intent ?? 0, "bg-emerald"],
              ["Question first", bySentiment.Question_Needs_FollowUp ?? 0, "bg-indigo"],
              ["Not interested", bySentiment.Not_Interested ?? 0, "bg-rose-500"],
              ["Out of office", bySentiment.Out_Of_Office ?? 0, "bg-amber-500"],
            ].map(([label, n, color]) => (
              <div key={label as string} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className={cn("size-2 rounded-full", color as string)} />
                  {label}
                </span>
                <span className="font-metric font-medium">{n}</span>
              </div>
            ))}
            <div className="mt-3 space-y-2 border-t border-border pt-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2"><Bot className="size-3.5 text-emerald" /> AI replies sent</span>
                <span className="font-metric font-medium">{data?.aiReplies ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Answered by you (Inbox)</span>
                <span className="font-metric font-medium">{data?.manualReplies ?? 0}</span>
              </div>
            </div>
            <Link href="/inbox" className="mt-2 inline-block text-xs font-medium text-emerald hover:underline">
              Open the Inbox
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Campaigns</CardTitle>
          <CardDescription>All-time numbers per Smartlead campaign. Open and click tracking is off on purpose (better inbox placement).</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-3 font-medium">Campaign</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 text-right font-medium">Leads</th>
                <th className="py-2 pr-3 text-right font-medium">In progress</th>
                <th className="py-2 pr-3 text-right font-medium">Finished</th>
                <th className="py-2 pr-3 text-right font-medium">Sent</th>
                <th className="py-2 pr-3 text-right font-medium">Replies</th>
                <th className="py-2 pr-3 text-right font-medium">Reply rate</th>
                <th className="py-2 pr-3 text-right font-medium">Bounced</th>
                <th className="py-2 pr-3 text-right font-medium">Unsub.</th>
                <th className="py-2 text-right font-medium">Sending</th>
              </tr>
            </thead>
            <tbody>
              {(data?.stats ?? []).map((c) => (
                <tr key={c.id} className="border-b border-border last:border-b-0">
                  <td className="py-2.5 pr-3">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-[11px] text-muted-foreground">#{c.id}</div>
                  </td>
                  <td className="py-2.5 pr-3">
                    <Badge variant={STATUS_VARIANT[c.status] ?? "outline"}>{c.status === "DRAFTED" ? "Draft" : c.status.charAt(0) + c.status.slice(1).toLowerCase()}</Badge>
                  </td>
                  <td className="py-2.5 pr-3 text-right font-metric">{c.leads.total}</td>
                  <td className="py-2.5 pr-3 text-right font-metric">{c.leads.inProgress}</td>
                  <td className="py-2.5 pr-3 text-right font-metric">{c.leads.completed + c.leads.stopped}</td>
                  <td className="py-2.5 pr-3 text-right font-metric">{c.sent}</td>
                  <td className="py-2.5 pr-3 text-right font-metric">{c.replies}</td>
                  <td className="py-2.5 pr-3 text-right font-metric">{formatPct(safePct(c.replies, c.uniqueSent || c.sent))}</td>
                  <td className="py-2.5 pr-3 text-right font-metric">{c.bounces}</td>
                  <td className="py-2.5 pr-3 text-right font-metric">{c.unsubscribed}</td>
                  <td className="py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <CampaignSendingButton campaignId={c.id} status={c.status} leads={c.leads.total} />
                      <a href={`https://app.smartlead.ai/app/email-campaign/${c.id}/analytics`} target="_blank" rel="noopener noreferrer" className="text-[11px] text-muted-foreground hover:text-foreground hover:underline">Open</a>
                    </div>
                  </td>
                </tr>
              ))}
              {!data?.stats.length && (
                <tr>
                  <td colSpan={11} className="py-6 text-center text-muted-foreground">No campaigns found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Sending mailboxes</CardTitle>
            <div className="flex flex-wrap gap-1.5">
              <AddMailbox />
              <SyncMailboxes />
              <WarmupButton on />
            </div>
          </div>
          <CardDescription>
            {data?.mailboxes.length ?? 0} connected · {sentToday} of {capacity} emails sent today. Warm-up keeps new mailboxes out of spam; leave it on.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-3 font-medium">Mailbox</th>
                <th className="py-2 pr-3 font-medium">Connection</th>
                <th className="py-2 pr-3 text-right font-medium">Sent today</th>
                <th className="py-2 pr-3 font-medium">Warm-up</th>
                <th className="py-2 pr-3 text-right font-medium">Reputation</th>
                <th className="py-2 pr-3 text-right font-medium">Warm-up sent / spam</th>
                <th className="py-2 text-right font-medium">Campaigns</th>
              </tr>
            </thead>
            <tbody>
              {(data?.mailboxes ?? []).map((m) => (
                <tr key={m.id} className="border-b border-border last:border-b-0">
                  <td className="py-2.5 pr-3">
                    <div className="font-medium">{m.fromName}</div>
                    <div className="text-[11px] text-muted-foreground">{m.fromEmail} · {m.type}</div>
                  </td>
                  <td className="py-2.5 pr-3">
                    {m.smtpOk && m.imapOk ? <Badge variant="emerald">Connected</Badge> : <Badge variant="rose">{!m.smtpOk ? "Sending broken" : "Reading broken"}</Badge>}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-metric">
                    {m.sentToday} / {m.dailyLimit}
                  </td>
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-1.5">
                      {m.warmup ? <Badge variant={m.warmup.status === "ACTIVE" ? "emerald" : "amber"}>{m.warmup.status === "ACTIVE" ? "On" : m.warmup.status}</Badge> : <Badge variant="outline">Off</Badge>}
                      <WarmupButton mailboxId={m.id} on={m.warmup?.status === "ACTIVE"} />
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-right font-metric">{m.warmup?.reputation || "–"}</td>
                  <td className="py-2.5 pr-3 text-right font-metric">{m.warmup ? `${m.warmup.sent} / ${m.warmup.spam}` : "–"}</td>
                  <td className="py-2.5 text-right font-metric">{m.campaigns}</td>
                </tr>
              ))}
              {!data?.mailboxes.length && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-muted-foreground">No mailbox connected in Smartlead yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}
