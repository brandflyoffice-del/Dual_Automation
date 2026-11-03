import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { escapeHtml, getThread } from "@/lib/inbox";
import { sendReply } from "@/lib/mailer";
import { dropCache } from "@/lib/smartlead";

export const dynamic = "force-dynamic";

const body = z.object({
  campaignId: z.string().regex(/^\d+$/),
  email: z.string().trim().toLowerCase().email(),
  message: z.string().trim().min(2).max(6000),
});

// A person answers from the Inbox. Same path as the AI: the sending mailbox's SMTP with thread headers (Smartlead's
// reply API only if SMTP is not set up), answering the prospect's newest message.
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Write a message first" }, { status: 400 });
  const { campaignId, email, message } = parsed.data;
  try {
    const { leadId, dbLeadId, reply } = await getThread(campaignId, email);
    if (!reply) return NextResponse.json({ error: "The prospect has not replied yet. The sequence handles everything before the first reply." }, { status: 409 });

    const html = message
      .split(/\n{2,}/)
      .map((p) => `<p style="margin:0 0 14px 0">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
      .join("");
    const r = await sendReply({
      mailbox: reply.mailbox,
      to: email,
      toName: reply.toName,
      subject: reply.subject || "Your enquiry",
      html,
      text: message,
      inReplyTo: reply.messageId,
      references: reply.references,
      quote: { text: reply.text.slice(0, 1500), date: reply.time },
      smartlead: { campaignId, statsId: reply.statsId, replyTime: reply.time },
    });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
    if (leadId) dropCache(`thread:${campaignId}:${leadId}`);

    if (dbLeadId) {
      await db.$transaction([
        db.emailEvent.create({ data: { leadId: dbLeadId, type: "MANUAL_REPLY_SENT", body: message, subject: reply.subject, externalId: r.messageId } }),
        db.lead.update({ where: { id: dbLeadId }, data: { needsHuman: false } }),
      ]);
    }
    return NextResponse.json({ ok: true, via: r.via });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
