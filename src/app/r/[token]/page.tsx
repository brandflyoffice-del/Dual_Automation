import { notFound } from "next/navigation";
import { Zap } from "lucide-react";
import { db } from "@/lib/db";
import { ReportView } from "@/components/reports/report-view";
import { PrintControls } from "@/components/reports/report-actions";
import type { ReportMetrics } from "@/lib/queries";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(d);

export default async function SharedReport({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const { token } = await params;
  const { print } = await searchParams;
  const report = await db.weeklyReport.findUnique({ where: { shareToken: token } });
  if (!report) notFound();

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald to-indigo text-white">
            <Zap className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Weekly Outreach Report</h1>
            <p className="text-sm text-muted-foreground">
              BrandFly · {fmt(report.weekStart)} – {fmt(report.weekEnd)}
            </p>
          </div>
        </div>
        <PrintControls auto={print === "1"} />
      </header>
      <ReportView metrics={report.metrics as unknown as ReportMetrics} weekStart={report.weekStart} weekEnd={report.weekEnd} />
      <footer className="mt-8 text-center text-[11px] text-muted-foreground">
        Generated {fmt(report.createdAt)} · Shared via a private link · BrandFly
      </footer>
    </div>
  );
}
