import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { callN8n, n8nWebhooks } from "@/lib/config";

export const dynamic = "force-dynamic";

const schema = z.object({ action: z.enum(["pause", "resume", "push_to_booking"]) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid action" }, { status: 400 });

  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "lead not found" }, { status: 404 });

  const { action } = parsed.data;
  if (action === "pause") await db.lead.update({ where: { id }, data: { sequencePaused: true } });
  if (action === "resume") await db.lead.update({ where: { id }, data: { sequencePaused: false } });
  if (action === "push_to_booking") {
    await db.lead.update({
      where: { id },
      data: { sequencePaused: true, stage: lead.stage === "BOOKED" ? "BOOKED" : "REPLIED", replySentiment: "Positive_Booking_Intent", needsHuman: false },
    });
  }

  // Tell n8n so Instantly/Smartlead is paused / the AI booking email goes out.
  const n8n = await callN8n(n8nWebhooks.leadControl, { action, leadId: lead.id, email: lead.email, outreachLeadId: lead.outreachLeadId, campaignId: lead.campaignId });
  for (const p of ["/leads", "/campaigns", "/dashboard"]) revalidatePath(p);
  return NextResponse.json({ ok: true, action, n8n });
}
