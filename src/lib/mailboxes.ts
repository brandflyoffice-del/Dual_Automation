// Server-only: the sending mailboxes (SMTP + IMAP logins) the dashboard sends answers from and watches for replies.
// Source of truth = the mailboxes table. On first use it is filled from the n8n config file (MAILBOXES), and the
// "Sync from Smartlead" button imports every SMTP/IMAP mailbox connected in Smartlead.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/lib/db";
import { open, seal } from "@/lib/secret-box";
import { rawEmailAccounts } from "@/lib/smartlead";

export type Login = { host: string; port: number; secure: boolean; user: string; password: string };
export type MailboxCreds = { id?: string; email: string; name: string; smartleadId: string | null; smtp: Login; imap: Login; lastUid?: number | null };

/** Smartlead returns mailbox passwords base64-encoded; plain text is kept as is. */
export function plainPassword(p: unknown): string {
  const s = String(p ?? "");
  const d = Buffer.from(s, "base64").toString("utf8");
  const looksB64 = /^[A-Za-z0-9+/]+={0,2}$/.test(s) && Buffer.from(d, "utf8").toString("base64").replace(/=+$/, "") === s.replace(/=+$/, "");
  return looksB64 && /^[\x21-\x7e]+$/.test(d) ? d : s;
}

async function upsert(m: MailboxCreds) {
  const data = {
    name: m.name,
    smartleadId: m.smartleadId,
    smtpHost: m.smtp.host,
    smtpPort: m.smtp.port,
    smtpSecure: m.smtp.secure,
    smtpUser: m.smtp.user,
    smtpPassword: seal(m.smtp.password),
    imapHost: m.imap.host,
    imapPort: m.imap.port,
    imapSecure: m.imap.secure,
    imapUser: m.imap.user,
    imapPassword: seal(m.imap.password),
  };
  return db.mailbox.upsert({ where: { email: m.email.toLowerCase() }, create: { email: m.email.toLowerCase(), ...data }, update: data });
}

export async function saveMailbox(m: MailboxCreds) {
  return upsert(m);
}

/** First run: copy the mailboxes the config file already knows (the 5 synced before this table existed). */
async function seedFromConfig() {
  try {
    const cfg = JSON.parse(readFileSync(join(process.cwd(), "n8n", "config.local.json"), "utf8")) as { MAILBOXES?: { email: string; name?: string; smtp: Login; imap: Login }[] };
    for (const m of cfg.MAILBOXES ?? []) {
      if (m?.email && m.smtp?.host && m.imap?.host) await upsert({ email: m.email, name: m.name ?? "", smartleadId: null, smtp: m.smtp, imap: m.imap });
    }
  } catch {
    // no config file (local dev): nothing to seed
  }
}

let seeded = false;
export async function listMailboxCreds(): Promise<MailboxCreds[]> {
  if (!seeded) {
    seeded = true;
    if ((await db.mailbox.count()) === 0) await seedFromConfig();
  }
  const rows = await db.mailbox.findMany({ orderBy: { createdAt: "asc" } });
  return rows.flatMap((r) => {
    try {
      return [{
        id: r.id,
        email: r.email,
        name: r.name,
        smartleadId: r.smartleadId,
        smtp: { host: r.smtpHost, port: r.smtpPort, secure: r.smtpSecure, user: r.smtpUser, password: open(r.smtpPassword) },
        imap: { host: r.imapHost, port: r.imapPort, secure: r.imapSecure, user: r.imapUser, password: open(r.imapPassword) },
        lastUid: r.lastUid,
      }];
    } catch {
      return []; // unreadable (secret changed): skipped until it is saved again
    }
  });
}

/** Imports every SMTP/IMAP mailbox connected in Smartlead (Gmail/Outlook sign-in mailboxes have no logins to import). */
export async function syncFromSmartlead(): Promise<{ imported: number; skipped: string[] }> {
  const rows = await rawEmailAccounts();
  let imported = 0;
  const skipped: string[] = [];
  const ssl = (t: unknown, port: number, sslPort: number) => String(t ?? "").toUpperCase() === "SSL" || port === sslPort;
  for (const a of rows) {
    const email = String(a.from_email ?? "").toLowerCase();
    if (!email) continue;
    if (!a.smtp_host || !a.imap_host || !a.username) {
      skipped.push(`${email} (${String(a.type ?? "OAuth")}: no SMTP/IMAP login to import)`);
      continue;
    }
    const smtpPort = Number(a.smtp_port), imapPort = Number(a.imap_port);
    const diff = a.is_different_imap_account === true;
    await upsert({
      email,
      name: String(a.from_name ?? ""),
      smartleadId: String(a.id),
      smtp: { host: String(a.smtp_host), port: smtpPort, secure: ssl(a.smtp_port_type, smtpPort, 465), user: String(a.username), password: plainPassword(a.password) },
      imap: {
        host: String(a.imap_host),
        port: imapPort,
        secure: ssl(a.imap_port_type, imapPort, 993),
        user: String((diff ? a.imap_username : a.imap_username || a.username) ?? ""),
        password: plainPassword(diff ? a.imap_password : a.imap_password || a.password),
      },
    });
    imported++;
  }
  return { imported, skipped };
}
