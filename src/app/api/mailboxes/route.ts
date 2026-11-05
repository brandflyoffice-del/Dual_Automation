import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { saveMailbox } from "@/lib/mailboxes";
import { dropMailboxCache } from "@/lib/mailer";
import { refreshMailboxWatch, watchStatus } from "@/lib/mailbox-watch";
import { saveEmailAccount, smartleadConfigured } from "@/lib/smartlead";

export const dynamic = "force-dynamic";

/** Mailboxes the dashboard sends from and watches (no passwords). */
export async function GET() {
  const rows = await db.mailbox.findMany({ orderBy: { createdAt: "asc" }, select: { email: true, name: true, smartleadId: true, watchedAt: true, watchError: true } });
  const live = watchStatus();
  return NextResponse.json({ mailboxes: rows.map((r) => ({ ...r, watching: !!live[r.email] })) });
}

const body = z.object({
  fromName: z.string().trim().min(2).max(60),
  fromEmail: z.string().trim().toLowerCase().email(),
  username: z.string().trim().max(120).optional(),
  password: z.string().min(4).max(200),
  smtpHost: z.string().trim().min(3).max(120),
  smtpPort: z.number().int().min(1).max(65535),
  imapHost: z.string().trim().min(3).max(120),
  imapPort: z.number().int().min(1).max(65535),
  dailyLimit: z.number().int().min(1).max(200).default(20),
  warmup: z.boolean().default(true),
});

/**
 * Adds a sending mailbox: Smartlead checks the SMTP and IMAP logins and creates it (with warm-up), then the dashboard
 * stores it for in-thread answers and starts watching it for replies within a minute. Gmail / Outlook mailboxes that
 * use "Sign in with Google/Microsoft" must be connected in Smartlead itself, then imported with "Sync from Smartlead".
 */
export async function POST(req: Request) {
  if (!smartleadConfigured()) return NextResponse.json({ error: "Smartlead is not connected" }, { status: 503 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Fill in every field (ports are numbers)" }, { status: 400 });
  const d = parsed.data;
  const user = d.username || d.fromEmail;
  try {
    const r = await saveEmailAccount({
      id: null,
      from_name: d.fromName,
      from_email: d.fromEmail,
      user_name: user,
      password: d.password,
      smtp_host: d.smtpHost,
      smtp_port: d.smtpPort,
      imap_host: d.imapHost,
      imap_port: d.imapPort,
      max_email_per_day: d.dailyLimit,
      warmup_enabled: d.warmup,
      total_warmup_per_day: Math.min(20, d.dailyLimit),
      daily_rampup: 2,
      reply_rate_percentage: 30,
    });
    await saveMailbox({
      email: d.fromEmail,
      name: d.fromName,
      smartleadId: r.id,
      smtp: { host: d.smtpHost, port: d.smtpPort, secure: d.smtpPort === 465, user, password: d.password },
      imap: { host: d.imapHost, port: d.imapPort, secure: d.imapPort === 993, user, password: d.password },
    });
    dropMailboxCache();
    refreshMailboxWatch();
    return NextResponse.json({ ok: true, smartleadId: r.id, message: r.message });
  } catch (e) {
    return NextResponse.json({ error: `Smartlead did not accept the mailbox: ${(e as Error).message}` }, { status: 502 });
  }
}
