import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { LiveRefresh } from "@/components/live-refresh";
import { ReportView } from "@/components/reports/report-view";
import { GenerateReportButton } from "@/components/reports/report-actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { computeReportMetrics } from "@/lib/queries";
import { endOfWeek, formatUsd, startOfWeek } from "@/lib/utils";
import type { ReportMetrics } from "@/lib/queries";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" }).format(d);

export default async function ReportsPage() {
  const weekStart = startOfWeek();
  const weekEnd = endOfWeek();
  const [live, past] = await Promise.all([
    computeReportMetrics(weekStart, new Date()),
    db.weeklyReport.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
  ]);

  return (
    <>
      <PageHeader
        title="Weekly Transparency & ROI Report"
        description="Leads contacted, follow-ups sent, meetings on Google Calendar, pipeline added and the segments that work — in one shareable link."
        actions={<LiveRefresh />}
      />

      <div className="mb-6">
        <GenerateReportButton />
      </div>

      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-medium">Current week — live</h2>
        <Badge variant="emerald">
          {fmt(weekStart)} – {fmt(weekEnd)}
        </Badge>
      </div>
      <ReportView metrics={live} weekStart={weekStart} weekEnd={weekEnd} />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Generated reports</CardTitle>
          <CardDescription>Snapshots you have shared with the client</CardDescription>
        </CardHeader>
        <CardContent>
          {past.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reports generated yet.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {past.map((r) => {
                const m = r.metrics as unknown as ReportMetrics;
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <div>
                      <div className="font-medium">
                        {fmt(r.weekStart)} – {fmt(r.weekEnd)}
                      </div>
                      <div className="font-metric text-xs text-muted-foreground">
                        {m.leadsContacted} contacted · {m.followUpsSent} follow-ups · {m.meetingsBooked} meetings · {formatUsd(m.pipelineAdded)} pipeline
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/r/${r.shareToken}?print=1`} target="_blank" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                        PDF
                      </Link>
                      <Link href={`/r/${r.shareToken}`} target="_blank" className="inline-flex items-center gap-1 text-xs text-emerald hover:underline">
                        <ExternalLink className="size-3.5" /> Shareable link
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
