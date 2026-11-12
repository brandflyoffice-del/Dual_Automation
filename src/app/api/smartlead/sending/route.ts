import { NextResponse } from "next/server";
import { z } from "zod";
import { listCampaigns, setSending, smartleadConfigured } from "@/lib/smartlead";

export const dynamic = "force-dynamic";

const body = z.object({ campaignId: z.string().regex(/^\d+$/).optional(), all: z.boolean().optional(), on: z.boolean() });

// Email Analytics: start or pause sending for one campaign or all of them. While paused, Launch keeps adding leads and
// nothing is emailed; starting sends email 1 and the follow-ups on the campaign's schedule.
export async function POST(req: Request) {
  if (!(await smartleadConfigured())) return NextResponse.json({ error: "Smartlead is not connected" }, { status: 503 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || (!parsed.data.campaignId && !parsed.data.all)) return NextResponse.json({ error: "Pick a campaign" }, { status: 400 });
  const ids = parsed.data.all ? (await listCampaigns()).map((c) => c.id) : [parsed.data.campaignId!];
  const failed: string[] = [];
  let attached = 0;
  for (const id of ids) {
    try {
      attached += (await setSending(id, parsed.data.on)).attached;
    } catch (e) {
      failed.push(`${id}: ${(e as Error).message}`);
    }
  }
  return NextResponse.json({ ok: failed.length === 0, changed: ids.length - failed.length, attached, failed }, { status: failed.length && failed.length === ids.length ? 502 : 200 });
}
