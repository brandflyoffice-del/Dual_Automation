import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { readLaunchForm } from "@/lib/launch-form";
import { callN8n, n8nWebhooks } from "@/lib/config";
import { db } from "@/lib/db";
import { launchBlocker } from "@/lib/service-health";
import { EMPLOYEE_RANGES, EUROPE_COUNTRIES, ICP, ROLE_IDS, SERVICES } from "@/lib/constants";

export const dynamic = "force-dynamic";

const employeeIds = EMPLOYEE_RANGES.map((e) => e.id) as [string, ...string[]];

const europeCodes = EUROPE_COUNTRIES.map((c) => c.code) as [string, ...string[]];

/** Dashboard "Launch campaign". Every list is a subset of the locked ICP; empty lists are rejected. */
const schema = z
  .object({
    region: z.enum(["ALL", ...ICP.regions]).optional(),
    industry: z.enum(["ALL", ...ICP.industries]).optional(),
    regions: z.array(z.enum(ICP.regions)).min(1).optional(),
    industries: z.array(z.enum(ICP.industries)).optional(),
    industryTerms: z.array(z.string().trim().min(2).max(60)).max(20).optional(),
    apifyIndustries: z.array(z.string().trim().min(3).max(64)).max(20).optional(),
    roles: z.array(z.enum(ROLE_IDS)).min(1).optional(),
    employees: z.array(z.enum(employeeIds)).min(1).optional(),
    europeCountries: z.array(z.enum(europeCodes)).min(1).optional(),
    service: z.enum(SERVICES).nullable().optional(),
    keyword: z.string().trim().max(80).optional(),
    places: z.array(z.string().trim().min(2).max(60)).max(20).optional(),
    placeCountries: z.array(z.string().regex(/^[a-z]{2}$/)).max(60).optional(),
    placeCities: z.array(z.string().trim().min(2).max(64)).max(10).optional(),
    anyRevenue: z.boolean().optional(),
    revenueBand: z.enum(["small", "icp", "any"]).optional(),
    industryQuery: z.string().trim().max(80).optional(),
    offering: z.string().trim().max(80).optional(),
    extraTitles: z.string().trim().max(400).optional(),
    excludeNote: z.string().trim().max(120).optional(),
    name: z.string().trim().max(80).optional(),
    emailType: z.enum(["work", "any"]).optional(),
    maxPerCompany: z.number().int().min(1).max(5).optional(),
    limit: z.number().int().min(5).max(200).default(40),
    provider: z.enum(["ai-ark", "apify"]).default("ai-ark"),
    campaignId: z.enum(["4238486", "4238487", "4238488", "4238489", "4238491"]).optional(),
    form: z.record(z.string(), z.unknown()).optional(), // the form filters, kept with the run for "Fix filters with AI" (not sent to n8n)
  })
  .refine((d) => (d.regions?.length ?? 0) > 0 || !!d.region, { message: "Pick at least one region" })
  .refine((d) => (d.industries?.length ?? 0) > 0 || (d.industryTerms?.length ?? 0) > 0 || !!d.industryQuery || !!d.industry, { message: "Pick at least one industry" });

/** Dashboard → the lead-engine lane of Fenebris_Outreach_Autopilot. ICP bounds are re-checked here and again in n8n. */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    // Name the field, so the Launch toast says what to change instead of a bare "Invalid batch request".
    const why = parsed.error.issues.slice(0, 3).map((i) => (i.path.length ? i.path.join(".") + ": " : "") + i.message).join("; ");
    return NextResponse.json({ error: `Launch refused: ${why}`, issues: parsed.error.issues }, { status: 400 });
  }

  // A launch with OpenAI out of credit (or Apify at its limit) would pay Apify for people the AI cannot write to,
  // and those people are skipped in later launches. Stop it here with the reason instead.
  const blocked = await launchBlocker(parsed.data.provider ?? "ai-ark");
  if (blocked) return NextResponse.json({ error: blocked }, { status: 402 });

  const { form, ...searchBody } = parsed.data;
  const payload = {
    ...searchBody,
    icp: {
      revenueMin: parsed.data.revenueBand === "small" || parsed.data.revenueBand === "any" || parsed.data.anyRevenue ? null : ICP.revenueMin,
      revenueMax: parsed.data.revenueBand === "small" ? ICP.revenueMin : parsed.data.revenueBand === "any" || parsed.data.anyRevenue ? null : ICP.revenueMax,
      minTicket: ICP.minTicket,
    },
    triggeredAt: new Date().toISOString(),
    source: "dashboard",
  };
  // A run row lets the dashboard show live progress; n8n reports each stage against its id.
  const run = await db.launchRun
    .create({ data: { name: parsed.data.name ?? "", provider: parsed.data.provider ?? "ai-ark", campaignId: parsed.data.campaignId ?? null, target: parsed.data.limit ?? 0, stage: "searching", form: (readLaunchForm(form) ?? undefined) as Prisma.InputJsonValue | undefined } })
    .catch(() => null);
  const res = await callN8n(n8nWebhooks.scraperBatch, { ...payload, runId: run?.id ?? null });
  if (run && !res.ok) await db.launchRun.update({ where: { id: run.id }, data: { status: "failed", stage: "failed", message: res.message, finishedAt: new Date() } }).catch(() => {});
  return NextResponse.json({ ...res, payload, runId: run?.id ?? null }, { status: res.ok ? 202 : res.status === 0 ? 503 : 502 });
}
