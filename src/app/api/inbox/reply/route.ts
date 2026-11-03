import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { escapeHtml, getThread, htmlToText, splitQuote } from "@/lib/inbox";
import { dropCache, replyInThread } from "@/lib/smartlead";

export const dynamic = "force-dynamic";

const body = z.object({
  campaignId: z.string().regex(/^\d+$/),
  email: z.string().trim().toLowerCase().email(),
  message: z.string().trim().min(2).max(6000),
});

// A person answers from the dashboard Inbox. It goes out through Smartlead in the same thread, from the same mailbox,
// answering the prospect's latest message (Smartlead needs one to reply to, so a thread without a reply cannot be answered here).
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Write a message first" }, { status: 400 });
  const { campaignId, email, message } = parsed.data;
  try {
    const { leadId, raw } = await getThread(campaignId, email);
    if (!leadId) return NextResponse.json({ error: "This prospect is no longer in Smartlead" }, { status: 404 });
    const last = [...raw].reverse().find((m) => m.type === "REPLY");
    if (!last) return NextResponse.json({ error: "The prospect has not replied yet. Smartlead only sends in a thread after a reply; the sequence handles everything before that." }, { status: 409 });

    const html = message
      .split(/\n{2,}/)
      .map((p) => `<p style="margin:0 0 14px 0">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
      .join("");
    const quoted = escapeHtml(htmlToText(splitQuote(last.html).main).slice(0, 1500)).replace(/\n/g, "<br>");
    await replyInThread(campaignId, last, html, quoted);
    dropCache(`thread:${campaignId}:${leadId}`);

    const lead = await db.lead.findUnique({ where: { email }, select: { id: true } }).catch(() => null);
    if (lead) {
      await db.$transaction([
        db.emailEvent.create({ data: { leadId: lead.id, type: "MANUAL_REPLY_SENT", body: message, subject: last.subject } }),
        db.lead.update({ where: { id: lead.id }, data: { needsHuman: false } }),
      ]);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
