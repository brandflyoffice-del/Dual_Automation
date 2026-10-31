import Link from "next/link";
import { CalendarCheck2, DollarSign, Mail, MessageSquareReply, Target, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { FunnelChart, GeoChart, ServiceChart } from "@/components/charts";
import { LiveRefresh } from "@/components/live-refresh";
import { LaunchCampaign } from "@/components/launch-campaign";
import { Badge } from "@/components/ui/badge";
import { ServiceBadge, RegionBadge } from "@/components/badges";
import { getDashboardData } from "@/lib/queries";
import { ICP } from "@/lib/constants";
import { formatDateTime, formatPct, formatUsd } from "@/lib/utils";

export const dynamic = "force-dynamic";

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  primary,
  className,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  primary?: boolean;
  className?: string;
}) {
  return (
    <Card className={`${primary ? "glow-emerald border-emerald/40 bg-gradient-to-b from-emerald/[0.08] to-card" : ""} ${className ?? ""}`}>
      <CardContent className="p-4 pt-4">
        <div className="mb-3 flex items-start justify-between gap-2 text-xs text-muted-foreground">
          <span className={`min-w-0 leading-snug ${primary ? "font-medium text-emerald" : ""}`}>{label}</span>
          <Icon className={`size-4 shrink-0 ${primary ? "text-emerald" : ""}`} />
        </div>
        <div className={`font-metric text-2xl font-semibold sm:text-3xl ${primary ? "text-emerald" : ""}`}>{value}</div>
        <div className="mt-1.5 text-[11px] text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const { kpis, funnel, geo, services, upcoming } = await getDashboardData();

  return (
    <>
      <PageHeader
        title="Executive Command Center"
        description="Email-only outreach for BrandFly. Qualified leads in, meetings on the calendar."
        actions={
          <>
            <LaunchCampaign className="hidden lg:inline-flex" />
            <LiveRefresh />
          </>
        }
      />

      <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-6 xl:grid-cols-5">
        <Kpi
          label="Qualified ICP leads"
          value={kpis.qualifiedLeads.toLocaleString()}
          sub={`${kpis.highPriority} high priority (score 80+)`}
          icon={Target}
          className="lg:col-span-2 xl:col-span-1"
        />
        <Kpi
          label="Active sequences"
          value={String(kpis.activeSequences)}
          sub="Follow-ups running right now"
          icon={Mail}
          className="lg:col-span-2 xl:col-span-1"
        />
        <Kpi
          label="Positive reply rate"
          value={formatPct(kpis.positiveReplyRate)}
          sub={`${kpis.positiveReplies} wanted to book`}
          icon={MessageSquareReply}
          className="lg:col-span-2 xl:col-span-1"
        />
        <Kpi
          label="Booked meetings this week"
          value={String(kpis.meetingsThisWeek)}
          sub={`${kpis.bookedLast7Days} booked in the last 7 days`}
          icon={CalendarCheck2}
          primary
          className="lg:col-span-3 xl:col-span-1"
        />
        <Kpi
          label="Total pipeline value"
          value={formatUsd(kpis.pipelineValue, true)}
          sub={`${kpis.pipelineMeetings} meetings · ${formatUsd(ICP.minTicket)}–${formatUsd(ICP.maxTicketModel)} / opp.`}
          icon={DollarSign}
          className="col-span-2 lg:col-span-3 xl:col-span-1"
        />
      </div>

      <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-3 [&>*]:min-w-0">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Outreach funnel conversion</CardTitle>
            <CardDescription>Scraped → Verified → Emailed → Follow-ups 1–3 → Positive reply → Meeting booked</CardDescription>
          </CardHeader>
          <CardContent>
            <FunnelChart data={funnel} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>Next meetings</CardTitle>
              <CardDescription>Closers just click and join</CardDescription>
            </div>
            <Link href="/meetings" className="text-xs text-emerald hover:underline">
              Open meetings →
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 && <p className="text-sm text-muted-foreground">No upcoming meetings yet.</p>}
            {upcoming.map((m) => (
              <Link
                key={m.id}
                href={`/meetings?open=${m.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-foreground/[0.04]"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{m.lead.companyName}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {m.lead.firstName} {m.lead.lastName} · {m.lead.role}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-metric text-xs">{formatDateTime(m.startTime, "Asia/Kolkata", { weekday: "short" })} IST</div>
                  <Badge variant="emerald" className="font-metric mt-1">
                    {formatUsd(m.estimatedTicket)}+
                  </Badge>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Geo breakdown</CardTitle>
            <CardDescription>US vs UK vs Europe vs UAE — strictly the four target regions</CardDescription>
          </CardHeader>
          <CardContent>
            <GeoChart data={geo} />
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {geo.map((g) => (
                <div key={g.region} className="rounded-lg border border-border p-3">
                  <RegionBadge region={g.region} />
                  <div className="font-metric mt-2 text-lg">{formatPct(g.replyRate)}</div>
                  <div className="text-[11px] text-muted-foreground">positive reply rate</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Service demand matrix</CardTitle>
            <CardDescription>Which of the 4 pillars the AI recommends most</CardDescription>
          </CardHeader>
          <CardContent>
            <ServiceChart data={services} />
            <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
              <TrendingUp className="size-3.5 text-emerald" />
              Pipeline per pillar at {formatUsd(ICP.minTicket)}–{formatUsd(ICP.maxTicketModel)} per qualified opportunity.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span>Top recommended service:</span>
        <ServiceBadge service={[...services].sort((a, b) => b.leads - a.leads)[0]?.service} />
      </div>
    </>
  );
}
