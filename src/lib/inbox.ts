// Server-only: builds the dashboard Inbox (Smartlead master inbox) from Smartlead's sent-email statistics, message
// history and our own lead rows (AI intent, needs-human flag, stage).
import { db } from "@/lib/db";
import { campaignSent, campaignStats, leadIdByEmail, listCampaigns, messageHistory, type SlMessage } from "@/lib/smartlead";
import type { InboxConversation, InboxMessage } from "@/lib/types";

const latest = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);

export async function getConversations(): Promise<InboxConversation[]> {
  const campaigns = await listCampaigns();
  // Only campaigns that have sent something have statistics worth reading.
  const stats = await Promise.all(campaigns.map((c) => campaignStats(c).catch(() => null)));
  const live = campaigns.filter((c, i) => (stats[i]?.sent ?? 0) > 0);
  const rows = (await Promise.all(live.map((c) => campaignSent(c.id).catch(() => [])))).flat();

  const byKey = new Map<string, InboxConversation>();
  const nameOf = new Map(campaigns.map((c) => [c.id, c.name]));
  for (const r of rows) {
    if (!r.leadEmail) continue;
    const key = `${r.campaignId}:${r.leadEmail}`;
    const c =
      byKey.get(key) ??
      ({
        key,
        campaignId: r.campaignId,
        campaignName: nameOf.get(r.campaignId) ?? r.campaignId,
        email: r.leadEmail,
        name: r.leadName,
        company: null,
        dbLeadId: null,
        subject: "",
        stepsSent: 0,
        lastSentAt: null,
        repliedAt: null,
        lastActivity: null,
        bounced: false,
        unsubscribed: false,
        category: null,
        sentiment: null,
        needsHuman: false,
        stage: null,
      } satisfies InboxConversation);
    if (r.step === 1 || !c.subject) c.subject = r.subject;
    if (r.sentAt) c.stepsSent += 1;
    c.lastSentAt = latest(c.lastSentAt, r.sentAt);
    c.repliedAt = latest(c.repliedAt, r.repliedAt);
    c.lastActivity = latest(c.lastSentAt, c.repliedAt);
    c.bounced ||= r.bounced;
    c.unsubscribed ||= r.unsubscribed;
    c.category ||= r.category;
    byKey.set(key, c);
  }

  const list = [...byKey.values()];
  if (list.length) {
    const leads = await db.lead
      .findMany({
        where: { email: { in: [...new Set(list.map((c) => c.email))] } },
        select: { id: true, email: true, companyName: true, firstName: true, lastName: true, replySentiment: true, needsHuman: true, stage: true, repliedAt: true },
      })
      .catch(() => []);
    const byEmail = new Map(leads.map((l) => [l.email.toLowerCase(), l]));
    for (const c of list) {
      const l = byEmail.get(c.email);
      if (!l) continue;
      c.dbLeadId = l.id;
      c.company = l.companyName;
      c.name = c.name || `${l.firstName} ${l.lastName}`.trim();
      c.sentiment = l.replySentiment;
      c.needsHuman = l.needsHuman;
      c.stage = l.stage;
      // Smartlead fills reply_time on the stats row a little later than our webhook; use whichever is known.
      if (l.repliedAt) {
        c.repliedAt = latest(c.repliedAt, l.repliedAt.toISOString());
        c.lastActivity = latest(c.lastActivity, c.repliedAt);
      }
    }
  }
  return list.sort((a, b) => (b.lastActivity ?? "").localeCompare(a.lastActivity ?? ""));
}

// ---------- one thread ----------

const QUOTE_START = [
  /<div[^>]*class="[^"]*gmail_quote/i,
  /<blockquote/i,
  /<div[^>]*id="?(appendonsend|divRplyFwdMsg)/i,
  /<hr[^>]*id="?stopSpelling/i,
  /-{2,}\s*Original Message\s*-{2,}/i,
  /(<br\s*\/?>|\n|<div[^>]*>)\s*On [^<]{5,240}wrote:/i,
];

/** Splits a reply into what the person wrote and the quoted earlier emails their mail app appended. */
export function splitQuote(html: string): { main: string; quote: string } {
  let cut = -1;
  for (const re of QUOTE_START) {
    const m = re.exec(html);
    if (m && m.index > 0 && (cut < 0 || m.index < cut)) cut = m.index;
  }
  return cut < 0 ? { main: html, quote: "" } : { main: html.slice(0, cut), quote: html.slice(cut) };
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The written part of one of our sequence emails (between the template header and the booking button). */
function sequenceText(html: string): string {
  const starts = ['<td style="padding:36px 32px 12px;', 'color:#1f2937;">'];
  const ends = ['<table role="presentation" cellpadding="0" cellspacing="0" align="center"', '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 4px;">'];
  for (let i = 0; i < starts.length; i++) {
    const a = html.indexOf(starts[i]);
    const b = html.indexOf(ends[i], a + 1);
    if (a >= 0 && b > a) return htmlToText(html.slice(html.indexOf(">", a) + 1, b));
  }
  return htmlToText(html);
}

const ID_RE = /<[^<>\s]+@[^<>\s]+>/g;
const near = (a: string, b: string, ms = 5 * 60_000) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) < ms;

/** What a reply from the dashboard needs: the prospect message we answer, the thread ids, our mailbox and the subject. */
export type ReplyTarget = {
  messageId: string;
  time: string;
  text: string;
  statsId: string | null;
  references: string[];
  mailbox: string | null;
  subject: string;
  toName: string | null;
};

export type Thread = { leadId: string | null; dbLeadId: string | null; messages: InboxMessage[]; reply: ReplyTarget | null };

/**
 * One conversation: Smartlead's message history (sequence emails, replies Smartlead has seen) merged with our own
 * events (replies the mailbox watch saw first, AI answers and answers written in the Inbox, which go out over SMTP and
 * so are not in Smartlead), oldest first.
 */
export async function getThread(campaignId: string, email: string): Promise<Thread> {
  const dbLead = await db.lead
    .findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        outreachLeadId: true,
        campaignId: true,
        events: {
          where: { type: { in: ["REPLY_RECEIVED", "AI_REPLY_SENT", "MANUAL_REPLY_SENT", "EMAIL_SENT"] } },
          orderBy: { occurredAt: "asc" },
          select: { type: true, body: true, aiReply: true, externalId: true, eaccount: true, subject: true, occurredAt: true },
        },
      },
    })
    .catch(() => null);
  const leadId = (dbLead?.outreachLeadId && dbLead.campaignId === campaignId ? dbLead.outreachLeadId : null) ?? (await leadIdByEmail(email).catch(() => null));
  const raw: SlMessage[] = leadId ? await messageHistory(campaignId, leadId).catch(() => []) : [];
  const events = dbLead?.events ?? [];

  const messages: InboxMessage[] = raw.map((m) => {
    if (m.type === "REPLY") {
      const { main, quote } = splitQuote(m.html);
      return { type: "REPLY", kind: "PROSPECT", from: m.from, to: m.to, time: m.time, subject: m.subject, text: htmlToText(main), html: main, quoteHtml: quote, step: m.step };
    }
    if (m.step) return { type: "SENT", kind: "SEQUENCE", from: m.from, to: m.to, time: m.time, subject: m.subject, text: sequenceText(m.html), html: m.html, quoteHtml: "", step: m.step };
    const mine = events.find((e) => e.type === "MANUAL_REPLY_SENT" && near(e.occurredAt.toISOString(), m.time));
    const { main, quote } = splitQuote(m.html);
    return { type: "SENT", kind: mine ? "TEAM" : "AI", from: m.from, to: m.to, time: m.time, subject: m.subject, text: htmlToText(main), html: main, quoteHtml: quote, step: null };
  });

  const ourBox = raw.find((m) => m.type === "SENT")?.from || events.find((e) => e.eaccount)?.eaccount || null;
  const seenReplyIds = new Set(raw.filter((m) => m.type === "REPLY").map((m) => m.messageId));
  const slSentTimes = raw.filter((m) => m.type === "SENT" && !m.step).map((m) => m.time);
  for (const e of events) {
    const at = e.occurredAt.toISOString();
    if (e.type === "REPLY_RECEIVED" && e.body && !(e.externalId && seenReplyIds.has(e.externalId))) {
      messages.push({ type: "REPLY", kind: "PROSPECT", from: email, to: ourBox ?? "", time: at, subject: e.subject, text: e.body, html: "", quoteHtml: "", step: null, messageId: e.externalId });
    } else if ((e.type === "AI_REPLY_SENT" || e.type === "MANUAL_REPLY_SENT") && !slSentTimes.some((t) => near(t, at))) {
      const text = e.aiReply || e.body || "";
      if (text) messages.push({ type: "SENT", kind: e.type === "AI_REPLY_SENT" ? "AI" : "TEAM", from: ourBox ?? "", to: email, time: at, subject: e.subject, text, html: "", quoteHtml: "", step: null });
    }
  }
  messages.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  // The newest prospect message is the one a reply answers.
  const lastRaw = [...raw].reverse().find((m) => m.type === "REPLY");
  const lastDb = [...events].reverse().find((e) => e.type === "REPLY_RECEIVED" && e.externalId);
  const useDb = !!lastDb && (!lastRaw || lastDb.occurredAt.getTime() > new Date(lastRaw.time).getTime() + 60_000);
  const references = [...new Set([...raw.map((m) => m.messageId), ...events.map((e) => e.externalId ?? "")].flatMap((r) => r.match(ID_RE) ?? []))];
  const subject = raw.find((m) => m.step === 1)?.subject || raw.find((m) => m.subject)?.subject || events.find((e) => e.subject)?.subject || "";
  const toName = dbLead ? `${dbLead.firstName} ${dbLead.lastName}`.trim() || null : null;
  const reply: ReplyTarget | null =
    useDb && lastDb
      ? { messageId: lastDb.externalId!, time: lastDb.occurredAt.toISOString(), text: lastDb.body ?? "", statsId: null, references, mailbox: ourBox, subject, toName }
      : lastRaw
        ? { messageId: lastRaw.messageId, time: lastRaw.time, text: htmlToText(splitQuote(lastRaw.html).main), statsId: lastRaw.statsId || null, references, mailbox: ourBox, subject, toName }
        : null;

  return { leadId, dbLeadId: dbLead?.id ?? null, messages, reply };
}
