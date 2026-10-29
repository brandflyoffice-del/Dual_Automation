import { CalendarCheck2, DollarSign, Mail, MailPlus, MessageSquareReply, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SERVICE_META, type Service } from "@/lib/constants";
import { formatIst, formatPct, formatUsd } from "@/lib/utils";
import type { ReportMetrics } from "@/lib/queries";

const fmt = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(d);

export function ReportView({ metrics, weekStart, weekEnd }: { metrics: ReportMetrics; weekStart: Date; weekEnd: Date }) {
  const stats = [
    { label: "Leads contacted", value: metrics.leadsContacted.toLocaleString(), icon: Users, sub: `${metrics.leadsScraped} new ICP leads sourced` },
    { label: "Follow-ups sent", value: metrics.followUpsSent.toLocaleString(), icon: MailPlus, sub: "Day 3 / 7 / 11 emails" },
    { label: "Replies", value: String(metrics.replies), icon: MessageSquareReply, sub: `${metrics.positiveReplies} wanted to book (${formatPct(metrics.leadsContacted ? (metrics.positiveReplies / metrics.leadsContacted) * 100 : 0)})` },
    { label: "Meetings on Google Calendar", value: String(metrics.meetingsBooked), icon: CalendarCheck2, sub: "Booked & confirmed", primary: true },
    { label: "Pipeline value added", value: formatUsd(metrics.pipelineAdded), icon: DollarSign, sub: "$1k–$25k per qualified opportunity" },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label} className={"primary" in s && s.primary ? "border-emerald/40" : ""}>
            <CardContent className="p-4">
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                {s.label}
                <s.icon className="size-4" />
              </div>
              <div className="font-metric text-2xl font-semibold">{s.value}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">{s.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top-performing industry segments</CardTitle>
            <CardDescription>
              {fmt(weekStart)} – {fmt(weekEnd)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {metrics.topIndustries.every((i) => i.contacted === 0 && i.meetings === 0) ? (
              <p className="text-sm text-muted-foreground">No segment activity in this window.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="pb-2 text-left font-medium">Segment</th>
                    <th className="pb-2 text-right font-medium">Contacted</th>
                    <th className="pb-2 text-right font-medium">Reply</th>
                    <th className="pb-2 text-right font-medium">Meetings</th>
                    <th className="pb-2 text-right font-medium">Pipeline</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.topIndustries.map((i) => (
                    <tr key={i.industry} className="border-t border-border/60">
                      <td className="py-2">{i.label}</td>
                      <td className="font-metric py-2 text-right">{i.contacted}</td>
                      <td className="font-metric py-2 text-right">{formatPct(i.replyRate, 0)}</td>
                      <td className="font-metric py-2 text-right text-emerald">{i.meetings}</td>
                      <td className="font-metric py-2 text-right">{formatUsd(i.pipeline, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Meetings booked this period</CardTitle>
            <CardDescription>Each one is on the closers&apos; Google Calendar with the Meet link and pre-call dossier</CardDescription>
          </CardHeader>
          <CardContent>
            {metrics.meetings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No meetings booked in this window.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {metrics.meetings.map((m, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{m.company}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {m.prospect} · {m.role} {m.service ? `· ${SERVICE_META[m.service as Service]?.short ?? ""}` : ""}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-metric text-xs">{formatIst(m.startTime)}</div>
                      <div className="font-metric text-xs text-emerald">{formatUsd(m.ticket)}+</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Mail className="size-3.5" /> Email-only outreach. Figures are pulled from the live campaign database; no phone outreach is performed.
      </p>
    </div>
  );
}
