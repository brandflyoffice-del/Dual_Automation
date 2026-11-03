import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { sendReply } from "@/lib/mailer";

export const dynamic = "force-dynamic";

// Internal: n8n's reply lane sends every in-thread answer through here (http://dashboard:3400, never via the internet;
// Caddy answers 404 for this path). Header x-fenebris-secret must match WEBHOOK_SECRET.
function authorized(req: Request) {
  if (!config.webhookSecret) return false;
  const got = Buffer.from(req.headers.get("x-fenebris-secret") ?? "");
  const want = Buffer.from(config.webhookSecret);
  return got.length === want.length && timingSafeEqual(got, want);
}

const body = z.object({
  mailbox: z.string().trim().nullish(),
  to: z.string().trim().email(),
  toName: z.string().trim().max(120).nullish(),
  subject: z.string().trim().min(1).max(300),
  html: z.string().min(1).max(60_000),
  text: z.string().min(1).max(30_000),
  inReplyTo: z.string().trim().min(3).max(500),
  references: z.array(z.string().max(500)).max(40).nullish(),
  quote: z.object({ text: z.string().max(4000), date: z.string().nullish() }).nullish(),
  smartlead: z.object({ campaignId: z.string().nullish(), statsId: z.string().nullish(), replyTime: z.string().nullish() }).nullish(),
});

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid mail: " + parsed.error.issues.map((i) => i.path.join(".")).join(", ") }, { status: 400 });
  const r = await sendReply({ ...parsed.data, references: parsed.data.references ?? [] });
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}
