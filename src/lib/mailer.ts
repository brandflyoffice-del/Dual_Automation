// Server-only: sends in-thread replies straight through the sending mailbox's SMTP server (instant, and we set the
// In-Reply-To / References headers ourselves, so Gmail and Outlook keep the answer inside the prospect's thread).
// Mailboxes come from MAILBOXES in the n8n config file (filled from Smartlead by scripts/sync-mailboxes.mjs).
// When a mailbox has no SMTP login here, or SMTP fails, the reply goes through Smartlead's reply-email-thread instead.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import nodemailer from "nodemailer";
import { replyInThread } from "@/lib/smartlead";

type Mailbox = {
  email: string;
  name: string;
  smtp: { host: string; port: number; secure: boolean; user: string; password: string };
};

let cached: { at: number; list: Mailbox[] } | null = null;
export function mailboxes(): Mailbox[] {
  if (cached && Date.now() - cached.at < 60_000) return cached.list;
  let list: Mailbox[] = [];
  try {
    const cfg = JSON.parse(readFileSync(join(process.cwd(), "n8n", "config.local.json"), "utf8")) as { MAILBOXES?: Mailbox[] };
    list = (cfg.MAILBOXES ?? []).filter((m) => m?.email && m.smtp?.host && m.smtp.user && m.smtp.password);
  } catch {
    list = [];
  }
  cached = { at: Date.now(), list };
  return list;
}

const transports = new Map<string, nodemailer.Transporter>();
function transportFor(m: Mailbox) {
  let t = transports.get(m.email);
  if (!t) {
    t = nodemailer.createTransport({
      host: m.smtp.host,
      port: m.smtp.port,
      secure: m.smtp.secure,
      auth: { user: m.smtp.user, pass: m.smtp.password },
      pool: true,
      maxConnections: 2,
      connectionTimeout: 15_000,
      socketTimeout: 30_000,
    });
    transports.set(m.email, t);
  }
  return t;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ID_RE = /<[^<>\s]+@[^<>\s]+>/g;

export type ReplyMail = {
  /** Our sending mailbox (the one that emailed the prospect). Empty = the first configured mailbox. */
  mailbox?: string | null;
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
  text: string;
  /** Message-ID of the prospect email we answer. */
  inReplyTo: string;
  /** Earlier Message-IDs of the thread (oldest first). */
  references?: string[];
  /** The prospect's own words, quoted under the answer the way mail apps do (folded away by Gmail). */
  quote?: { text: string; date?: string | null } | null;
  /** Used only when SMTP is not possible. */
  smartlead?: { campaignId?: string | null; statsId?: string | null; replyTime?: string | null } | null;
};

export type SendResult = { ok: true; via: "smtp" | "smartlead"; messageId: string | null } | { ok: false; error: string };

const reSubject = (s: string) => (/^\s*re\s*:/i.test(s) ? s.trim() : `Re: ${s.trim()}`);

export async function sendReply(mail: ReplyMail): Promise<SendResult> {
  const list = mailboxes();
  const box = list.find((m) => m.email.toLowerCase() === String(mail.mailbox ?? "").toLowerCase()) ?? (mail.mailbox ? undefined : list[0]);
  const inReplyTo = (String(mail.inReplyTo).match(ID_RE) ?? [])[0] ?? "";
  const refs = [...new Set([...(mail.references ?? []).flatMap((r) => String(r).match(ID_RE) ?? []), inReplyTo].filter(Boolean))].slice(-12);

  const quote = mail.quote?.text?.trim();
  const when = mail.quote?.date ? new Date(mail.quote.date) : null;
  const who = mail.toName ? `${mail.toName} <${mail.to}>` : mail.to;
  const quoteHead = `On ${when && !isNaN(+when) ? when.toUTCString().replace(" GMT", " UTC") : "an earlier date"}, ${who} wrote:`;
  const html =
    mail.html +
    (quote
      ? `<div class="gmail_quote"><div dir="ltr" class="gmail_attr">${esc(quoteHead)}<br></div><blockquote class="gmail_quote" style="margin:0 0 0 .8ex;border-left:1px solid #ccc;padding-left:1ex">${esc(quote).replace(/\n/g, "<br>")}</blockquote></div>`
      : "");
  const text = mail.text + (quote ? `\n\n${quoteHead}\n${quote.split("\n").map((l) => `> ${l}`).join("\n")}` : "");

  let smtpError: string | null = null;
  if (box && inReplyTo) {
    try {
      const info = await transportFor(box).sendMail({
        from: { name: box.name || box.email, address: box.email },
        to: mail.toName ? { name: mail.toName, address: mail.to } : mail.to,
        subject: reSubject(mail.subject),
        html,
        text,
        inReplyTo,
        references: refs,
      });
      return { ok: true, via: "smtp", messageId: info.messageId ?? null };
    } catch (e) {
      smtpError = (e as Error).message;
    }
  }

  const sl = mail.smartlead;
  if (sl?.campaignId && sl.statsId && inReplyTo) {
    try {
      await replyInThread(
        String(sl.campaignId),
        { type: "REPLY", from: mail.to, to: box?.email ?? "", time: sl.replyTime ?? new Date().toISOString(), subject: null, html: "", messageId: inReplyTo, statsId: sl.statsId, step: null },
        mail.html,
        quote ? esc(quote).replace(/\n/g, "<br>") : "",
      );
      return { ok: true, via: "smartlead", messageId: null };
    } catch (e) {
      return { ok: false, error: `${smtpError ? `SMTP: ${smtpError}. ` : ""}Smartlead: ${(e as Error).message}` };
    }
  }
  return { ok: false, error: smtpError ? `SMTP: ${smtpError}` : !inReplyTo ? "No message to reply to" : "No sending mailbox is configured" };
}
