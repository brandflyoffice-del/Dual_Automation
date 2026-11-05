// Server-only: the live reply watch. One IMAP connection per sending mailbox (IDLE), started with the dashboard server
// (src/instrumentation.ts). A new email that answers our outreach is posted to the n8n reply brain within seconds.
// The mailbox list is re-read every minute, so a mailbox added in the dashboard is watched without a deploy.
// Same rules as the old n8n "Mailbox Watch" lane: only replies whose References / In-Reply-To point at one of our
// domains, not from our own mailboxes, not bounces, at most 30 minutes old; the quoted part is cut off.
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { db } from "@/lib/db";
import { listMailboxCreds, type MailboxCreds } from "@/lib/mailboxes";
import { callN8n } from "@/lib/config";

const MAX_AGE_MS = 30 * 60_000;
const ID_RE = /<[^<>\s]+@[^<>\s]+>/g;

type Watch = { box: MailboxCreds; client: ImapFlow | null; key: string; stopped: boolean; retry?: NodeJS.Timeout };
type WatchState = { watches: Map<string, Watch>; timer?: NodeJS.Timeout };
const g = globalThis as unknown as { __fenebrisWatch?: WatchState };
const state: WatchState = (g.__fenebrisWatch ??= { watches: new Map<string, Watch>() });

const credKey = (b: MailboxCreds) => [b.imap.host, b.imap.port, b.imap.user, b.imap.password].join("|");
const log = (...a: unknown[]) => console.log("[mailbox-watch]", ...a);

async function handleMessage(box: MailboxCreds, all: MailboxCreds[], source: Buffer) {
  const m = await simpleParser(source);
  const from = String(m.from?.value?.[0]?.address ?? "").toLowerCase();
  const mine = all.map((b) => b.email.toLowerCase());
  if (!from || mine.includes(from) || /^(mailer-daemon|postmaster)@/i.test(from)) return;
  const at = m.date ?? new Date();
  if (Date.now() - at.getTime() > MAX_AGE_MS) return;
  const refs = (String([...(Array.isArray(m.references) ? m.references : m.references ? [m.references] : []), m.inReplyTo ?? ""].join(" ")).match(ID_RE) ?? []);
  const domains = [...new Set(mine.map((e) => e.split("@")[1]))];
  if (!refs.some((r) => domains.some((d) => r.toLowerCase().endsWith("@" + d + ">")))) return;
  const plain = m.text || String(m.html || "").replace(/<br\s*\/?>|<\/p>|<\/div>/gi, "\n").replace(/<[^>]+>/g, " ");
  const text = plain.split(/\r?\n[ \t]*On [\s\S]{5,260}?wrote:|\r?\n-{2,}\s*Original Message|\r?\n>/i)[0].replace(/\r/g, "").trim();
  const res = await callN8n("/webhook/fenebris-outreach-events", {
    event_type: "EMAIL_REPLY",
    via: "mailbox",
    lead_email: from,
    from_email: box.email,
    subject: m.subject ?? "",
    reply_message: { message_id: m.messageId ?? null, text },
    event_timestamp: at.toISOString(),
    references: refs,
  });
  log(`${box.email}: reply from ${from} -> reply brain ${res.ok ? "accepted" : "FAILED " + res.message}`);
}

async function fetchNew(w: Watch, all: MailboxCreds[]) {
  const c = w.client;
  if (!c || !c.mailbox) return;
  const row = await db.mailbox.findUnique({ where: { email: w.box.email }, select: { lastUid: true } });
  const last = row?.lastUid ?? 0;
  let max = last;
  for await (const msg of c.fetch({ uid: `${last + 1}:*` }, { uid: true, source: true }, { uid: true })) {
    if (msg.uid <= last) continue; // "n:*" always returns the newest message, even an old one
    max = Math.max(max, msg.uid);
    try {
      if (msg.source) await handleMessage(w.box, all, msg.source);
    } catch (e) {
      log(`${w.box.email}: could not handle uid ${msg.uid}: ${(e as Error).message}`);
    }
  }
  if (max > last) await db.mailbox.update({ where: { email: w.box.email }, data: { lastUid: max, watchedAt: new Date(), watchError: null } }).catch(() => {});
}

async function connect(w: Watch, all: () => MailboxCreds[]) {
  if (w.stopped) return;
  const b = w.box;
  const c = new ImapFlow({ host: b.imap.host, port: b.imap.port, secure: b.imap.secure, auth: { user: b.imap.user, pass: b.imap.password }, logger: false });
  w.client = c;
  const again = (why: string) => {
    if (w.stopped || w.retry) return;
    db.mailbox.update({ where: { email: b.email }, data: { watchError: why.slice(0, 200) } }).catch(() => {});
    w.retry = setTimeout(() => {
      w.retry = undefined;
      connect(w, all).catch(() => {});
    }, 30_000);
  };
  c.on("error", (e: Error) => log(`${b.email}: ${e.message}`));
  c.on("close", () => again("connection closed"));
  try {
    await c.connect();
    await c.mailboxOpen("INBOX");
    const row = await db.mailbox.findUnique({ where: { email: b.email }, select: { lastUid: true } });
    // First watch of this mailbox: start from now (older mail is not new). Later starts catch up from the last uid.
    if (row && row.lastUid == null) {
      const next = (c.mailbox && typeof c.mailbox === "object" ? c.mailbox.uidNext : 1) || 1;
      await db.mailbox.update({ where: { email: b.email }, data: { lastUid: next - 1 } });
    }
    await db.mailbox.update({ where: { email: b.email }, data: { watchedAt: new Date(), watchError: null } }).catch(() => {});
    c.on("exists", () => {
      fetchNew(w, all()).catch((e) => log(`${b.email}: fetch failed: ${(e as Error).message}`));
    });
    await fetchNew(w, all());
    log(`${b.email}: watching INBOX`);
  } catch (e) {
    log(`${b.email}: connect failed: ${(e as Error).message}`);
    again((e as Error).message);
  }
}

/** (Re)reads the mailbox list: starts new watches, restarts changed ones, stops removed ones. */
async function reconcile() {
  const list = await listMailboxCreds().catch(() => [] as MailboxCreds[]);
  const current = () => list;
  const seen = new Set<string>();
  for (const box of list) {
    if (!box.imap.host || !box.imap.user || !box.imap.password) continue;
    seen.add(box.email);
    const w = state.watches.get(box.email);
    if (w && w.key === credKey(box)) {
      w.box = box;
      continue;
    }
    if (w) stop(w);
    const nw: Watch = { box, client: null, key: credKey(box), stopped: false };
    state.watches.set(box.email, nw);
    connect(nw, current).catch(() => {});
  }
  for (const [email, w] of state.watches) {
    if (seen.has(email)) continue;
    stop(w);
    state.watches.delete(email);
  }
}

function stop(w: Watch) {
  w.stopped = true;
  if (w.retry) clearTimeout(w.retry);
  w.client?.logout().catch(() => {});
}

export function startMailboxWatch() {
  if (state.timer) return;
  log("starting");
  reconcile().catch((e) => log("reconcile failed:", (e as Error).message));
  state.timer = setInterval(() => reconcile().catch(() => {}), 60_000);
}

/** For the dashboard: which mailboxes are being watched right now. */
export function watchStatus(): Record<string, boolean> {
  return Object.fromEntries([...state.watches].map(([email, w]) => [email, !!w.client?.usable]));
}

/** Re-read the mailbox list now (after a mailbox is added or synced). No-op when the watch is not running. */
export function refreshMailboxWatch() {
  if (state.timer) reconcile().catch(() => {});
}
