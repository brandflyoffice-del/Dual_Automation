import { Workflow, webhook, respond, respondHtml, ifNode, switchNode, http, code, postgres, sticky, dashboardNotify, smartleadUrl, googleCalendarIdNode, calExpr } from "./lib.mjs";
import { CLASSIFY_REPLY_SYSTEM, DRAFT_REPLY_SYSTEM } from "./prompts.mjs";
import { SIGN_JS, FMT_JS, PAGE_JS } from "./helpers.mjs";

const GCRED = { googleCalendarOAuth2Api: { id: "y5FL0LJTf7OK7BZo", name: "Google Calendar account" } };

const LEAD_CONTEXT_SQL = `SELECT l.id, l.email, l.first_name, l.company_name, l.role, l.region, l.country, l.recommended_service,
  l.pain_point, l.pain_point_detail, l.estimated_ticket, l.stage, l.campaign_id, l.outreach_lead_id,
  (SELECT coalesce(jsonb_agg(jsonb_build_object('step', cs.step, 'subject', cs.subject, 'body', cs.body) ORDER BY cs.step), '[]'::jsonb)
     FROM campaign_sequences cs WHERE cs.lead_id = l.id AND cs.status = 'SENT') AS sent_emails,
  (SELECT e.external_id FROM email_events e WHERE e.lead_id = l.id AND e.external_id IS NOT NULL ORDER BY e.occurred_at DESC LIMIT 1) AS reply_to_id,
  (SELECT e.eaccount FROM email_events e WHERE e.lead_id = l.id AND e.eaccount IS NOT NULL ORDER BY e.occurred_at DESC LIMIT 1) AS eaccount,
  (SELECT e.subject FROM email_events e WHERE e.lead_id = l.id AND e.subject IS NOT NULL ORDER BY e.occurred_at DESC LIMIT 1) AS last_subject
FROM leads l WHERE l.email = lower($1) LIMIT 1;`;

const RECORD_EVENT_SQL = `WITH r AS (SELECT $1::jsonb AS d),
lead AS (SELECT l.id FROM leads l, r WHERE l.email = lower(r.d->>'email')),
ev AS (
  INSERT INTO email_events (lead_id, type, step, external_id, eaccount, subject, body, sentiment, ai_reply, ai_reply_sent, needs_human, occurred_at)
  SELECT lead.id, r.d->>'type', nullif(r.d->>'step','')::int, r.d->>'externalId', r.d->>'eaccount', r.d->>'subject', r.d->>'body',
    r.d->>'sentiment', r.d->>'aiReply', coalesce((r.d->>'aiReplySent')::boolean, false), coalesce((r.d->>'needsHuman')::boolean, false),
    coalesce((r.d->>'occurredAt')::timestamptz, now())
  FROM lead, r RETURNING id
),
ev_ai AS (
  INSERT INTO email_events (lead_id, type, step, subject, body, ai_reply, ai_reply_sent, sentiment, occurred_at)
  SELECT lead.id, 'AI_REPLY_SENT', nullif(r.d->>'step','')::int, r.d->>'aiSubject', r.d->>'aiReply', r.d->>'aiReply', true,
    r.d->>'sentiment', now() + interval '1 second'
  FROM lead, r WHERE coalesce((r.d->>'aiReplySent')::boolean, false) RETURNING id
),
seq AS (
  UPDATE campaign_sequences cs SET
    status = CASE WHEN r.d->>'type' = 'EMAIL_SENT' THEN 'SENT' ELSE cs.status END,
    sent_at = CASE WHEN r.d->>'type' = 'EMAIL_SENT' THEN coalesce(cs.sent_at, now()) ELSE cs.sent_at END,
    opens = cs.opens + CASE WHEN r.d->>'type' = 'EMAIL_OPENED' THEN 1 ELSE 0 END,
    clicks = cs.clicks + CASE WHEN r.d->>'type' = 'LINK_CLICKED' THEN 1 ELSE 0 END,
    replied = cs.replied OR r.d->>'type' = 'REPLY_RECEIVED',
    updated_at = now()
  FROM lead, r
  WHERE cs.lead_id = lead.id AND cs.step = coalesce(nullif(r.d->>'step','')::int, 1)
  RETURNING cs.id
)
UPDATE leads l SET
  stage = CASE
    WHEN l.stage IN ('BOOKED', 'NOT_INTERESTED') THEN l.stage
    WHEN r.d->>'type' = 'REPLY_RECEIVED' AND r.d->>'sentiment' = 'Not_Interested' THEN 'NOT_INTERESTED'
    WHEN r.d->>'type' = 'REPLY_RECEIVED' AND r.d->>'sentiment' = 'Out_Of_Office' THEN l.stage
    WHEN r.d->>'type' = 'REPLY_RECEIVED' THEN 'REPLIED'
    WHEN r.d->>'type' = 'EMAIL_SENT' AND l.stage = 'REPLIED' THEN l.stage
    WHEN r.d->>'type' = 'EMAIL_SENT' THEN CASE nullif(r.d->>'step','')::int
      WHEN 1 THEN 'STEP_1_SENT' WHEN 2 THEN 'FOLLOWUP_2' WHEN 3 THEN 'FOLLOWUP_3' WHEN 4 THEN 'BREAKUP_SENT' ELSE l.stage END
    ELSE l.stage END,
  current_step = CASE WHEN r.d->>'type' = 'EMAIL_SENT' THEN GREATEST(l.current_step, coalesce(nullif(r.d->>'step','')::int, 1)) ELSE l.current_step END,
  reply_sentiment = CASE WHEN r.d->>'type' = 'REPLY_RECEIVED' THEN r.d->>'sentiment' ELSE l.reply_sentiment END,
  replied_at = CASE WHEN r.d->>'type' = 'REPLY_RECEIVED' THEN now() ELSE l.replied_at END,
  needs_human = CASE WHEN r.d->>'type' = 'REPLY_RECEIVED' THEN coalesce((r.d->>'needsHuman')::boolean, false) ELSE l.needs_human END,
  sequence_paused = CASE WHEN r.d->>'type' = 'REPLY_RECEIVED' AND coalesce(r.d->>'sentiment','') <> 'Out_Of_Office' THEN true ELSE l.sequence_paused END,
  updated_at = now()
FROM lead, r
WHERE l.id = lead.id
RETURNING l.email, l.stage, l.reply_sentiment, l.needs_human, r.d->>'type' AS event_type;`;

export function buildWorkflow2() {
  const w = new Workflow("Fenebris_02_Outreach_Events_And_FollowUp_Tracker");

  sticky(
    w,
    "## Fenebris_02 — Outreach Events & Follow-Up Tracker\n**Email-only.** Smartlead webhooks (`EMAIL_SENT`, `EMAIL_OPEN`, `EMAIL_REPLY`, `EMAIL_LINK_CLICK`, `EMAIL_BOUNCE`) → Postgres + dashboard. Set the webhook secret_key to the same value as DASHBOARD_WEBHOOK_SECRET.\n\n**Replies:** AI sentiment → positive / question / not interested / out of office. Positive and question replies are answered in-thread with 3 real Cal.com slots when the send policy passes.\n\n**Booking from the chat:** the draft reads the whole Smartlead thread and the real free times (Cal.com minus Google Calendar busy). It writes the answer, the system adds time buttons. When the prospect clicks a button (`fenebris-pick-slot`) or clearly accepts one time in writing, n8n re-checks the calendar, creates the Cal.com booking, replies in the thread, and feeds the meeting lane (Calendar + Sheet + Meetings).\n\nEnv: SMARTLEAD_API_KEY, OPENAI_API_KEY, OPENAI_MODEL, CAL_API_KEY, CAL_EVENT_TYPE_ID, CAL_WEBHOOK_TOKEN, BOOKING_LINK, PUBLIC_N8N_URL, N8N_INTERNAL_URL, SENDER_NAME, CASE_STUDIES, AI_AUTO_REPLY, DASHBOARD_URL, DASHBOARD_WEBHOOK_SECRET.",
    [0, -2],
    [820, 230],
  );

  /* ═════ Entry A: outreach platform events ═════ */
  // responseNode (not onReceived): n8n refuses onReceived when a Respond node is downstream, and the slot-booking path ends in one.
  webhook(w, "Webhook: Outreach Events (Instantly / Smartlead)", [0, 0], "fenebris-outreach-events");
  respond(w, "Respond 200 (events)", [1.5, -0.6], 200, '{"ok": true}');
  respond(w, "Respond 401 (events)", [1.5, 0.6], 401, '{"error": "unauthorized"}');
  ifNode(w, "Authorized Event?", [1, 0], "={{ !!$env.DASHBOARD_WEBHOOK_SECRET && ($json.headers['x-fenebris-secret'] === $env.DASHBOARD_WEBHOOK_SECRET || ($json.body && $json.body.secret_key === $env.DASHBOARD_WEBHOOK_SECRET) || ($json.query && $json.query.secret_key === $env.DASHBOARD_WEBHOOK_SECRET)) }}");
  code(
    w,
    "Normalize Event",
    [2, 0],
    String.raw`
const b = $('Webhook: Outreach Events (Instantly / Smartlead)').first().json.body || {};
const raw = String(b.event_type || b.event || b.type || '').toLowerCase();
let type = null;
if (/repl/.test(raw)) type = 'REPLY_RECEIVED';
else if (/open/.test(raw)) type = 'EMAIL_OPENED';
else if (/click/.test(raw)) type = 'LINK_CLICKED';
else if (/bounce/.test(raw)) type = 'EMAIL_BOUNCED';
else if (/sent/.test(raw)) type = 'EMAIL_SENT';
if (!type) return []; // unsupported event type (unsubscribed, account_error, ...) => ignored

const email = String(b.sl_lead_email || b.lead_email || b.to_email || b.email || (b.lead && b.lead.email) || '').toLowerCase().trim();
if (!email) return [];
let step = parseInt(b.step ?? b.sequence_number ?? b.sequence_step ?? 1, 10);
if (!Number.isFinite(step)) step = 1;
step = Math.min(4, Math.max(1, step));
const replyObj = b.reply_message || {};
const textRaw = String(b.reply_text || replyObj.text || b.preview_text || b.text_body || '');
const replyText = textRaw.replace(/<[^>]+>/g, ' ').split(/\r?\n\s*On .{5,200} wrote:|\r?\n-{2,}\s*Original Message|\r?\n>/i)[0].trim();
let occurredAt = new Date().toISOString();
const stamp = b.event_timestamp || b.timestamp || b.time_replied || b.time_sent;
if (stamp && !isNaN(new Date(stamp))) occurredAt = new Date(stamp).toISOString();

return [{ json: { type, event: {
  email, type, step,
  externalId: (replyObj.message_id) || b.message_id || b.email_id || null,
  smartleadLeadId: b.sl_email_lead_id || b.lead_id || null,
  campaignId: b.campaign_id || null,
  statsId: b.stats_id || null,
  eaccount: b.from_email || b.email_account || b.sender_email || null,
  subject: b.subject || b.reply_subject || b.email_subject || null,
  body: type === 'REPLY_RECEIVED' ? replyText : null,
  occurredAt,
} } }];
`,
  );
  ifNode(w, "Is Reply?", [3, 0], "={{ $json.type === 'REPLY_RECEIVED' }}");

  postgres(w, "DB: Get Lead Context", [4, -1], LEAD_CONTEXT_SQL, "={{ [$json.event.email] }}");

  code(
    w,
    "Build Classify Request",
    [5, -1],
    "const SYSTEM = " + JSON.stringify(CLASSIFY_REPLY_SYSTEM) + ";\n" + String.raw`
const lead = $input.first().json;
const ev = $('Normalize Event').first().json.event;
const sent = (lead.sent_emails || []).filter(e => e.step <= ev.step).pop() || {};
const user = '<our_last_email subject="' + (sent.subject || '') + '">\n' + (sent.body || '') + '\n</our_last_email>\n<prospect_reply>\n' + (ev.body || '(empty reply)') + '\n</prospect_reply>';
return [{ json: { classifyRequest: { model: $env.OPENAI_MODEL || 'gpt-4o', temperature: 0, response_format: { type: 'json_object' },
  messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }] } } }];
`,
  );
  http(w, "AI: Classify Reply (Sentiment)", [6, -1], {
    url: "https://api.openai.com/v1/chat/completions",
    headers: { Authorization: "=Bearer {{ $env.OPENAI_API_KEY }}", "content-type": "application/json" },
    json: "={{ JSON.stringify($json.classifyRequest) }}",
    timeout: 60000,
  });
  code(
    w,
    "Parse Classification",
    [7, -1],
    String.raw`
const lead = $('DB: Get Lead Context').first().json;
const ev = $('Normalize Event').first().json.event;
const INTENTS = ['Positive_Booking_Intent', 'Question_Needs_FollowUp', 'Not_Interested', 'Out_Of_Office'];
let ai = {};
try { ai = JSON.parse($input.first().json.choices[0].message.content); } catch (e) { ai = {}; }
let intent = INTENTS.includes(ai.intent) ? ai.intent : 'Question_Needs_FollowUp';
let confidence = INTENTS.includes(ai.intent) ? Number(ai.confidence) || 0 : 0; // unparsable => confidence 0 => human review
const t = ev.body || '';
// deterministic guard-rails override the model for the two high-risk cases
if (/\b(unsubscribe|remove me|stop (emailing|contacting|sending)|do not (contact|email)|take me off)\b/i.test(t)) { intent = 'Not_Interested'; confidence = 1; }
else if (intent !== 'Positive_Booking_Intent' && /(out of (the )?office|auto-?reply|automatic reply|away from (my )?(desk|email)|on (annual |maternity |paternity )?leave|on vacation)/i.test(t)) { intent = 'Out_Of_Office'; confidence = Math.max(confidence, 0.9); }
return [{ json: { ctx: { lead, event: ev, intent, confidence, summary: ai.summary || '', returnDate: ai.return_date || null, replyText: t } } }];
`,
  );
  switchNode(w, "Route by Intent", [8, -1], "={{ $json.ctx.intent }}", [
    ["Positive_Booking_Intent", "Positive_Booking_Intent"],
    ["Question_Needs_FollowUp", "Question_Needs_FollowUp"],
    ["Not_Interested", "Not_Interested"],
    ["Out_Of_Office", "Out_Of_Office"],
  ]);

  http(w, "Smartlead: Note Interested", [9, -2.2], {
    method: "GET",
    url: smartleadUrl("/leads/"),
    query: { email: "={{ $json.ctx.event.email }}" },
    timeout: 20000,
  });
  http(w, "Smartlead: Block Not Interested", [9, 0.4], {
    url: smartleadUrl("/leads/add-domain-block-list"),
    json: "={{ JSON.stringify({ email: $json.ctx.event.email }) }}",
    timeout: 20000,
  });
  http(w, "Smartlead: Note Out Of Office", [9, 1.4], {
    method: "GET",
    url: smartleadUrl("/leads/"),
    query: { email: "={{ $json.ctx.event.email }}" },
    timeout: 20000,
  });
  code(
    w,
    "Prepare Event: Plain Reply (no email sent)",
    [10, 1],
    String.raw`
const c = $('Parse Classification').first().json.ctx;
return [{ json: { event: { ...c.event, sentiment: c.intent, needsHuman: false, aiReply: null, aiReplySent: false } } }];
`,
  );

  /* ═════ Shared: thread → open slots → AI draft → send OR book ═════ */
  http(w, "Smartlead: Get Thread", [10, -1], {
    method: "GET",
    url: smartleadUrl("/campaigns/{{ $json.ctx.lead.campaign_id || $json.ctx.event.campaignId }}/leads/{{ $json.ctx.event.smartleadLeadId || $json.ctx.lead.outreach_lead_id }}/message-history"),
    timeout: 20000,
  });
  code(
    w,
    "Attach Thread",
    [10.5, -1],
    String.raw`
const ctx = $('Parse Classification').isExecuted ? $('Parse Classification').first().json.ctx : $('Synthesize Booking Intent').first().json.ctx;
const res = $input.first().json || {};
const hist = Array.isArray(res.history) ? res.history : [];
const clean = h => String(h || '')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/[ \t]+/g, ' ')
  .split(/\r?\n\s*On .{5,200} wrote:|\r?\n-{2,}\s*Original Message|\r?\n>/i)[0].replace(/\n{3,}/g, '\n\n').trim();
const lastReply = [...hist].reverse().find(h => h.type === 'REPLY');
const thread = hist.slice(-8).map(h => ({ from: h.type === 'REPLY' ? 'prospect' : 'us', at: h.time || null, subject: h.subject || '', text: clean(h.email_body || h.body || '').slice(0, 900) }));
const ids = {
  campaignId: ctx.lead.campaign_id || ctx.event.campaignId || null,
  leadId: ctx.event.smartleadLeadId || ctx.lead.outreach_lead_id || null,
  replyMessageId: (lastReply && lastReply.message_id) || ctx.event.externalId || ctx.lead.reply_to_id || null,
  statsId: (lastReply && lastReply.stats_id) || ctx.event.statsId || null,
};
return [{ json: { ctx: { ...ctx, thread, ids, threadLoaded: hist.length > 0 } } }];
`,
  );
  code(
    w,
    "Build Slots Request",
    [11, -1],
    String.raw`
const ctx = $input.first().json.ctx;
const TZ = { US: 'America/New_York', UK: 'Europe/London', EUROPE: 'Europe/Berlin', UAE: 'Asia/Dubai' };
const tz = TZ[ctx.lead.region] || 'UTC';
const day = 86400000, now = Date.now();
const iso = ms => new Date(ms).toISOString().slice(0, 10);
return [{ json: { ctx: { ...ctx, tz }, qs: { start: iso(now), end: iso(now + 9 * day), timeZone: tz } } }];
`,
  );
  http(w, "Cal.com: Get Open Slots", [12, -1], {
    method: "GET",
    url: "https://api.cal.com/v2/slots",
    headers: { Authorization: "=Bearer {{ $env.CAL_API_KEY }}", "cal-api-version": "2024-09-04" },
    query: { eventTypeId: "={{ $env.CAL_EVENT_TYPE_ID }}", start: "={{ $json.qs.start }}", end: "={{ $json.qs.end }}", timeZone: "={{ $json.qs.timeZone }}" },
    timeout: 30000,
  });
  // Belt and braces: Cal.com hides its own bookings, this also removes anything busy on the Google Calendar.
  googleCalendarIdNode(w, "Google: Calendar Id (Offer)", [12.5, -1]);
  w.add(
    "Google Calendar: Busy Times (Offer)",
    "n8n-nodes-base.googleCalendar",
    1.3,
    [13, -1],
    {
      resource: "calendar",
      operation: "availability",
      calendar: calExpr("Google: Calendar Id (Offer)"),
      timeMin: "={{ $('Build Slots Request').first().json.qs.start + 'T00:00:00Z' }}",
      timeMax: "={{ $('Build Slots Request').first().json.qs.end + 'T23:59:59Z' }}",
      options: { outputFormat: "raw" },
    },
    { credentials: GCRED, alwaysOutputData: true, executeOnce: true, onError: "continueRegularOutput" },
  );
  code(
    w,
    "Build Reply Request",
    [14, -1],
    "const SYSTEM = " + JSON.stringify(DRAFT_REPLY_SYSTEM) + ";\n" + SIGN_JS + FMT_JS + String.raw`
const ctx = $('Build Slots Request').first().json.ctx;
const cal = $('Cal.com: Get Open Slots').first().json || {};
const data = (cal.data && typeof cal.data === 'object') ? cal.data : {};
const busy = [];
const walk = o => {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.busy)) for (const b of o.busy) if (b && b.start && b.end) busy.push([new Date(b.start).getTime(), new Date(b.end).getTime()]);
  if (o.start && o.end && !Array.isArray(o)) busy.push([new Date(o.start).getTime(), new Date(o.end).getTime()]);
  for (const k of Object.keys(o)) if (k !== 'busy') walk(o[k]);
};
for (const it of $input.all()) walk(it.json);
const SLOT_MS = 30 * 60000;
const isFree = ms => !busy.some(b => ms < b[1] && ms + SLOT_MS > b[0]);
const days = Object.keys(data).sort();
const all = [];
for (const d of days) {
  const list = Array.isArray(data[d]) ? data[d] : [];
  for (const s of list) {
    const ms = new Date(s.start || s).getTime();
    if (!isFinite(ms) || ms < Date.now() + 3600000 || !isFree(ms)) continue;
    const h = hourIn(ms, ctx.tz);
    if (h < 8 || h >= 18) continue; // never offer a time in the prospect's night
    all.push({ ms, day: d, h });
  }
}
const picks = [];
for (const d of days) {
  const c = all.filter(a => a.day === d);
  const best = c.find(a => a.h >= 10 && a.h < 16) || c[0];
  if (best) picks.push(best);
  if (picks.length === 3) break;
}
if (picks.length < 3) {
  for (const a of all) {
    if (picks.length === 3) break;
    if (!picks.some(p => Math.abs(p.ms - a.ms) < 2 * 3600000)) picks.push(a);
  }
  picks.sort((x, y) => x.ms - y.ms);
}
const publicBase = String($env.PUBLIC_N8N_URL || '').replace(/\/+$/, '');
const secret = $env.DASHBOARD_WEBHOOK_SECRET;
const email = String(ctx.event.email).toLowerCase();
const offered = picks.map(p => {
  const isoStart = new Date(p.ms).toISOString();
  const link = publicBase && secret ? publicBase + '/webhook/fenebris-pick-slot?e=' + encodeURIComponent(email) + '&s=' + encodeURIComponent(isoStart) + '&k=' + slotSig(secret, email, isoStart) : null;
  return { iso: isoStart, label: slotLabel(p.ms, ctx.tz), link };
});
const openList = all.slice(0, 40).map(a => ({ iso: new Date(a.ms).toISOString(), label: slotLabel(a.ms, ctx.tz) }));

const booking = $env.BOOKING_LINK;
const sender = $env.SENDER_NAME || 'Aarav Mehta';
const sent = (ctx.lead.sent_emails || []).filter(e => e.step <= (ctx.event.step || 1)).pop() || {};
const threadText = (ctx.thread && ctx.thread.length)
  ? ctx.thread.map(t => '[' + t.from.toUpperCase() + (t.at ? ' ' + t.at : '') + ']' + (t.subject ? ' Subject: ' + t.subject : '') + '\n' + t.text).join('\n\n')
  : '[US] Subject: ' + (sent.subject || ctx.lead.last_subject || '') + '\n' + (sent.body || '');
const user =
  '<intent>' + ctx.intent + '</intent>\n' +
  '<prospect>' + JSON.stringify({ first_name: ctx.lead.first_name, company: ctx.lead.company_name, role: ctx.lead.role, pain_point: ctx.lead.pain_point, recommended_service: ctx.lead.recommended_service }) + '</prospect>\n' +
  '<thread>\n' + threadText + '\n</thread>\n' +
  '<prospect_latest_reply>\n' + ctx.replyText + '\n</prospect_latest_reply>\n' +
  '<open_slots>\n' + (openList.length ? openList.map(s => s.iso + ' | ' + s.label).join('\n') : '(none)') + '\n</open_slots>\n' +
  '<time_buttons>' + (offered.length ? offered.map(s => s.label).join(' ; ') : 'none, only the booking link') + '</time_buttons>\n' +
  '<booking_link>' + booking + '</booking_link>\n<case_studies>' + (($env.CASE_STUDIES) || '') + '</case_studies>\n<sender_name>' + sender + ', BrandFly</sender_name>';
return [{ json: { ctx: { ...ctx, offered, openIsos: openList.map(s => s.iso), openLabels: Object.fromEntries(openList.map(s => [s.iso, s.label])), publicBase, busyCount: busy.length }, draftRequest: { model: $env.OPENAI_MODEL || 'gpt-4o', temperature: 0.3, response_format: { type: 'json_object' },
  messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }] } } }];
`,
  );
  http(w, "AI: Draft Booking Reply", [15, -1], {
    url: "https://api.openai.com/v1/chat/completions",
    headers: { Authorization: "=Bearer {{ $env.OPENAI_API_KEY }}", "content-type": "application/json" },
    json: "={{ JSON.stringify($('Build Reply Request').first().json.draftRequest) }}",
    timeout: 90000,
  });
  code(
    w,
    "Parse Draft + Send Policy",
    [16, -1],
    FMT_JS + String.raw`
const ctx = $('Build Reply Request').first().json.ctx;
const booking = $env.BOOKING_LINK;
let draft = null;
try { draft = JSON.parse($input.first().json.choices[0].message.content); } catch (e) { draft = null; }
const valid = !!(draft && draft.body && draft.subject && String(draft.body).length < 2500);

// Did the prospect clearly accept one real, free slot? Only then do we book (never on a plain "interested").
let accept = null;
if (valid && draft.accepted_slot_iso) {
  const ms = new Date(draft.accepted_slot_iso).getTime();
  if (isFinite(ms) && ctx.openIsos.some(i => new Date(i).getTime() === ms) && ctx.confidence >= 0.6) accept = new Date(ms).toISOString();
}

const text = valid ? String(draft.body).trim() : '';
const priceClaim = valid && /\$\s?\d|\b\d[\d,.]*\s?(usd|dollars)\b/i.test(text);
const paras = escHtml(text).split(/\n{2,}/).map(p => '<p style="margin:0 0 14px 0">' + p.replace(/\n/g, '<br>') + '</p>').join('');
let slotsHtml = '';
let slotsText = '';
if (ctx.offered.length) {
  const linked = ctx.offered.every(s => !!s.link);
  slotsHtml += '<p style="margin:0 0 8px 0">Pick a time that suits you:</p>';
  for (const s of ctx.offered) {
    slotsHtml += linked
      ? '<p style="margin:0 0 8px 0"><a href="' + escHtml(s.link) + '" style="display:inline-block;background:#4f46e5;color:#ffffff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600">' + escHtml(s.label) + '</a></p>'
      : '<p style="margin:0 0 6px 0">- ' + escHtml(s.label) + '</p>';
  }
  if (!linked) slotsHtml += '<p style="margin:8px 0 14px 0">Reply with the one you prefer and I will book it.</p>';
  slotsText = '\n\nTimes offered:\n' + ctx.offered.map(s => '- ' + s.label).join('\n');
}
const tail = '<p style="margin:14px 0 0 0;color:#475569">Prefer another time? <a href="' + escHtml(booking) + '">Choose one here</a>.</p>';
const html = valid ? paras + slotsHtml + tail : '';
const offerText = valid ? text + slotsText : '';

const auto = String($env.AI_AUTO_REPLY || 'false').toLowerCase() === 'true';
const canThread = !!(ctx.ids.leadId && ctx.ids.replyMessageId && ctx.ids.campaignId);
let autoSend = false;
if (auto && valid && canThread && !accept) {
  if (ctx.intent === 'Positive_Booking_Intent' && ctx.confidence >= 0.6) autoSend = true;
  if (ctx.intent === 'Question_Needs_FollowUp' && ctx.confidence >= 0.8 && draft.safe_to_send === true && !priceClaim) autoSend = true;
}
const sendPayload = valid ? Object.assign({ lead_id: Number(ctx.ids.leadId), email_body: html, reply_message_id: ctx.ids.replyMessageId, reply_email_time: new Date().toISOString() }, ctx.ids.statsId ? { email_stats_id: ctx.ids.statsId } : {}) : null;
return [{ json: { ctx: { ...ctx, draft, accept, autoSend, offerText, sendPayload } } }];
`,
  );
  ifNode(w, "Accepted A Slot?", [17, -1], "={{ !!$json.ctx.accept }}");
  ifNode(w, "Auto-Send Reply?", [18, -0.4], "={{ $json.ctx.autoSend === true }}");

  http(w, "Smartlead: Send Reply In-Thread", [19, -1.2], {
    url: smartleadUrl("/campaigns/{{ $('Parse Draft + Send Policy').first().json.ctx.ids.campaignId }}/reply-email-thread"),
    json: "={{ JSON.stringify($('Parse Draft + Send Policy').first().json.ctx.sendPayload) }}",
    timeout: 30000,
  });
  code(
    w,
    "Prepare Event: AI Replied",
    [20, -1.2],
    String.raw`
const c = $('Parse Draft + Send Policy').first().json.ctx;
const sendOk = !($input.first().json && $input.first().json.error);
return [{ json: { event: { ...c.event, sentiment: c.intent, needsHuman: !sendOk, aiReply: c.offerText, aiSubject: c.draft.subject, aiReplySent: sendOk } } }];
`,
  );
  code(
    w,
    "Prepare Event: Needs Human",
    [19, 0.2],
    String.raw`
const c = $('Parse Draft + Send Policy').first().json.ctx;
return [{ json: { event: { ...c.event, sentiment: c.intent, needsHuman: true, aiReply: c.offerText || null, aiReplySent: false } } }];
`,
  );

  /* ═════ Slot booking: prospect accepted a time (in the chat OR by clicking a time button) ═════ */
  // Entry 1: accepted in the email chat
  code(
    w,
    "Booking Input (Chat)",
    [18, -2.6],
    FMT_JS + String.raw`
const c = $('Parse Draft + Send Policy').first().json.ctx;
const ms = new Date(c.accept).getTime();
const first = String(c.lead.first_name || '').trim() || String(c.event.email).split('@')[0];
return [{ json: { bk: { source: 'chat', email: String(c.event.email).toLowerCase(), startIso: c.accept, tz: c.tz, firstName: first, name: first, label: slotLabel(ms, c.tz), ids: c.ids } } }];
`,
  );

  // Entry 2: clicked a time button in the email (GET, the link carries email + start + signature)
  webhook(w, "Webhook: Slot Link", [0, 8], "fenebris-pick-slot", { method: "GET" });
  code(
    w,
    "Verify Slot Link",
    [1, 8],
    SIGN_JS + String.raw`
const it = $input.first().json;
const q = it.query || {};
const h = it.headers || {};
const email = String(q.e || '').toLowerCase().trim();
const ms = new Date(String(q.s || '')).getTime();
const secret = $env.DASHBOARD_WEBHOOK_SECRET;
const startIso = isFinite(ms) ? new Date(ms).toISOString() : '';
const sig = secret && email && startIso ? slotSig(secret, email, startIso) : '';
const given = String(q.k || '');
let ok = !!sig && given.length === sig.length;
if (ok) { let d = 0; for (let i = 0; i < sig.length; i++) d |= sig.charCodeAt(i) ^ given.charCodeAt(i); ok = d === 0; }
// Mail scanners fetch links without a real click. Book only after c=1 (the confirm button) or a browser-made navigation.
const confirmed = q.c === '1' || h['sec-fetch-user'] === '?1';
return [{ json: { ok, expired: ok && ms < Date.now(), email, startIso, confirmed, k: given } }];
`,
  );
  ifNode(w, "Valid Link?", [2, 8], "={{ $json.ok === true && $json.expired !== true }}");
  code(
    w,
    "Page: Invalid Link",
    [3, 9],
    FMT_JS + PAGE_JS + String.raw`
const v = $input.first().json;
const msg = v.expired ? 'This time has passed.' : 'This link is not valid.';
const link = $env.BOOKING_LINK;
return [{ json: { page: pageHtml(msg, 'You can choose another time here.', pageButton(link, 'Choose a time')) } }];
`,
  );
  ifNode(w, "Confirmed Click?", [3, 7.4], "={{ $json.confirmed === true }}");
  code(
    w,
    "Page: Confirm Time",
    [4, 8.2],
    FMT_JS + PAGE_JS + String.raw`
const v = $input.first().json;
const href = '?e=' + encodeURIComponent(v.email) + '&s=' + encodeURIComponent(v.startIso) + '&k=' + encodeURIComponent(v.k) + '&c=1';
const script = '<script>(function(){var d=new Date(' + JSON.stringify(v.startIso) + ');var el=document.getElementById("t");if(el&&!isNaN(d)){el.textContent=d.toLocaleString(undefined,{weekday:"long",day:"numeric",month:"long",hour:"2-digit",minute:"2-digit",timeZoneName:"short"});}})();</script>';
const msg = 'Your 30-minute Google Meet with BrandFly:<br><strong id="t">' + escHtml(v.startIso) + '</strong>';
return [{ json: { page: pageHtml('Confirm your time', msg, pageButton(href, 'Confirm this time'), script) } }];
`,
  );
  postgres(w, "DB: Get Lead Context (Slot Link)", [4, 7], LEAD_CONTEXT_SQL, "={{ [$json.email] }}", { alwaysOutput: true });
  code(
    w,
    "Booking Input (Link)",
    [5, 7],
    FMT_JS + String.raw`
const v = $('Verify Slot Link').first().json;
const row = $input.first().json || {};
const TZ = { US: 'America/New_York', UK: 'Europe/London', EUROPE: 'Europe/Berlin', UAE: 'Asia/Dubai' };
const tz = TZ[row.region] || 'UTC';
const first = String(row.first_name || '').trim() || v.email.split('@')[0];
const ms = new Date(v.startIso).getTime();
return [{ json: { bk: { source: 'link', email: v.email, startIso: v.startIso, tz, firstName: first, name: first, label: slotLabel(ms, tz), known: !!row.id,
  ids: { campaignId: row.campaign_id || null, leadId: row.outreach_lead_id || null, replyMessageId: row.reply_to_id || null, statsId: null } } } }];
`,
  );

  // Shared: busy check → Cal.com booking → reply + calendar sync
  googleCalendarIdNode(w, "Google: Calendar Id (Booking)", [18.5, -2.6]);
  w.add(
    "Google Calendar: Busy Check (Booking)",
    "n8n-nodes-base.googleCalendar",
    1.3,
    [19, -2.6],
    {
      resource: "calendar",
      operation: "availability",
      calendar: calExpr("Google: Calendar Id (Booking)"),
      timeMin: "={{ $('Slot Booking Input').first().json.bk.startIso }}",
      timeMax: "={{ new Date(new Date($('Slot Booking Input').first().json.bk.startIso).getTime() + 30 * 60000).toISOString() }}",
      options: { outputFormat: "raw" },
    },
    { credentials: GCRED, alwaysOutputData: true, executeOnce: true, onError: "continueRegularOutput" },
  );
  code(
    w,
    "Evaluate Slot",
    [20, -2.6],
    String.raw`
const bk = $('Slot Booking Input').first().json.bk;
const t0 = new Date(bk.startIso).getTime(), t1 = t0 + 30 * 60000;
const busy = [];
const walk = o => {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o.busy)) for (const b of o.busy) if (b && b.start && b.end) busy.push([new Date(b.start).getTime(), new Date(b.end).getTime()]);
  for (const k of Object.keys(o)) if (k !== 'busy') walk(o[k]);
};
for (const it of $input.all()) walk(it.json);
const clash = busy.some(b => t0 < b[1] && t1 > b[0]);
const stale = t0 < Date.now() + 5 * 60000;
const free = !clash && !stale;
return [{ json: { bk, free, reason: stale ? 'the time has already passed' : clash ? 'that time is busy on the calendar' : '' } }];
`,
  );
  ifNode(w, "Slot Still Free?", [21, -2.6], "={{ $json.free === true }}");
  http(w, "Cal.com: Create Booking", [22, -3.2], {
    url: "https://api.cal.com/v2/bookings",
    headers: { Authorization: "=Bearer {{ $env.CAL_API_KEY }}", "cal-api-version": "2026-02-25", "content-type": "application/json" },
    json: "={{ JSON.stringify({ start: $json.bk.startIso, eventTypeId: Number($env.CAL_EVENT_TYPE_ID), attendee: { name: $json.bk.name, email: $json.bk.email, timeZone: $json.bk.tz, language: 'en' }, metadata: { source: 'brandfly-ai-reply' } }) }}",
    timeout: 40000,
  });
  code(
    w,
    "Evaluate Booking",
    [23, -3.2],
    String.raw`
const bk = $('Slot Booking Input').first().json.bk;
const r = $input.first().json || {};
const d = (r.data && typeof r.data === 'object') ? (Array.isArray(r.data) ? r.data[0] : r.data) : {};
const uid = d.uid || (d.booking && d.booking.uid) || null;
const booked = !r.error && r.status !== 'error' && !!uid;
const start = new Date(d.start || bk.startIso).toISOString();
const end = new Date(d.end || new Date(start).getTime() + 30 * 60000).toISOString();
const loc = typeof d.location === 'string' && /^https?:\/\//.test(d.location) ? d.location : null;
const msg = (r.error && (r.error.message || r.error.description)) || (r.error && typeof r.error === 'string' && r.error) || (r.message) || '';
return [{ json: { bk, booked, reason: booked ? '' : ('Cal.com did not confirm the booking' + (msg ? ': ' + String(msg).slice(0, 160) : '')),
  cal: { uid, start, end, meetLink: d.meetingUrl || loc || null, iCalUID: d.iCalUID || null } } }];
`,
  );
  ifNode(w, "Booked?", [24, -3.2], "={{ $json.booked === true }}");

  // booking succeeded: (1) show page, (2) calendar + sheet + meetings via the meeting lane, (3) confirm in the thread
  ifNode(w, "Link Booking? (ok)", [25, -4.2], "={{ $json.bk.source === 'link' }}");
  code(
    w,
    "Page: Booked",
    [26, -4.6],
    FMT_JS + PAGE_JS + String.raw`
const b = $input.first().json;
const msg = 'Your meeting is booked for<br><strong>' + escHtml(b.bk.label) + '</strong>.<br><br>A Google Calendar invite with the Google Meet link is on its way to <strong>' + escHtml(b.bk.email) + '</strong>.';
return [{ json: { page: pageHtml('You are booked', msg, '') } }];
`,
  );
  // Cal.com writes its own Google event a moment after the booking returns; wait so the meeting lane finds it instead of creating a duplicate.
  code(
    w,
    "Let Calendar Settle",
    [24.5, -3.2],
    String.raw`
await new Promise(r => setTimeout(r, 5000));
return $input.all();
`,
  );
  http(w, "Sync Booking To Meeting Lane", [25, -3.2], {
    url: "={{ ($env.N8N_INTERNAL_URL || 'http://localhost:5678').replace(/\\/+$/, '') + '/webhook/fenebris-cal-booking?token=' + $env.CAL_WEBHOOK_TOKEN }}",
    headers: { "content-type": "application/json" },
    json: "={{ JSON.stringify({ triggerEvent: 'BOOKING_CREATED', payload: { uid: $json.cal.uid, startTime: $json.cal.start, endTime: $json.cal.end, iCalUID: $json.cal.iCalUID, attendees: [{ email: $json.bk.email, name: $json.bk.name, timeZone: $json.bk.tz }], metadata: { videoCallUrl: $json.cal.meetLink }, location: $json.cal.meetLink }, source: 'brandfly-ai-reply' }) }}",
    timeout: 30000,
  });
  code(
    w,
    "Build Booking Confirmation",
    [25, -2.2],
    String.raw`
const b = $('Evaluate Booking').first().json;
const bk = b.bk;
const sender = $env.SENDER_NAME || 'Aarav Mehta';
const text = 'Hi ' + bk.firstName + ',\n\nYour slot is booked for ' + bk.label + '. A Google Calendar invite with the Google Meet link is on its way to ' + bk.email + '.\n\nIf anything changes, just reply here and we will sort it out.\n\n' + sender + ', BrandFly';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const html = esc(text).split(/\n{2,}/).map(p => '<p style="margin:0 0 14px 0">' + p.replace(/\n/g, '<br>') + '</p>').join('');
const ids = bk.ids || {};
const canSend = !!(ids.campaignId && ids.leadId && ids.replyMessageId);
const sendPayload = Object.assign({ lead_id: Number(ids.leadId), email_body: html, reply_message_id: ids.replyMessageId, reply_email_time: new Date().toISOString() }, ids.statsId ? { email_stats_id: ids.statsId } : {});
return [{ json: { canSend, ids, sendPayload, record: { email: bk.email, subject: 'Meeting confirmed', body: text } } }];
`,
  );
  ifNode(w, "Can Send Confirmation?", [26, -2.2], "={{ $json.canSend === true }}");
  http(w, "Smartlead: Send Booking Confirmation", [27, -2.6], {
    url: smartleadUrl("/campaigns/{{ $json.ids.campaignId }}/reply-email-thread"),
    json: "={{ JSON.stringify($json.sendPayload) }}",
    timeout: 30000,
  });
  postgres(
    w,
    "DB: Record Booking Confirmation",
    [28, -2.6],
    `WITH r AS (SELECT $1::jsonb AS d),
lead AS (SELECT l.id FROM leads l, r WHERE l.email = lower(r.d->>'email')),
ins AS (
  INSERT INTO email_events (lead_id, type, subject, body, ai_reply, ai_reply_sent, sentiment, occurred_at)
  SELECT lead.id, 'AI_REPLY_SENT', r.d->>'subject', r.d->>'body', r.d->>'body', true, 'Slot_Booked', now() FROM lead, r
  RETURNING id
)
SELECT (SELECT count(*) FROM ins) AS inserted, (SELECT r.d->>'email' FROM r) AS email;`,
    "={{ [JSON.stringify($('Build Booking Confirmation').first().json.record)] }}",
    { alwaysOutput: true },
  );
  dashboardNotify(
    w,
    "Dashboard: Booking Confirmed",
    [29, -2.6],
    "={{ JSON.stringify({ event: 'email_event', ingest: false, data: { email: $json.email, type: 'AI_REPLY_SENT', sentiment: 'Slot_Booked', needsHuman: false, stage: 'BOOKED' } }) }}",
  );

  // booking failed (busy, passed, or Cal.com refused)
  ifNode(w, "Link Booking? (failed)", [24, -1.8], "={{ $json.bk.source === 'link' }}");
  code(
    w,
    "Page: Slot Unavailable",
    [25, -2],
    FMT_JS + PAGE_JS + String.raw`
const link = $env.BOOKING_LINK;
return [{ json: { page: pageHtml('That time is no longer available', 'Someone just took it, or it has passed. Please pick another time and it will be confirmed straight away.', pageButton(link, 'Choose another time')) } }];
`,
  );
  code(
    w,
    "Prepare Event: Booking Failed",
    [25, -1.2],
    String.raw`
const f = $input.first().json;
const c = $('Parse Draft + Send Policy').first().json.ctx;
return [{ json: { event: { ...c.event, sentiment: c.intent, needsHuman: true, aiReply: '[Booking not completed: ' + f.reason + '] The prospect accepted ' + f.bk.label + '. Please follow up by email with another time.', aiReplySent: false } } }];
`,
  );
  respondHtml(w, "Respond HTML Page", [27, 8]);
  code(w, "Slot Booking Input", [19, -3.6], String.raw`
return [{ json: $input.first().json }];
`);

  /* ═════ Persist + notify (shared) ═════ */
  postgres(w, "DB: Record Event + Update Lead", [18, 0], RECORD_EVENT_SQL, "={{ [JSON.stringify($json.event)] }}");
  dashboardNotify(
    w,
    "Dashboard: Realtime Event",
    [19, 0],
    "={{ JSON.stringify({ event: 'email_event', ingest: false, data: { email: $json.email, type: $json.event_type, sentiment: $json.reply_sentiment, needsHuman: $json.needs_human, stage: $json.stage } }) }}",
  );

  /* wiring A */
  w.connect("Webhook: Outreach Events (Instantly / Smartlead)", "Authorized Event?");
  w.connect("Authorized Event?", "Respond 200 (events)", 0);
  w.connect("Authorized Event?", "Respond 401 (events)", 1);
  w.connect("Respond 200 (events)", "Normalize Event");
  w.connect("Normalize Event", "Is Reply?");
  w.connect("Is Reply?", "DB: Get Lead Context", 0);
  w.connect("Is Reply?", "DB: Record Event + Update Lead", 1); // non-reply events: straight to DB (event is already shaped)
  w.chain("DB: Get Lead Context", "Build Classify Request", "AI: Classify Reply (Sentiment)", "Parse Classification", "Route by Intent");
  w.connect("Route by Intent", "Smartlead: Note Interested", 0);
  w.connect("Route by Intent", "Smartlead: Get Thread", 0);
  w.connect("Route by Intent", "Smartlead: Get Thread", 1);
  w.connect("Route by Intent", "Smartlead: Block Not Interested", 2);
  w.connect("Route by Intent", "Smartlead: Note Out Of Office", 3);
  w.connect("Smartlead: Block Not Interested", "Prepare Event: Plain Reply (no email sent)");
  w.connect("Smartlead: Note Out Of Office", "Prepare Event: Plain Reply (no email sent)");
  w.connect("Prepare Event: Plain Reply (no email sent)", "DB: Record Event + Update Lead");
  w.chain(
    "Smartlead: Get Thread",
    "Attach Thread",
    "Build Slots Request",
    "Cal.com: Get Open Slots",
    "Google: Calendar Id (Offer)",
    "Google Calendar: Busy Times (Offer)",
    "Build Reply Request",
    "AI: Draft Booking Reply",
    "Parse Draft + Send Policy",
    "Accepted A Slot?",
  );
  w.connect("Accepted A Slot?", "Booking Input (Chat)", 0);
  w.connect("Accepted A Slot?", "Auto-Send Reply?", 1);
  w.connect("Auto-Send Reply?", "Smartlead: Send Reply In-Thread", 0);
  w.connect("Auto-Send Reply?", "Prepare Event: Needs Human", 1);
  w.connect("Smartlead: Send Reply In-Thread", "Prepare Event: AI Replied");
  w.connect("Prepare Event: AI Replied", "DB: Record Event + Update Lead");
  w.connect("Prepare Event: Needs Human", "DB: Record Event + Update Lead");
  w.connect("DB: Record Event + Update Lead", "Dashboard: Realtime Event");

  /* wiring: slot booking (chat acceptance and time-button click share everything after "Slot Booking Input") */
  w.connect("Booking Input (Chat)", "Slot Booking Input");
  w.chain("Webhook: Slot Link", "Verify Slot Link", "Valid Link?");
  w.connect("Valid Link?", "Confirmed Click?", 0);
  w.connect("Valid Link?", "Page: Invalid Link", 1);
  w.connect("Confirmed Click?", "DB: Get Lead Context (Slot Link)", 0);
  w.connect("Confirmed Click?", "Page: Confirm Time", 1);
  w.chain("DB: Get Lead Context (Slot Link)", "Booking Input (Link)", "Slot Booking Input");
  w.chain("Slot Booking Input", "Google: Calendar Id (Booking)", "Google Calendar: Busy Check (Booking)", "Evaluate Slot", "Slot Still Free?");
  w.connect("Slot Still Free?", "Cal.com: Create Booking", 0);
  w.connect("Slot Still Free?", "Link Booking? (failed)", 1);
  w.chain("Cal.com: Create Booking", "Evaluate Booking", "Booked?");
  w.connect("Booked?", "Link Booking? (ok)", 0);
  w.connect("Booked?", "Let Calendar Settle", 0);
  w.connect("Let Calendar Settle", "Sync Booking To Meeting Lane");
  w.connect("Booked?", "Build Booking Confirmation", 0);
  w.connect("Booked?", "Link Booking? (failed)", 1);
  w.connect("Link Booking? (ok)", "Page: Booked", 0);
  w.connect("Build Booking Confirmation", "Can Send Confirmation?");
  w.connect("Can Send Confirmation?", "Smartlead: Send Booking Confirmation", 0);
  w.chain("Smartlead: Send Booking Confirmation", "DB: Record Booking Confirmation", "Dashboard: Booking Confirmed");
  w.connect("Link Booking? (failed)", "Page: Slot Unavailable", 0);
  w.connect("Link Booking? (failed)", "Prepare Event: Booking Failed", 1);
  w.connect("Prepare Event: Booking Failed", "DB: Record Event + Update Lead");
  for (const p of ["Page: Invalid Link", "Page: Confirm Time", "Page: Booked", "Page: Slot Unavailable"]) w.connect(p, "Respond HTML Page");

  /* ═════ Entry B: dashboard lead control ═════ */
  webhook(w, "Webhook: Lead Control (Dashboard)", [0, 5], "fenebris-lead-control");
  ifNode(w, "Authorized Control?", [1, 5], "={{ !!$env.DASHBOARD_WEBHOOK_SECRET && $json.headers['x-fenebris-secret'] === $env.DASHBOARD_WEBHOOK_SECRET }}");
  respond(w, "Respond OK", [2, 4.4], 200, '{"ok": true}');
  respond(w, "Respond 401", [2, 5.8], 401, '{"error": "unauthorized"}');
  switchNode(w, "Route Control Action", [3, 4.4], "={{ $json.body.action }}", [
    ["pause", "pause"],
    ["resume", "resume"],
    ["push_to_booking", "push_to_booking"],
  ]);

  http(w, "Smartlead: Lookup Lead To Pause", [4, 3.4], {
    method: "GET",
    url: smartleadUrl("/leads/"),
    query: { email: "={{ $json.body.email }}" },
    timeout: 20000,
  });
  code(
    w,
    "Pick Lead Id (pause)",
    [5, 3.4],
    String.raw`
const j = $input.first().json || {};
const id = j.id || (j.lead && j.lead.id) || (Array.isArray(j) ? (j[0] && j[0].id) : null);
const body = $('Webhook: Lead Control (Dashboard)').first().json.body || {};
const cd = Array.isArray(j.lead_campaign_data) ? j.lead_campaign_data : [];
const campaignId = body.campaignId || (cd[0] && cd[0].campaign_id) || null;
return id && campaignId ? [{ json: { id, campaignId } }] : [];
`,
  );
  http(w, "Smartlead: Pause Lead", [6, 3.4], {
    method: "POST",
    url: smartleadUrl("/campaigns/{{ $json.campaignId }}/leads/{{ $json.id }}/pause"),
    timeout: 20000,
  });
  http(w, "Smartlead: Lookup Lead To Resume", [4, 4.6], {
    method: "GET",
    url: smartleadUrl("/leads/"),
    query: { email: "={{ $json.body.email }}" },
    timeout: 20000,
  });
  code(
    w,
    "Pick Lead Id (resume)",
    [5, 4.6],
    String.raw`
const j = $input.first().json || {};
const id = j.id || (j.lead && j.lead.id) || (Array.isArray(j) ? (j[0] && j[0].id) : null);
const body = $('Webhook: Lead Control (Dashboard)').first().json.body || {};
const cd = Array.isArray(j.lead_campaign_data) ? j.lead_campaign_data : [];
const campaignId = body.campaignId || (cd[0] && cd[0].campaign_id) || null;
return id && campaignId ? [{ json: { id, campaignId } }] : [];
`,
  );
  http(w, "Smartlead: Resume Lead", [6, 4.6], {
    method: "POST",
    url: smartleadUrl("/campaigns/{{ $json.campaignId }}/leads/{{ $json.id }}/resume"),
    timeout: 20000,
  });

  // push to booking = same AI slot+reply pipeline, with a synthetic positive intent
  postgres(w, "DB: Get Lead Context (Control)", [4, 6], LEAD_CONTEXT_SQL, "={{ [$json.body.email] }}");
  code(
    w,
    "Synthesize Booking Intent",
    [5, 6],
    String.raw`
const lead = $input.first().json;
return [{ json: { ctx: { lead, intent: 'Positive_Booking_Intent', confidence: 1, summary: 'Moved to booking stage manually from the dashboard',
  replyText: '(The BrandFly team moved this lead to the booking stage. Write a short, warm email inviting them to pick one of the times below.)',
  event: { email: lead.email, type: 'REPLY_RECEIVED', step: Math.max(1, (lead.sent_emails || []).length), externalId: lead.reply_to_id, eaccount: lead.eaccount, subject: lead.last_subject, body: '(Manually pushed to booking stage from the dashboard)' } } } }];
`,
  );

  w.connect("Webhook: Lead Control (Dashboard)", "Authorized Control?");
  w.connect("Authorized Control?", "Respond OK", 0);
  w.connect("Authorized Control?", "Respond 401", 1);
  w.connect("Respond OK", "Route Control Action");
  w.connect("Route Control Action", "Smartlead: Lookup Lead To Pause", 0);
  w.connect("Route Control Action", "Smartlead: Lookup Lead To Resume", 1);
  w.connect("Route Control Action", "DB: Get Lead Context (Control)", 2);
  w.chain("Smartlead: Lookup Lead To Pause", "Pick Lead Id (pause)", "Smartlead: Pause Lead");
  w.chain("Smartlead: Lookup Lead To Resume", "Pick Lead Id (resume)", "Smartlead: Resume Lead");
  w.chain("DB: Get Lead Context (Control)", "Synthesize Booking Intent", "Build Slots Request");

  return w;
}
