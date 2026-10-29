import { NextResponse } from "next/server";
import { z } from "zod";
import { callN8n, n8nWebhooks } from "@/lib/config";
import { EMPLOYEE_RANGES, EUROPE_COUNTRIES, ICP, SERVICES } from "@/lib/constants";

export const dynamic = "force-dynamic";

const employeeIds = EMPLOYEE_RANGES.map((e) => e.id) as [string, ...string[]];

const europeCodes = EUROPE_COUNTRIES.map((c) => c.code) as [string, ...string[]];

/** Dashboard "Launch campaign". Every list is a subset of the locked ICP; empty lists are rejected. */
const schema = z
  .object({
    region: z.enum(["ALL", ...ICP.regions]).optional(),
    industry: z.enum(["ALL", ...ICP.industries]).optional(),
    regions: z.array(z.enum(ICP.regions)).min(1).optional(),
    industries: z.array(z.enum(ICP.industries)).min(1).optional(),
    roles: z.array(z.enum(ICP.roles)).min(1).optional(),
    employees: z.array(z.enum(employeeIds)).min(1).optional(),
    europeCountries: z.array(z.enum(europeCodes)).min(1).optional(),
    service: z.enum(SERVICES).nullable().optional(),
    keyword: z.string().trim().max(80).optional(),
    places: z.array(z.string().trim().min(2).max(60)).max(20).optional(),
    industryQuery: z.string().trim().max(80).optional(),
    offering: z.string().trim().max(80).optional(),
    extraTitles: z.string().trim().max(120).optional(),
    excludeNote: z.string().trim().max(120).optional(),
    name: z.string().trim().max(80).optional(),
    emailType: z.enum(["work", "any"]).optional(),
    maxPerCompany: z.number().int().min(1).max(5).optional(),
    limit: z.number().int().min(5).max(200).default(40),
    provider: z.enum(["ai-ark", "apify"]).default("ai-ark"),
    campaignId: z.enum(["4238486", "4238487", "4238488", "4238489", "4238491"]).optional(),
  })
  .refine((d) => (d.regions?.length ?? 0) > 0 || !!d.region, { message: "Pick at least one region" })
  .refine((d) => (d.industries?.length ?? 0) > 0 || !!d.industry, { message: "Pick at least one industry" });

/** Dashboard → the lead-engine lane of Fenebris_Outreach_Autopilot. ICP bounds are re-checked here and again in n8n. */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid batch request", issues: parsed.error.issues }, { status: 400 });

  const payload = {
    ...parsed.data,
    icp: { revenueMin: ICP.revenueMin, revenueMax: ICP.revenueMax, minTicket: ICP.minTicket },
    triggeredAt: new Date().toISOString(),
    source: "dashboard",
  };
  const res = await callN8n(n8nWebhooks.scraperBatch, payload);
  return NextResponse.json({ ...res, payload }, { status: res.ok ? 202 : res.status === 0 ? 503 : 502 });
}
