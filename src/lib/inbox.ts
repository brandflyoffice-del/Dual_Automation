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
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type Thread = { leadId: string | null; messages: InboxMessage[]; raw: SlMessage[] };

export async function getThread(campaignId: string, email: string): Promise<Thread> {
  const dbLead = await db.lead
    .findUnique({ where: { email: email.toLowerCase() }, select: { outreachLeadId: true, campaignId: true } })
    .catch(() => null);
  const leadId = (dbLead?.outreachLeadId && dbLead.campaignId === campaignId ? dbLead.outreachLeadId : null) ?? (await leadIdByEmail(email));
  if (!leadId) return { leadId: null, messages: [], raw: [] };
  const raw = await messageHistory(campaignId, leadId);
  const messages = raw.map((m) => {
    const { main, quote } = m.type === "REPLY" ? splitQuote(m.html) : { main: m.html, quote: "" };
    return { type: m.type, from: m.from, to: m.to, time: m.time, subject: m.subject, html: main, quoteHtml: quote, step: m.step };
  });
  return { leadId, messages, raw };
}
