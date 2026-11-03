// Rebuilds a Smartlead campaign's emails in the client's card template with a text logo (no images), one button and the signature footer.
// Keeps each step's wording (or, with --ai, uses the AI-written {{subject_N}} / {{email_N}} fields the lead lane fills).
// A backup of the current sequences is written to deploy/.local/smartlead-backup/ before anything changes.
//
//   node scripts/smartlead-template.mjs --campaign 4238486 [--ai] [--track-off] [--dry] [--preview out-dir]
//   node scripts/smartlead-template.mjs --restore deploy/.local/smartlead-backup/<file>.json
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? null : args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true;
};
const cfg = JSON.parse(readFileSync("deploy/.local/n8n-config.json", "utf8"));
const KEY = encodeURIComponent(cfg.SMARTLEAD_API_KEY);
const BOOKING = cfg.BOOKING_LINK || "https://cal.com/brandfly-office-ax8wq8/30min";
const API = "https://server.smartlead.ai/api/v1";

async function sl(method, path, body) {
  const r = await fetch(`${API}${path}${path.includes("?") ? "&" : "?"}api_key=${KEY}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Brand per campaign: 4238487 is Expert in SEO, every other campaign is TapadiaTech. */
export function brandFor(campaignId) {
  return String(campaignId) === "4238487"
    ? { name: "Expert in SEO", site: "ExpertinSEO.com", url: "https://expertinseo.com", header: "#101A56", button: "#101A56", footer: "#101A56",
        wordmark: `<span style="color:#ffffff;">Expert in SEO</span>` }
    : { name: "Tapadia Tech", site: "TapadiaTech.com", url: "https://tapadiatech.com", header: "#D6E7FA", button: "#FF7302", footer: "#003388",
        wordmark: `<span style="color:#003388;">Tapadia</span><span style="color:#FF7302;"> Tech</span>` };
}

/** Joins the template onto one line (newlines between tags dropped, any inside text become a space). */
const oneLine = (html) => html.replace(/>\s*\r?\n\s*</g, "><").replace(/\s*\r?\n\s*/g, " ");

/**
 * The client's original card design (grey page, white card, brand header band, orange button, navy signature footer
 * with the phone number) with the logo written as styled text, not an image: Gmail blocks or breaks remote images
 * (spam folder, image-off clients, quoted replies), and a text wordmark always renders. The layout is fluid
 * (width 100%, max 600px), so it fits phones without media queries. Keep the content <td> and the button table
 * attributes as they are: innerContent() finds the written part of a step by them.
 */
export function emailHtml({ brand, content, booking = BOOKING }) {
  const font = "font-family:Arial,Helvetica,sans-serif;";
  const optOut = /no thanks/i.test(content) ? "" : `<div style="margin-top:14px;font-size:12px;color:#cbd5e1;">Not relevant? Reply &quot;no thanks&quot; and I won't email again.</div>`;
  // One line on purpose: Smartlead turns every newline in the HTML into <br>, and a <br> between table rows is pushed out
  // of the table by the mail client, which shows up as big empty gaps above and below the header.
  return oneLine(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title></title></head>
<body style="margin:0;padding:0;background:#eef2f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f5;">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background:${brand.header};padding:26px 32px;text-align:center;">
<a href="${brand.url}" style="${font}font-size:28px;line-height:1.2;font-weight:700;letter-spacing:0.3px;text-decoration:none;">${brand.wordmark}</a>
</td></tr>
<tr><td style="padding:36px 32px 12px;${font}font-size:16px;line-height:1.65;color:#1f2937;">
${content}
<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:28px auto 8px;">
<tr><td style="background:${brand.button};border-radius:8px;">
<a href="${booking}" style="display:inline-block;padding:16px 36px;${font}font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">Book a free consultation</a>
</td></tr>
</table>
</td></tr>
<tr><td style="background:${brand.footer};padding:28px 32px;text-align:center;${font}color:#e5e7eb;">
<div style="font-size:18px;font-weight:700;color:#ffffff;">Jay T</div>
<div style="margin-top:8px;font-size:15px;"><a href="${brand.url}" style="color:#dbeafe;text-decoration:none;">${brand.site}</a></div>
<div style="margin-top:6px;font-size:15px;color:#e5e7eb;">1-213-258-1582</div>
${optOut}
<div style="margin-top:16px;font-size:12px;color:#cbd5e1;">Copyright &copy; 2026 ${brand.name}</div>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`);
}

/** The written part of an existing step: between the header row and the button table of the old template. */
function innerContent(html) {
  const tdStart = html.indexOf('<td style="padding:36px 32px 12px;');
  const end = html.indexOf('<table role="presentation" cellpadding="0" cellspacing="0" align="center"');
  if (tdStart >= 0 && end > tdStart) return html.slice(html.indexOf(">", tdStart) + 1, end).trim();
  // Already in the new template: the content sits before the button table.
  const s2 = html.indexOf("color:#1f2937;\">");
  const e2 = html.indexOf('<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 4px;">');
  if (s2 >= 0 && e2 > s2) return html.slice(s2 + 'color:#1f2937;">'.length, e2).trim();
  // Edited in Smartlead's own editor (styles rewritten): from the first paragraph to the table that holds the booking button.
  const linkAt = html.indexOf("cal.com/");
  const p1 = html.search(/<p[\s>]/i);
  const btn = linkAt > 0 ? html.lastIndexOf("<table", linkAt) : -1;
  if (p1 >= 0 && btn > p1) return html.slice(p1, btn).replace(/<\/td>\s*<\/tr>\s*<\/tbody>\s*$/i, "").trim();
  throw new Error("Unknown template shape; nothing changed");
}

const delayOf = (step) => Number(step.seq_delay_details?.delayInDays ?? step.seq_delay_details?.delay_in_days ?? 0);

async function rebuild(campaignId) {
  const brand = brandFor(campaignId);
  const ai = !!arg("ai");
  const steps = await sl("GET", `/campaigns/${campaignId}/sequences`);
  const dir = join("deploy", ".local", "smartlead-backup");
  mkdirSync(dir, { recursive: true });
  const backup = join(dir, `${campaignId}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(backup, JSON.stringify({ campaignId, steps }, null, 2));
  console.log(`backup ${backup}`);

  const wrap = (n, subject, body) => ({
    subject: ai ? `{{subject_${n}}}` : subject,
    email_body: emailHtml({ brand, content: ai ? `{{email_${n}}}` : innerContent(body).replace(/<p\b[^>]*>/gi, '<p style="margin:0 0 16px;">') }),
  });
  const sequences = steps.map((s) => {
    const variants = (s.sequence_variants || []).filter((v) => !v.is_deleted);
    const base = { id: s.id, seq_number: s.seq_number, seq_delay_details: { delay_in_days: delayOf(s) } };
    if (variants.length && !ai) {
      return { ...base, seq_variants: variants.map((v) => ({ id: v.id, variant_label: v.variant_label, ...wrap(s.seq_number, v.subject, v.email_body) })) };
    }
    const src = variants[0] || s;
    return { ...base, ...wrap(s.seq_number, s.subject || src.subject, s.email_body || src.email_body) };
  });

  const preview = arg("preview");
  if (preview) {
    mkdirSync(preview, { recursive: true });
    sequences.forEach((s) => (s.seq_variants || [s]).forEach((v, i) => writeFileSync(join(preview, `${campaignId}-step${s.seq_number}${s.seq_variants ? "-" + (v.variant_label || i) : ""}.html`), v.email_body)));
    console.log(`preview files in ${preview}`);
  }
  if (arg("dry")) return console.log("dry run: nothing sent to Smartlead");
  await sl("POST", `/campaigns/${campaignId}/sequences`, { sequences });
  console.log(`campaign ${campaignId}: ${sequences.length} steps rebuilt (${ai ? "AI emails" : "same wording"}, ${brand.name})`);
  if (arg("track-off")) {
    const c = await sl("GET", `/campaigns/${campaignId}`);
    await sl("POST", `/campaigns/${campaignId}/settings`, {
      track_settings: ["DONT_TRACK_EMAIL_OPEN", "DONT_TRACK_LINK_CLICK"],
      stop_lead_settings: c.stop_lead_settings || "REPLY_TO_AN_EMAIL",
      send_as_plain_text: false,
      follow_up_percentage: c.follow_up_percentage ?? 100,
      enable_ai_esp_matching: c.enable_ai_esp_matching ?? false,
    });
    console.log(`campaign ${campaignId}: open and click tracking off`);
  }
}

async function restore(file) {
  const { campaignId, steps } = JSON.parse(readFileSync(file, "utf8"));
  const sequences = steps.map((s) => {
    const variants = (s.sequence_variants || []).filter((v) => !v.is_deleted);
    const base = { id: s.id, seq_number: s.seq_number, seq_delay_details: { delay_in_days: delayOf(s) } };
    return variants.length
      ? { ...base, seq_variants: variants.map((v) => ({ id: v.id, variant_label: v.variant_label, subject: v.subject, email_body: v.email_body })) }
      : { ...base, subject: s.subject, email_body: s.email_body };
  });
  await sl("POST", `/campaigns/${campaignId}/sequences`, { sequences });
  console.log(`campaign ${campaignId} restored from ${file}`);
}

if (arg("restore")) await restore(arg("restore"));
else if (arg("campaign")) await rebuild(arg("campaign"));
else console.log("usage: --campaign <id> [--ai] [--track-off] [--dry] [--preview dir]  |  --restore <backup.json>");
