// Server-only Smartlead client for the dashboard's Inbox and Email Analytics pages (never import from client components).
// The API key comes from Settings > Integrations, else SMARTLEAD_API_KEY or the n8n config file (src/lib/integrations.ts).
// Only whitelisted fields leave this file: Smartlead's email-account rows include SMTP/IMAP passwords.
import { integrationValue } from "@/lib/integrations";

const API = "https://server.smartlead.ai/api/v1";

async function apiKey(): Promise<string | null> {
  return (await integrationValue("SMARTLEAD_API_KEY")) || null;
}

export const smartleadConfigured = async () => !!(await apiKey());

export class SmartleadError extends Error {
  constructor(message: string, readonly status = 0) {
    super(message);
  }
}

async function sl<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const key = await apiKey();
  if (!key) throw new SmartleadError("Smartlead API key is not configured");
  const url = `${API}${path}${path.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(key)}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
  } catch (e) {
    throw new SmartleadError(`Could not reach Smartlead: ${(e as Error).message}`);
  }
  const text = await res.text();
  if (!res.ok) throw new SmartleadError(`Smartlead ${res.status}: ${text.slice(0, 200)}`, res.status);
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

// Small in-memory cache: pages re-render often (live refresh) and Smartlead rate-limits per key.
const cache = new Map<string, { at: number; value: Promise<unknown> }>();
function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;
  const value = load().catch((e) => {
    cache.delete(key);
    throw e;
  });
  cache.set(key, { at: Date.now(), value });
  return value;
}
export function dropCache(prefix: string) {
  for (const k of cache.keys()) if (k.startsWith(prefix)) cache.delete(k);
}

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

// ---------- campaigns + analytics ----------

export type SlCampaign = { id: string; name: string; status: string; createdAt: string };

export function listCampaigns(): Promise<SlCampaign[]> {
  return cached("campaigns", 60_000, async () => {
    const rows = await sl<{ id: number; name: string; status: string; created_at: string }[]>("GET", "/campaigns");
    return (Array.isArray(rows) ? rows : [])
      .filter((c) => c.status !== "DELETED")
      .map((c) => ({ id: String(c.id), name: c.name, status: c.status, createdAt: c.created_at }));
  });
}

export type SlCampaignStats = SlCampaign & {
  sent: number;
  uniqueSent: number;
  opens: number;
  clicks: number;
  replies: number;
  bounces: number;
  unsubscribed: number;
  leads: { total: number; notStarted: number; inProgress: number; completed: number; paused: number; stopped: number; blocked: number; interested: number };
};

export function campaignStats(c: SlCampaign): Promise<SlCampaignStats> {
  return cached(`analytics:${c.id}`, 60_000, async () => {
    const a = await sl<Record<string, unknown> & { campaign_lead_stats?: Record<string, unknown> }>("GET", `/campaigns/${c.id}/analytics`);
    const s = a.campaign_lead_stats ?? {};
    return {
      ...c,
      sent: num(a.sent_count),
      uniqueSent: num(a.unique_sent_count),
      opens: num(a.unique_open_count),
      clicks: num(a.unique_click_count),
      replies: num(a.reply_count),
      bounces: num(a.bounce_count),
      unsubscribed: num(a.unsubscribed_count),
      leads: {
        total: num(s.total),
        notStarted: num(s.notStarted),
        inProgress: num(s.inprogress),
        completed: num(s.completed),
        paused: num(s.paused),
        stopped: num(s.stopped),
        blocked: num(s.blocked),
        interested: num(s.interested),
      },
    };
  });
}

export type SlDay = { date: string; sent: number; opened: number; replied: number; bounced: number; unsubscribed: number };

/** Account-wide day-by-day counts. Smartlead labels days "3 Nov" (no year), so dates are rebuilt from the range. */
export function dayWiseStats(start: Date, end: Date): Promise<SlDay[]> {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return cached(`daywise:${iso(start)}:${iso(end)}`, 120_000, async () => {
    const r = await sl<{ data?: { day_wise_stats?: { email_engagement_metrics?: Record<string, unknown> }[] } }>(
      "GET",
      `/analytics/day-wise-overall-stats?start_date=${iso(start)}&end_date=${iso(end)}`,
    );
    const rows = r.data?.day_wise_stats ?? [];
    return rows.map((row, i) => {
      const m = row.email_engagement_metrics ?? {};
      const d = new Date(start.getTime() + i * 86_400_000);
      return { date: iso(d), sent: num(m.sent), opened: num(m.opened), replied: num(m.replied), bounced: num(m.bounced), unsubscribed: num(m.unsubscribed) };
    });
  });
}

// ---------- mailboxes ----------

export type SlMailbox = {
  id: string;
  fromName: string;
  fromEmail: string;
  type: string;
  dailyLimit: number;
  sentToday: number;
  smtpOk: boolean;
  imapOk: boolean;
  campaigns: number;
  warmup: { status: string; reputation: string; sent: number; spam: number; replyRate: number | null } | null;
};

export function listMailboxes(): Promise<SlMailbox[]> {
  return cached("mailboxes", 60_000, async () => {
    const rows = await sl<Record<string, unknown>[]>("GET", "/email-accounts/?offset=0&limit=100");
    return (Array.isArray(rows) ? rows : []).map((a) => {
      const w = (a.warmup_details ?? null) as Record<string, unknown> | null;
      return {
        id: String(a.id),
        fromName: String(a.from_name ?? ""),
        fromEmail: String(a.from_email ?? ""),
        type: String(a.type ?? ""),
        dailyLimit: num(a.message_per_day),
        sentToday: num(a.daily_sent_count),
        smtpOk: a.is_smtp_success === true,
        imapOk: a.is_imap_success === true,
        campaigns: num(a.campaign_count),
        warmup: w
          ? { status: String(w.status ?? ""), reputation: String(w.warmup_reputation ?? ""), sent: num(w.total_sent_count), spam: num(w.total_spam_count), replyRate: w.reply_rate == null ? null : num(w.reply_rate) }
          : null,
      };
    });
  });
}

// ---------- sent emails (per campaign) ----------

export type SlSentRow = {
  campaignId: string;
  leadEmail: string;
  leadName: string;
  category: string | null;
  step: number;
  statsId: string;
  subject: string;
  sentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  repliedAt: string | null;
  bounced: boolean;
  unsubscribed: boolean;
};

/** Every sequence email Smartlead sent in a campaign (up to 2,000 rows), newest data within 30 s. */
export function campaignSent(campaignId: string): Promise<SlSentRow[]> {
  return cached(`sent:${campaignId}`, 30_000, async () => {
    const out: SlSentRow[] = [];
    for (let offset = 0; offset < 2000; offset += 100) {
      const r = await sl<{ total_stats?: string; data?: Record<string, unknown>[] }>("GET", `/campaigns/${campaignId}/statistics?offset=${offset}&limit=100`);
      const data = r.data ?? [];
      for (const s of data) {
        out.push({
          campaignId,
          leadEmail: String(s.lead_email ?? "").toLowerCase(),
          leadName: String(s.lead_name ?? ""),
          category: (s.lead_category as string) || null,
          step: num(s.sequence_number),
          statsId: String(s.stats_id ?? ""),
          subject: String(s.email_subject ?? ""),
          sentAt: (s.sent_time as string) || null,
          openedAt: (s.open_time as string) || null,
          clickedAt: (s.click_time as string) || null,
          repliedAt: (s.reply_time as string) || null,
          bounced: s.is_bounced === true,
          unsubscribed: s.is_unsubscribed === true,
        });
      }
      if (data.length < 100 || out.length >= num(r.total_stats)) break;
    }
    return out;
  });
}

// ---------- threads ----------

export type SlMessage = {
  type: "SENT" | "REPLY";
  from: string;
  to: string;
  time: string;
  subject: string | null;
  html: string;
  messageId: string;
  statsId: string;
  step: number | null;
};

export async function leadIdByEmail(email: string): Promise<string | null> {
  return cached(`leadid:${email.toLowerCase()}`, 300_000, async () => {
    try {
      const r = await sl<{ id?: number | string } | null>("GET", `/leads/?email=${encodeURIComponent(email)}`);
      return r && r.id ? String(r.id) : null;
    } catch (e) {
      if (e instanceof SmartleadError && e.status === 404) return null;
      throw e;
    }
  });
}

export function messageHistory(campaignId: string, leadId: string): Promise<SlMessage[]> {
  return cached(`thread:${campaignId}:${leadId}`, 15_000, async () => {
    const r = await sl<{ history?: Record<string, unknown>[] }>("GET", `/campaigns/${campaignId}/leads/${leadId}/message-history`);
    return (r.history ?? []).map((m) => ({
      type: m.type === "REPLY" ? "REPLY" : "SENT",
      from: String(m.from ?? ""),
      to: String(m.to ?? ""),
      time: String(m.time ?? ""),
      subject: (m.subject as string) || null,
      html: String(m.email_body ?? ""),
      messageId: String(m.message_id ?? ""),
      statsId: String(m.stats_id ?? ""),
      step: m.email_seq_number == null ? null : num(m.email_seq_number),
    }));
  });
}

/** Answers in the same thread. Smartlead quotes reply_email_body under our text, so only the prospect's own words go there. */
export async function replyInThread(
  campaignId: string,
  to: SlMessage,
  emailBodyHtml: string,
  quotedHtml: string,
): Promise<void> {
  await sl("POST", `/campaigns/${campaignId}/reply-email-thread`, {
    email_stats_id: to.statsId,
    email_body: emailBodyHtml,
    reply_message_id: to.messageId,
    reply_email_time: new Date(to.time || Date.now()).toISOString(),
    reply_email_body: quotedHtml,
  });
}

// ---------- controls (Email Analytics buttons) ----------

/** Turns warm-up on or off for one mailbox, keeping its current warm-up numbers (Smartlead defaults when it has none). */
export async function setWarmup(mailboxId: string, enabled: boolean): Promise<void> {
  const rows = await sl<Record<string, unknown>[]>("GET", "/email-accounts/?offset=0&limit=100");
  const row = (Array.isArray(rows) ? rows : []).find((r) => String(r.id) === mailboxId);
  if (!row) throw new SmartleadError("Mailbox not found in Smartlead", 404);
  const w = (row.warmup_details ?? {}) as Record<string, unknown>;
  await sl("POST", `/email-accounts/${mailboxId}/warmup`, {
    warmup_enabled: enabled,
    total_warmup_per_day: num(w.warmup_max_count) || num(w.max_email_per_day) || 20,
    daily_rampup: Math.max(5, num(w.rampup_value)), // Smartlead refuses less than 5
    reply_rate_percentage: num(w.reply_rate) || 30,
  });
  dropCache("mailboxes");
}

export async function campaignMailboxIds(campaignId: string): Promise<string[]> {
  const rows = await sl<{ id: number | string }[]>("GET", `/campaigns/${campaignId}/email-accounts`);
  return (Array.isArray(rows) ? rows : []).map((r) => String(r.id));
}

/**
 * Starts or pauses sending for one campaign. Starting attaches every connected mailbox first when the campaign has
 * none (Smartlead cannot send without one). Smartlead's own error text is passed back if it refuses.
 */
export async function setSending(campaignId: string, on: boolean): Promise<{ attached: number }> {
  let attached = 0;
  if (on) {
    // Smartlead cannot start a campaign without a sending window. Default: Mon-Fri 07:00-15:00 New York
    // (12:00-20:00 UK), at most 20 new leads a day, 10 minutes between emails. Change it in Smartlead if needed.
    const c = await sl<Record<string, unknown>>("GET", `/campaigns/${campaignId}`);
    if (!c.scheduler_cron_value) {
      await sl("POST", `/campaigns/${campaignId}/schedule`, {
        timezone: "America/New_York",
        days_of_the_week: [1, 2, 3, 4, 5],
        start_hour: "07:00",
        end_hour: "15:00",
        min_time_btw_emails: 10,
        max_new_leads_per_day: 20,
        schedule_start_time: new Date().toISOString(),
      });
    }
    const current = await campaignMailboxIds(campaignId);
    if (!current.length) {
      const boxes = (await listMailboxes()).filter((m) => m.smtpOk && m.imapOk).map((m) => Number(m.id));
      if (!boxes.length) throw new SmartleadError("No connected mailbox to send from");
      await sl("POST", `/campaigns/${campaignId}/email-accounts`, { email_account_ids: boxes });
      attached = boxes.length;
    }
  }
  await sl("POST", `/campaigns/${campaignId}/status`, { status: on ? "START" : "PAUSED" });
  dropCache("campaigns");
  dropCache(`analytics:${campaignId}`);
  return { attached };
}

// ---------- mailbox accounts (raw rows include logins; only src/lib/mailboxes.ts may use these) ----------

export function rawEmailAccounts(): Promise<Record<string, unknown>[]> {
  return sl<Record<string, unknown>[]>("GET", "/email-accounts/?offset=0&limit=100").then((r) => (Array.isArray(r) ? r : []));
}

/** Creates (or, with id, updates) an SMTP/IMAP mailbox in Smartlead. Smartlead tests both logins and refuses bad ones. */
export async function saveEmailAccount(body: Record<string, unknown>): Promise<{ id: string | null; message: string }> {
  const r = await sl<Record<string, unknown>>("POST", "/email-accounts/save", body);
  dropCache("mailboxes");
  const id = (r && (r.emailAccountId ?? r.id ?? (r.data as Record<string, unknown> | undefined)?.id)) as string | number | undefined;
  return { id: id != null ? String(id) : null, message: String((r && (r.message as string)) || "saved") };
}
