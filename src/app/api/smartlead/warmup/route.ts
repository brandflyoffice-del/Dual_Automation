import { NextResponse } from "next/server";
import { z } from "zod";
import { listMailboxes, setWarmup, smartleadConfigured } from "@/lib/smartlead";

export const dynamic = "force-dynamic";

const body = z.object({ mailboxId: z.string().regex(/^\d+$/).optional(), all: z.boolean().optional(), enabled: z.boolean() });

// Email Analytics: warm-up on/off for one mailbox or all of them (Smartlead keeps each mailbox's own warm-up numbers).
export async function POST(req: Request) {
  if (!smartleadConfigured()) return NextResponse.json({ error: "Smartlead is not connected" }, { status: 503 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || (!parsed.data.mailboxId && !parsed.data.all)) return NextResponse.json({ error: "Pick a mailbox" }, { status: 400 });
  const ids = parsed.data.all ? (await listMailboxes()).map((m) => m.id) : [parsed.data.mailboxId!];
  const failed: string[] = [];
  for (const id of ids) {
    try {
      await setWarmup(id, parsed.data.enabled);
    } catch (e) {
      failed.push(`${id}: ${(e as Error).message}`);
    }
  }
  return NextResponse.json({ ok: failed.length === 0, changed: ids.length - failed.length, failed }, { status: failed.length && failed.length === ids.length ? 502 : 200 });
}
