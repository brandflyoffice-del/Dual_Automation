import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { config } from "@/lib/config";
import { computeReportMetrics } from "@/lib/queries";
import { endOfWeek, startOfWeek } from "@/lib/utils";

export const dynamic = "force-dynamic";

const schema = z.object({ weekOffset: z.number().int().min(-12).max(0).default(0) });

/** Generates a weekly report snapshot and returns a shareable link (+ print-to-PDF page). */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const ref = new Date(Date.now() + parsed.data.weekOffset * 7 * 86400000);
  const weekStart = startOfWeek(ref);
  const weekEnd = parsed.data.weekOffset === 0 ? new Date() : endOfWeek(ref);

  const metrics = await computeReportMetrics(weekStart, weekEnd);
  const report = await db.weeklyReport.create({
    data: { weekStart, weekEnd, metrics: metrics as object, shareToken: randomBytes(12).toString("hex") },
  });
  revalidatePath("/reports");
  return NextResponse.json({
    ok: true,
    id: report.id,
    shareUrl: `${config.appUrl}/r/${report.shareToken}`,
  });
}
