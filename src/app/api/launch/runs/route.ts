import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// A stage with zero leads ends the n8n run without a final event, so a run that has been quiet this long is closed here.
const QUIET_MS = 8 * 60_000;

const QUIET_MESSAGE: Record<string, string> = {
  searching: "The search returned no people for these filters. Try wider places, industries or roles.",
  filtering: "No new leads passed your filters (or all were already in your list).",
  checking: "No lead had a valid work email after checking.",
  writing: "The AI did not qualify any of these leads for this campaign.",
  adding: "Finished.",
};

/** Launch runs of the last 24 hours (newest first) with live counts for the progress card. */
export async function GET() {
  const since = new Date(Date.now() - 24 * 3600_000);
  const runs = await db.launchRun.findMany({ where: { startedAt: { gte: since } }, orderBy: { startedAt: "desc" }, take: 5 });
  const out = [];
  for (const r of runs) {
    let run = r;
    if (r.status === "running" && Date.now() - r.updatedAt.getTime() > QUIET_MS) {
      run = await db.launchRun.update({ where: { id: r.id }, data: { status: "done", stage: "done", message: QUIET_MESSAGE[r.stage] ?? "Finished.", finishedAt: new Date() } });
    }
    // Leads saved by this run (the lead lane writes them with the run's campaign and source as it goes).
    const added = await db.lead.count({
      where: { createdAt: { gte: r.startedAt, ...(run.finishedAt ? { lte: new Date(run.finishedAt.getTime() + 60_000) } : {}) }, source: run.provider, ...(run.campaignId ? { campaignId: run.campaignId } : {}) },
    });
    out.push({ ...run, added, startedAt: run.startedAt.toISOString(), updatedAt: run.updatedAt.toISOString(), finishedAt: run.finishedAt?.toISOString() ?? null });
  }
  return NextResponse.json({ runs: out });
}
