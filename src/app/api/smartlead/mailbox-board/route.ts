import { NextResponse } from "next/server";
import { z } from "zod";
import { attachMailbox, campaignMailboxes, detachMailbox, dropCache, listCampaigns, listMailboxes, smartleadConfigured } from "@/lib/smartlead";
import { changeDailyLimit, getPauses, nextMidnightNewYork, pauseMailbox, resumeDuePauses, resumeMailbox } from "@/lib/mailbox-control";

export const dynamic = "force-dynamic";

// Email Analytics "Mailboxes and campaigns": which mailbox sends for which campaign, and stop / start per mailbox.

async function board() {
  await resumeDuePauses().catch(() => []); // "Stop for today" ends at midnight New York even if the timer missed it
  const [mailboxes, campaigns, pauses] = await Promise.all([listMailboxes(), listCampaigns(), getPauses()]);
  const withBoxes = await Promise.all(campaigns.map(async (c) => ({ id: c.id, name: c.name, status: c.status, mailboxIds: await campaignMailboxes(c.id) })));
  return {
    campaigns: withBoxes,
    mailboxes: mailboxes.map((m) => ({
      id: m.id,
      name: m.fromName,
      email: m.fromEmail,
      ok: m.smtpOk && m.imapOk,
      dailyLimit: pauses[m.id]?.limit ?? m.dailyLimit,
      sentToday: m.sentToday,
      stopped: !!pauses[m.id] || m.dailyLimit === 0,
      stoppedUntil: pauses[m.id]?.until ?? null,
      warmupOn: m.warmup?.status === "ACTIVE",
      reputation: m.warmup?.reputation ?? "",
      warmupSent: m.warmup?.sent ?? 0,
      warmupSpam: m.warmup?.spam ?? 0,
    })),
  };
}

export async function GET() {
  if (!(await smartleadConfigured())) return NextResponse.json({ error: "Smartlead is not connected" }, { status: 503 });
  try {
    return NextResponse.json(await board());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

const ID = z.string().regex(/^\d{1,12}$/);
const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("attach"), campaignId: ID, mailboxId: ID }),
  z.object({ action: z.literal("detach"), campaignId: ID, mailboxId: ID }),
  z.object({ action: z.literal("stop"), mailboxId: ID, today: z.boolean() }),
  z.object({ action: z.literal("start"), mailboxId: ID }),
  z.object({ action: z.literal("limit"), mailboxId: ID, limit: z.number().int().min(1).max(200) }),
]);

export async function POST(req: Request) {
  if (!(await smartleadConfigured())) return NextResponse.json({ error: "Smartlead is not connected" }, { status: 503 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const a = parsed.data;
  try {
    if (a.action === "attach") await attachMailbox(a.campaignId, a.mailboxId);
    else if (a.action === "detach") await detachMailbox(a.campaignId, a.mailboxId);
    else if (a.action === "start") await resumeMailbox(a.mailboxId);
    else if (a.action === "limit") await changeDailyLimit(a.mailboxId, a.limit);
    else {
      const box = (await listMailboxes()).find((m) => m.id === a.mailboxId);
      if (!box) return NextResponse.json({ error: "Mailbox not found in Smartlead" }, { status: 404 });
      await pauseMailbox(a.mailboxId, box.dailyLimit, a.today ? nextMidnightNewYork() : null);
    }
    dropCache("mailboxes");
    return NextResponse.json({ ok: true, ...(await board()) });
  } catch (e) {
    return NextResponse.json({ error: `Smartlead did not accept it: ${(e as Error).message}` }, { status: 502 });
  }
}
