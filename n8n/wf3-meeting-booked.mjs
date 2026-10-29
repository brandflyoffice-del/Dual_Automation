import { Workflow, webhook, respond, ifNode, http, code, postgres, sticky, dashboardNotify, smartleadUrl, uid, googleCalendarIdNode, calExpr } from "./lib.mjs";

export const SHEET_TAB = "Scheduled Meetings";
export const SHEET_COLUMNS = [
  "Meeting Date & Time (Local & IST)",
  "Prospect Name",
  "Role",
  "Company",
  "Country",
  "Industry",
  "Detected Pain Point",
  "Pitch Service",
  "Est. Ticket ($1k+)",
  "Google Meet Link",
  "Email / LinkedIn",
  "Call Status",
  "Closer Notes",
  "Booking ID",
];

const CAL = calExpr("Google: Calendar Id (Meetings)");
const GCRED = { googleCalendarOAuth2Api: { id: "y5FL0LJTf7OK7BZo", name: "Google Calendar account" } };
const SCRED = { googleSheetsOAuth2Api: { id: "dXHwZhsv0bI9TBiw", name: "Google Sheets account" } };

const sheetSchema = SHEET_COLUMNS.map((id) => ({
  id,
  displayName: id,
  required: false,
  defaultMatch: id === "Booking ID",
  display: true,
  type: "string",
  canBeUsedToMatch: true,
}));

const sheetDoc = {
  documentId: { __rl: true, mode: "id", value: "={{ $env.GOOGLE_SHEET_ID }}" },
  sheetName: { __rl: true, mode: "name", value: SHEET_TAB },
};

const UPSERT_MEETING_SQL = `WITH r AS (SELECT $1::jsonb AS d),
lead AS (SELECT l.id FROM leads l, r WHERE l.email = lower(r.d->>'email')),
upd AS (
  UPDATE meetings m SET
    cal_booking_uid = r.d->>'uid',
    start_time = (r.d->>'startTime')::timestamptz,
    end_time = (r.d->>'endTime')::timestamptz,
    prospect_timezone = coalesce(r.d->>'timezone', m.prospect_timezone),
    meet_link = coalesce(r.d->>'meetLink', m.meet_link),
    calendar_event_id = coalesce(r.d->>'calendarEventId', m.calendar_event_id),
    calendar_event_url = coalesce(r.d->>'calendarEventUrl', m.calendar_event_url),
    status = r.d->>'status',
    estimated_ticket = (r.d->>'estimatedTicket')::int,
    updated_at = now()
  FROM r
  WHERE m.cal_booking_uid IN (r.d->>'uid', coalesce(r.d->>'previousUid', ''))
  RETURNING m.id
),
ins AS (
  INSERT INTO meetings (lead_id, cal_booking_uid, start_time, end_time, prospect_timezone, meet_link, calendar_event_id,
    calendar_event_url, status, estimated_ticket, updated_at)
  SELECT lead.id, r.d->>'uid', (r.d->>'startTime')::timestamptz, (r.d->>'endTime')::timestamptz, coalesce(r.d->>'timezone', 'UTC'),
    r.d->>'meetLink', r.d->>'calendarEventId', r.d->>'calendarEventUrl', r.d->>'status', (r.d->>'estimatedTicket')::int, now()
  FROM lead, r
  WHERE NOT EXISTS (SELECT 1 FROM upd)
  RETURNING id
),
lead_upd AS (
  UPDATE leads l SET
    stage = CASE WHEN r.d->>'status' = 'CANCELLED' THEN (CASE WHEN l.stage = 'BOOKED' THEN 'REPLIED' ELSE l.stage END) ELSE 'BOOKED' END,
    sequence_paused = CASE WHEN r.d->>'status' = 'CANCELLED' THEN l.sequence_paused ELSE true END,
    updated_at = now()
  FROM lead, r
  WHERE l.id = lead.id
  RETURNING l.id
)
SELECT coalesce((SELECT id FROM upd LIMIT 1), (SELECT id FROM ins LIMIT 1)) AS meeting_id,
       (SELECT count(*) FROM lead) AS lead_matched;`;

const LOOKUP_SQL = `SELECT l.id, l.email, l.first_name, l.last_name, l.campaign_id, l.role, l.linkedin_url, l.company_name, l.company_website, l.country, l.region,
  l.industry, l.annual_revenue, l.pain_point, l.pain_point_detail, l.recommended_service, l.estimated_ticket, l.qualification_score,
  l.audit_findings, l.dossier,
  (SELECT coalesce(jsonb_agg(jsonb_build_object('step', e.step, 'type', e.type, 'subject', e.subject, 'body', e.body, 'at', e.occurred_at)
     ORDER BY e.occurred_at), '[]'::jsonb)
   FROM email_events e WHERE e.lead_id = l.id AND e.type IN ('EMAIL_SENT', 'REPLY_RECEIVED', 'AI_REPLY_SENT')) AS thread,
  (SELECT m.calendar_event_id FROM meetings m WHERE m.cal_booking_uid IN ($2, $3) LIMIT 1) AS existing_event_id
FROM leads l WHERE l.email = lower($1) LIMIT 1;`;

export function buildWorkflow3() {
  const w = new Workflow("Fenebris_03_Meeting_Booked_Calendar_And_Sheet_Sync");

  sticky(
    w,
    "## Fenebris_03 — Meeting Booked → Calendar + Sheet + DB  (END GOAL)\nCal.com webhook (`BOOKING_CREATED`, `BOOKING_RESCHEDULED`, `BOOKING_CANCELLED`) → Postgres lookup (enrichment, pain points, $1k+ ticket) → Google Calendar event titled `[Fenebris Discovery] Company (Prospect - Role) - Est. $X+` with the AI meeting dossier → Google Sheet **Fenebris Master Scheduled Meetings** row → `meetings` table → dashboard.\n\nSecurity: register the Cal.com webhook URL as `.../webhook/fenebris-cal-booking?token=<CAL_WEBHOOK_TOKEN>` (HMAC signature is also accepted when the n8n runner allows `crypto`).\n\nSecond entry: dashboard `fenebris-meeting-update` webhook (outcome / scratchpad → Sheet row).",
    [0, -2],
    [820, 250],
  );

  /* ═════ Entry A: Cal.com webhook ═════ */
  w.add(
    "Webhook: Cal.com Booking",
    "n8n-nodes-base.webhook",
    2,
    [0, 0],
    { httpMethod: "POST", path: "fenebris-cal-booking", responseMode: "responseNode", options: { rawBody: true } },
    { webhookId: uid() },
  );
  code(
    w,
    "Verify Cal.com Signature",
    [1, 0],
    String.raw`
// Secure by default: no secret configured => reject everything.
// Accepted proofs (either one):
//  1) ?token=<CAL_WEBHOOK_TOKEN> on the webhook URL (works everywhere, no extra n8n config)
//  2) Cal.com HMAC-SHA256 signature of the raw body (header x-cal-signature-256) - used only if the
//     n8n Code runner allows require('crypto') (NODE_FUNCTION_ALLOW_BUILTIN=crypto).
const item = $input.first();
const secret = $env.CAL_WEBHOOK_SECRET;
const token = $env.CAL_WEBHOOK_TOKEN;
let authorized = false;
const q = item.json.query || {};
if (token && typeof q.token === 'string' && q.token.length === token.length) {
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ q.token.charCodeAt(i);
  authorized = diff === 0;
}
if (!authorized && secret) {
  try {
    const crypto = require('crypto');
    const raw = await this.helpers.getBinaryDataBuffer(0, 'data');
    const sig = String((item.json.headers || {})['x-cal-signature-256'] || '').toLowerCase();
    const mac = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    authorized = sig.length === mac.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(mac));
  } catch (e) { authorized = false; }
}
return [{ json: { authorized, body: item.json.body } }];
`,
  );
  ifNode(w, "Authorized?", [2, 0], "={{ $json.authorized === true }}");
  respond(w, "Respond 200", [3, -0.5], 200, '{"ok": true}');
  respond(w, "Respond 401", [3, 0.7], 401, '{"error": "invalid signature"}');

  code(
    w,
    "Normalize Booking",
    [4, -0.5],
    String.raw`
const b = $('Verify Cal.com Signature').first().json.body || {};
const p = b.payload || {};
const EVENTS = { BOOKING_CREATED: 'SCHEDULED', BOOKING_RESCHEDULED: 'RESCHEDULED', BOOKING_CANCELLED: 'CANCELLED' };
const status = EVENTS[b.triggerEvent];
if (!status) return []; // other Cal.com events ignored
const att = (p.attendees && p.attendees[0]) || {};
const resp = p.responses || {};
const email = String(att.email || (resp.email && resp.email.value) || '').toLowerCase().trim();
if (!email || !p.uid || !p.startTime) return [];
const loc = typeof p.location === 'string' && /^https?:\/\//.test(p.location) ? p.location : null;
const meetLink = (p.metadata && p.metadata.videoCallUrl) || (p.videoCallData && p.videoCallData.url) || loc || null;
return [{ json: {
  event: b.triggerEvent, status, uid: p.uid, previousUid: p.rescheduleUid || p.fromReschedule || null,
  startTime: new Date(p.startTime).toISOString(), endTime: new Date(p.endTime || new Date(p.startTime).getTime() + 30 * 60000).toISOString(),
  timezone: att.timeZone || 'UTC', email, name: att.name || (resp.name && resp.name.value) || email,
  meetLink, cancellationReason: p.cancellationReason || null, iCalUID: p.iCalUID || null,
} }];
`,
  );

  postgres(
    w,
    "DB: Lookup Prospect Enrichment",
    [5, -0.5],
    LOOKUP_SQL,
    "={{ [$json.email, $json.uid, $json.previousUid || ''] }}",
    { alwaysOutput: true },
  );

  code(
    w,
    "Build Meeting Context + Dossier",
    [6, -0.5],
    String.raw`
const bk = $('Normalize Booking').first().json;
const row = $input.first().json || {};
const known = !!row.id;
const IST = 'Asia/Kolkata';
const fmt = (iso, tz) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
const money = n => Number(n || 0).toLocaleString('en-US');
const SERVICE = { WEB_ECOM: 'Web & E-commerce Development', DIGITAL_MARKETING: 'Digital Marketing Services', STAFF_AUG: 'Staff Augmentation', MANAGED_IT: 'Managed IT Services' };
const INDUSTRY = { ECOMMERCE_RETAIL: 'E-commerce & Retail', FINTECH: 'FinTech', REAL_ESTATE_LOGISTICS: 'Real Estate & Logistics', EDTECH: 'EdTech', HOSPITALITY: 'Hospitality' };

const prospect = known ? ((row.first_name || '') + ' ' + (row.last_name || '')).trim() : bk.name;
const company = known ? row.company_name : bk.email.split('@')[1];
const role = known ? row.role : 'Role unknown';
const ticket = known ? Number(row.estimated_ticket) : 1000;
const title = '[BrandFly Discovery] ' + company + ' (' + prospect + ' - ' + role + ') - Est. $' + money(ticket) + '+';
const when = fmt(bk.startTime, bk.timezone) + ' (' + bk.timezone + ')  |  ' + fmt(bk.startTime, IST) + ' IST';

const a = (row.audit_findings || {});
const d = (row.dossier || {});
const L = [];
L.push('FENEBRIS PRE-CALL DOSSIER (AI-generated)');
L.push('Prospect: ' + prospect + ', ' + role + ' @ ' + company + (known ? ' (' + (INDUSTRY[row.industry] || row.industry) + ', ' + row.country + ')' : ''));
L.push('Email: ' + bk.email + (known && row.linkedin_url ? '  |  LinkedIn: ' + row.linkedin_url : '') + (known && row.company_website ? '  |  Site: ' + row.company_website : ''));
L.push('Meeting: ' + when);
if (known) L.push('Pitch: ' + (SERVICE[row.recommended_service] || row.recommended_service) + '  |  Est. ticket: $' + money(ticket) + '+  |  Qualification score: ' + row.qualification_score + '/100');
L.push('');
if (known) {
  L.push('WHY THEY NEED US');
  L.push((d.summary || row.pain_point_detail || row.pain_point || 'n/a'));
  L.push('');
  L.push('WEBSITE / MARKETING AUDIT');
  if (a.pageSpeedMobile != null) L.push('- Mobile PageSpeed: ' + a.pageSpeedMobile + '/100, LCP ' + a.lcpSeconds + 's');
  if (a.hasMetaPixel === false) L.push('- No Meta Pixel detected');
  if (a.hasGa4 === false && a.hasGtm === false) L.push('- No GA4 / GTM detected');
  if (a.securityHeaders && !a.securityHeaders.hsts) L.push('- Missing HSTS' + (a.securityHeaders.csp ? '' : ' and CSP'));
  if (a.techStack && a.techStack.length) L.push('- Stack: ' + a.techStack.join(', '));
  (a.verifiedHooks || []).forEach(h => L.push('- ' + h.evidence));
  L.push('');
  L.push('3 DISCOVERY QUESTIONS');
  (d.discoveryQuestions || []).slice(0, 3).forEach((q, i) => L.push((i + 1) + '. ' + q));
  L.push('');
  L.push('TALKING POINTS');
  (d.talkingPoints || []).forEach(t => L.push('- ' + t));
  L.push('');
  L.push('EMAIL THREAD');
  (row.thread || []).forEach(t => {
    const who = t.type === 'REPLY_RECEIVED' ? 'PROSPECT REPLIED' : t.type === 'AI_REPLY_SENT' ? 'FENEBRIS AI REPLY' : 'EMAIL ' + (t.step || '') + ' SENT';
    L.push('[' + who + '] ' + (t.subject || ''));
    L.push(String(t.body || '').slice(0, 700));
    L.push('');
  });
} else {
  L.push('NOTE: this prospect was not found in the Fenebris lead database (booked directly via the booking link). No enrichment available.');
}
L.push('Live brief + scratchpad: ' + ($env.DASHBOARD_URL || '') + '/meetings');
const description = L.join('\n');

const linkedin = known && row.linkedin_url ? row.linkedin_url : '';
const sheetRow = {
  'Meeting Date & Time (Local & IST)': when, 'Prospect Name': prospect, 'Role': role, 'Company': company,
  'Country': known ? row.country : '', 'Industry': known ? (INDUSTRY[row.industry] || row.industry) : '',
  'Detected Pain Point': known ? (row.pain_point || '') : '', 'Pitch Service': known ? (SERVICE[row.recommended_service] || '') : '',
  'Est. Ticket ($1k+)': '$' + money(ticket) + '+', 'Google Meet Link': bk.meetLink || '',
  'Email / LinkedIn': bk.email + (linkedin ? ' | ' + linkedin : ''), 'Call Status': bk.status === 'CANCELLED' ? 'Cancelled' : bk.status === 'RESCHEDULED' ? 'Rescheduled' : 'Scheduled',
  'Closer Notes': '', 'Booking ID': bk.uid,
};
const t0 = new Date(bk.startTime).getTime();
return [{ json: { bk, known, title, description, sheetRow, ticket, company, prospect, role, campaignId: known ? row.campaign_id : null,
  existingEventId: row.existing_event_id || null,
  window: { min: new Date(t0 - 36 * 3600000).toISOString(), max: new Date(t0 + 36 * 3600000).toISOString() } } }];
`,
  );

  /* ── Google Calendar: find → update / create / delete ── */
  w.add(
    "Google Calendar: Find Existing Event",
    "n8n-nodes-base.googleCalendar",
    1.3,
    [7, -0.5],
    {
      resource: "event",
      operation: "getAll",
      calendar: CAL,
      returnAll: false,
      limit: 10,
      timeMin: "={{ $json.window.min }}",
      timeMax: "={{ $json.window.max }}",
      options: { query: "={{ $json.bk.email }}", singleEvents: true },
    },
    { credentials: GCRED, alwaysOutputData: true, executeOnce: true },
  );
  code(
    w,
    "Pick Event To Sync",
    [8, -0.5],
    String.raw`
const ctx = $('Build Meeting Context + Dossier').first().json;
const found = $input.all().map(i => i.json).filter(e => e && e.id && e.status !== 'cancelled');
// Prefer the event Cal.com created for this booking (matches iCalUID or attendee), else any event with this attendee.
// Only an event that starts at the booked time can be this booking's event. Another meeting with the same person on a nearby day must never be overwritten.
const t0 = new Date(ctx.bk.startTime).getTime();
const sameTime = e => { const s = new Date((e.start && (e.start.dateTime || e.start.date)) || 0).getTime(); return Math.abs(s - t0) <= 10 * 60000; };
const hit = found.find(e => ctx.bk.iCalUID && e.iCalUID === ctx.bk.iCalUID) || found.find(e => sameTime(e) && (e.attendees || []).some(a => String(a.email || '').toLowerCase() === ctx.bk.email)) || found.find(sameTime);
const eventId = ctx.existingEventId || (hit && hit.id) || null;
return [{ json: { ...ctx, eventId } }];
`,
  );
  ifNode(w, "Cancelled?", [9, -0.5], "={{ $json.bk.status === 'CANCELLED' }}");
  ifNode(w, "Event Exists? (cancel path)", [10, -1.4], "={{ !!$json.eventId }}");
  ifNode(w, "Event Exists? (upsert path)", [10, 0.4], "={{ !!$json.eventId }}");

  w.add(
    "Google Calendar: Delete Cancelled Event",
    "n8n-nodes-base.googleCalendar",
    1.3,
    [11, -1.9],
    { resource: "event", operation: "delete", calendar: CAL, eventId: "={{ $json.eventId }}", options: { sendUpdates: "all" } },
    { credentials: GCRED },
  );
  w.add(
    "Google Calendar: Update Event (title + dossier)",
    "n8n-nodes-base.googleCalendar",
    1.3,
    [11, -0.1],
    {
      resource: "event",
      operation: "update",
      calendar: CAL,
      eventId: "={{ $json.eventId }}",
      useDefaultReminders: true,
      updateFields: {
        summary: "={{ $json.title }}",
        description: "={{ $json.description }}",
        start: "={{ $json.bk.startTime }}",
        end: "={{ $json.bk.endTime }}",
      },
    },
    { credentials: GCRED },
  );
  w.add(
    "Google Calendar: Create Event (+ Google Meet)",
    "n8n-nodes-base.googleCalendar",
    1.3,
    [11, 1],
    {
      resource: "event",
      operation: "create",
      calendar: CAL,
      start: "={{ $json.bk.startTime }}",
      end: "={{ $json.bk.endTime }}",
      useDefaultReminders: true,
      additionalFields: {
        summary: "={{ $json.title }}",
        description: "={{ $json.description }}",
        attendees: ["={{ $json.bk.email }}"],
        conferenceDataUi: { conferenceDataValues: { conferenceSolution: "hangoutsMeet" } },
        sendUpdates: "all",
      },
    },
    { credentials: GCRED },
  );

  code(
    w,
    "Prepare Sync Payload",
    [12, -0.5],
    String.raw`
const ctx = $('Pick Event To Sync').first().json;
const ev = $input.first().json || {};
const cancelled = ctx.bk.status === 'CANCELLED';
const eventId = ev.id || ctx.eventId || null;
const meetLink = ev.hangoutLink || (ev.conferenceData && ev.conferenceData.entryPoints && (ev.conferenceData.entryPoints.find(e => e.entryPointType === 'video') || {}).uri) || ctx.bk.meetLink || null;
const row = { ...ctx.sheetRow, 'Google Meet Link': meetLink || ctx.sheetRow['Google Meet Link'] };
return [{ json: {
  sheetRow: row,
  meeting: { email: ctx.bk.email, uid: ctx.bk.uid, previousUid: ctx.bk.previousUid, status: ctx.bk.status, startTime: ctx.bk.startTime, endTime: ctx.bk.endTime,
    timezone: ctx.bk.timezone, meetLink, calendarEventId: cancelled ? null : eventId, calendarEventUrl: !cancelled && ev.htmlLink ? ev.htmlLink : null, estimatedTicket: ctx.ticket },
  unmatched: !ctx.known, company: ctx.company, prospect: ctx.prospect, cancelled,
} }];
`,
  );

  /* ── Sheets + DB + Instantly + Dashboard ── */
  w.add(
    "Google Sheets: Upsert Master Row",
    "n8n-nodes-base.googleSheets",
    4.5,
    [13, -0.5],
    {
      resource: "sheet",
      operation: "appendOrUpdate",
      ...sheetDoc,
      columns: {
        mappingMode: "defineBelow",
        value: Object.fromEntries(SHEET_COLUMNS.map((c) => [c, `={{ $json.sheetRow['${c}'] }}`])),
        matchingColumns: ["Booking ID"],
        schema: sheetSchema,
        attemptToConvertTypes: false,
        convertFieldsToString: true,
      },
      options: {},
    },
    // A Sheets failure (API disabled, bad tab) must not stop the dashboard row or the Smartlead pause.
    { credentials: SCRED, onError: "continueRegularOutput" },
  );
  postgres(
    w,
    "DB: Upsert Meeting",
    [14, -0.5],
    UPSERT_MEETING_SQL,
    "={{ [JSON.stringify($('Prepare Sync Payload').first().json.meeting)] }}",
    { alwaysOutput: true },
  );
  http(w, "Smartlead: Lookup Booked Lead", [15, -1.2], {
    method: "GET",
    url: smartleadUrl("/leads/"),
    query: { email: "={{ $('Prepare Sync Payload').first().json.meeting.email }}" },
    timeout: 20000,
  });
  code(
    w,
    "Pick Booked Lead Id",
    [16, -1.2],
    String.raw`
const cancelled = $('Prepare Sync Payload').first().json.cancelled;
const j = $input.first().json || {};
const id = j.id || (j.lead && j.lead.id);
const cd = Array.isArray(j.lead_campaign_data) ? j.lead_campaign_data : [];
const campaignId = (cd[0] && cd[0].campaign_id) || $('Build Meeting Context + Dossier').first().json.campaignId || null;
if (cancelled || !id || !campaignId) return [];
return [{ json: { id, campaignId } }];
`,
  );
  http(w, "Smartlead: Pause Booked Lead", [17, -1.2], {
    method: "POST",
    url: smartleadUrl("/campaigns/{{ $json.campaignId }}/leads/{{ $json.id }}/pause"),
    timeout: 20000,
  });
  dashboardNotify(
    w,
    "Dashboard: Meeting Synced",
    [15, 0.2],
    "={{ JSON.stringify({ event: 'meeting_synced', ingest: false, data: { leadEmail: $('Prepare Sync Payload').first().json.meeting.email, status: $('Prepare Sync Payload').first().json.meeting.status, previousUid: $('Prepare Sync Payload').first().json.meeting.previousUid, unmatched: $('Prepare Sync Payload').first().json.unmatched, company: $('Prepare Sync Payload').first().json.company } }) }}",
  );

  /* wiring A */
  w.connect("Webhook: Cal.com Booking", "Verify Cal.com Signature");
  w.connect("Verify Cal.com Signature", "Authorized?");
  w.connect("Authorized?", "Respond 200", 0);
  w.connect("Authorized?", "Respond 401", 1);
  googleCalendarIdNode(w, "Google: Calendar Id (Meetings)", [3.5, -0.5]);
  w.chain(
    "Respond 200",
    "Google: Calendar Id (Meetings)",
    "Normalize Booking",
    "DB: Lookup Prospect Enrichment",
    "Build Meeting Context + Dossier",
    "Google Calendar: Find Existing Event",
    "Pick Event To Sync",
    "Cancelled?",
  );
  w.connect("Cancelled?", "Event Exists? (cancel path)", 0);
  w.connect("Cancelled?", "Event Exists? (upsert path)", 1);
  w.connect("Event Exists? (cancel path)", "Google Calendar: Delete Cancelled Event", 0);
  w.connect("Event Exists? (cancel path)", "Prepare Sync Payload", 1);
  w.connect("Event Exists? (upsert path)", "Google Calendar: Update Event (title + dossier)", 0);
  w.connect("Event Exists? (upsert path)", "Google Calendar: Create Event (+ Google Meet)", 1);
  w.connect("Google Calendar: Delete Cancelled Event", "Prepare Sync Payload");
  w.connect("Google Calendar: Update Event (title + dossier)", "Prepare Sync Payload");
  w.connect("Google Calendar: Create Event (+ Google Meet)", "Prepare Sync Payload");
  w.chain("Prepare Sync Payload", "Google Sheets: Upsert Master Row", "DB: Upsert Meeting");
  w.connect("DB: Upsert Meeting", "Smartlead: Lookup Booked Lead");
  w.connect("Smartlead: Lookup Booked Lead", "Pick Booked Lead Id");
  w.connect("Pick Booked Lead Id", "Smartlead: Pause Booked Lead");
  w.connect("DB: Upsert Meeting", "Dashboard: Meeting Synced");

  /* ═════ Entry B: dashboard outcome + notes → sheet ═════ */
  webhook(w, "Webhook: Meeting Update (Dashboard)", [0, 4], "fenebris-meeting-update");
  ifNode(w, "Authorized Dashboard Call?", [1, 4], "={{ !!$env.DASHBOARD_WEBHOOK_SECRET && $json.headers['x-fenebris-secret'] === $env.DASHBOARD_WEBHOOK_SECRET }}");
  respond(w, "Respond OK", [2, 3.5], 200, '{"ok": true}');
  respond(w, "Respond 401 (dashboard)", [2, 4.7], 401, '{"error": "unauthorized"}');
  w.add(
    "Google Sheets: Update Status + Closer Notes",
    "n8n-nodes-base.googleSheets",
    4.5,
    [3, 3.5],
    {
      resource: "sheet",
      operation: "update",
      ...sheetDoc,
      columns: {
        mappingMode: "defineBelow",
        value: {
          "Booking ID": "={{ $json.body.bookingId }}",
          "Call Status": "={{ $json.body.callStatus }}",
          "Closer Notes": "={{ $json.body.closerNotes }}",
        },
        matchingColumns: ["Booking ID"],
        schema: sheetSchema,
        attemptToConvertTypes: false,
        convertFieldsToString: true,
      },
      options: {},
    },
    { credentials: SCRED },
  );
  w.connect("Webhook: Meeting Update (Dashboard)", "Authorized Dashboard Call?");
  w.connect("Authorized Dashboard Call?", "Respond OK", 0);
  w.connect("Authorized Dashboard Call?", "Respond 401 (dashboard)", 1);
  w.connect("Respond OK", "Google Sheets: Update Status + Closer Notes");

  return w;
}
