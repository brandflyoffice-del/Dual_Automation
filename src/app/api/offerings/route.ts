import { NextResponse } from "next/server";
import { z } from "zod";
import { OUTREACH_CAMPAIGNS } from "@/lib/constants";
import { getSetting, setSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Service lines (what the client sells) with their sub-services. Stored in Postgres app_settings.service_lines, so additions
// survive redeploys (the old data/offerings.json lived inside the container image and was lost on every deploy).
const campaignIds = OUTREACH_CAMPAIGNS.map((c) => c.id) as [string, ...string[]];
const sub = z.object({ name: z.string().trim().min(2).max(80), signals: z.string().trim().max(240).default("") });
const line = z.object({
  id: z.string().trim().min(1).max(40),
  name: z.string().trim().min(2).max(60),
  campaignId: z.enum(campaignIds),
  hint: z.string().trim().max(120).default(""),
  items: z.array(sub).max(60),
});
const lines = z.array(line).min(1).max(20);

export async function GET() {
  const { value } = await getSetting("service_lines");
  return NextResponse.json(value);
}

export async function PUT(req: Request) {
  const parsed = lines.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Every service needs a name (2+ letters) and an email campaign" }, { status: 400 });
  const ids = new Set<string>();
  for (const l of parsed.data) {
    if (ids.has(l.id)) return NextResponse.json({ error: "Two services have the same id" }, { status: 400 });
    ids.add(l.id);
    const names = l.items.map((i) => i.name.toLowerCase());
    if (new Set(names).size !== names.length) return NextResponse.json({ error: `"${l.name}" has the same sub-service twice` }, { status: 409 });
  }
  await setSetting("service_lines", parsed.data);
  return NextResponse.json(parsed.data);
}
