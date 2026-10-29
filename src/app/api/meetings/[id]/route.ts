import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { callN8n, n8nWebhooks } from "@/lib/config";
import { MEETING_STATUSES, MEETING_STATUS_LABEL } from "@/lib/constants";

export const dynamic = "force-dynamic";

const schema = z
  .object({
    status: z.enum(MEETING_STATUSES).optional(),
    notes: z.string().max(20000).optional(),
  })
  .refine((v) => v.status !== undefined || v.notes !== undefined, "nothing to update");

/** Closer updates outcome / scratchpad → DB first (instant), then n8n syncs the Google Sheet row. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });

  const existing = await db.meeting.findUnique({ where: { id }, include: { lead: true } });
  if (!existing) return NextResponse.json({ error: "meeting not found" }, { status: 404 });

  const meeting = await db.meeting.update({ where: { id }, data: parsed.data });

  const n8n = await callN8n(n8nWebhooks.meetingUpdate, {
    bookingId: meeting.calBookingUid,
    leadEmail: existing.lead.email,
    callStatus: MEETING_STATUS_LABEL[meeting.status as keyof typeof MEETING_STATUS_LABEL] ?? meeting.status,
    closerNotes: meeting.notes,
    updatedFields: Object.keys(parsed.data),
  });

  revalidatePath("/meetings");
  revalidatePath("/dashboard");
  return NextResponse.json({ ok: true, meeting: { id: meeting.id, status: meeting.status, notes: meeting.notes }, n8n });
}
