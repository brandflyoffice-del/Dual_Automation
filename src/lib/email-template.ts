// The Smartlead email card template (grey page, white card, coloured header with a text logo, one button, signature
// footer), shared by the Email Templates page (live preview) and /api/smartlead/templates (what is saved to Smartlead).
// Same design as scripts/smartlead-template.mjs; keep the two in step. Pure functions, safe in the browser.

export type TemplateDesign = {
  logoText1: string;
  logoColor1: string;
  logoText2: string; // optional second word in another colour ("Tapadia" + "Tech")
  logoColor2: string;
  headerBg: string;
  buttonText: string;
  buttonBg: string;
  bookingLink: string;
  footerBg: string;
  senderName: string;
  websiteText: string;
  websiteUrl: string;
  phone: string; // footer line only, never a call CTA
  copyrightName: string;
};

/** One email of a step: step 1 may have A/B versions, the others have one. `text` is the editable plain-text body. */
export type TemplateVariant = { id: number | null; label: string | null; subject: string; text: string };
/** id null = a follow-up added on the Email Templates page, not in Smartlead yet (Smartlead creates it on save). */
export type TemplateStep = { id: number | null; seqNumber: number; delayDays: number; variants: TemplateVariant[] };

/** Most emails one sequence may have on the Email Templates page. */
export const MAX_STEPS = 10;

export const HEX = /^#[0-9a-f]{6}$/i;

export const BLANK_DESIGN: TemplateDesign = {
  logoText1: "",
  logoColor1: "#003388",
  logoText2: "",
  logoColor2: "#FF7302",
  headerBg: "#D6E7FA",
  buttonText: "Book a free consultation",
  buttonBg: "#FF7302",
  bookingLink: "",
  footerBg: "#003388",
  senderName: "",
  websiteText: "",
  websiteUrl: "",
  phone: "",
  copyrightName: "",
};

/** Fields people can drop into a subject or body; Smartlead fills them per lead. */
export const MERGE_TAGS: { tag: string; label: string; sample: string }[] = [
  { tag: "{{first_name}}", label: "First name", sample: "Sarah" },
  { tag: "{{last_name}}", label: "Last name", sample: "Miller" },
  { tag: "{{company_name}}", label: "Company", sample: "Acme Home Goods" },
  { tag: "{{website}}", label: "Website", sample: "acmehomegoods.com" },
];

// Text keeps its quotes as typed (the live emails do); attributes escape them too.
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const unesc = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&copy;/g, "©")
    .replace(/&amp;/g, "&");
const attr = (s: string) => esc(s.trim()).replace(/"/g, "&quot;");
const color = (c: string, fallback: string) => (HEX.test(c) ? c : fallback);

/**
 * Plain text → the email's paragraphs. A blank line starts a new paragraph; a block whose lines all start with "- " is a
 * bullet list; a single line break stays a line break. Merge tags ({{first_name}}) pass through untouched.
 */
export function textToHtml(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n").map((l) => l.trim());
      if (lines.every((l) => /^[-•*]\s+/.test(l))) {
        const items = lines.map((l) => `<li style="margin:0 0 8px;">${esc(l.replace(/^[-•*]\s+/, ""))}</li>`).join("");
        return `<ul style="margin:0 0 16px;padding-left:20px;">${items}</ul>`;
      }
      return `<p style="margin:0 0 16px;">${lines.map(esc).join("<br>")}</p>`;
    })
    .join("");
}

/** The email's paragraphs → plain text for the editor (inverse of textToHtml; other tags are dropped, their text kept). */
export function htmlToText(html: string): string {
  const blocks: string[] = [];
  const re = /<(p|ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  let last = 0;
  const plain = (s: string) => unesc(s.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")).replace(/[ \t]+\n/g, "\n").trim();
  while ((m = re.exec(html))) {
    const between = plain(html.slice(last, m.index));
    if (between) blocks.push(between);
    if (m[1].toLowerCase() === "p") blocks.push(plain(m[2]));
    else blocks.push([...m[2].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((li) => "- " + plain(li[1])).join("\n"));
    last = re.lastIndex;
  }
  const tail = plain(html.slice(last));
  if (tail) blocks.push(tail);
  return blocks.filter(Boolean).join("\n\n");
}

/** Joins the template onto one line: Smartlead turns every newline in the HTML into <br>, which breaks the table layout. */
const oneLine = (html: string) => html.replace(/>\s*\n\s*</g, "><").replace(/\s*\n\s*/g, " ");

/** The full email HTML for one step. `contentHtml` comes from textToHtml. */
export function buildEmailHtml(d: TemplateDesign, contentHtml: string): string {
  const font = "font-family:Arial,Helvetica,sans-serif;";
  const logo =
    `<span style="color:${color(d.logoColor1, "#003388")};">${esc(d.logoText1.trim())}</span>` +
    (d.logoText2.trim() ? `<span style="color:${color(d.logoColor2, "#FF7302")};"> ${esc(d.logoText2.trim())}</span>` : "");
  const logoHref = d.websiteUrl.trim() || d.bookingLink.trim();
  const optOut = /no thanks/i.test(contentHtml) ? "" : `<div style="margin-top:14px;font-size:12px;color:#cbd5e1;">Not relevant? Reply &quot;no thanks&quot; and I won't email again.</div>`;
  return oneLine(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title></title></head>
<body style="margin:0;padding:0;background:#eef2f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f5;">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background:${color(d.headerBg, "#D6E7FA")};padding:26px 32px;text-align:center;">
<a href="${attr(logoHref)}" style="${font}font-size:28px;line-height:1.2;font-weight:700;letter-spacing:0.3px;text-decoration:none;">${logo}</a>
</td></tr>
<tr><td style="padding:36px 32px 12px;${font}font-size:16px;line-height:1.65;color:#1f2937;">
${contentHtml}
<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:28px auto 8px;">
<tr><td style="background:${color(d.buttonBg, "#FF7302")};border-radius:8px;">
<a href="${attr(d.bookingLink)}" style="display:inline-block;padding:16px 36px;${font}font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">${esc(d.buttonText.trim() || "Book a free consultation")}</a>
</td></tr>
</table>
</td></tr>
<tr><td style="background:${color(d.footerBg, "#003388")};padding:28px 32px;text-align:center;${font}color:#e5e7eb;">
${d.senderName.trim() ? `<div style="font-size:18px;font-weight:700;color:#ffffff;">${esc(d.senderName.trim())}</div>` : ""}
${d.websiteText.trim() ? `<div style="margin-top:8px;font-size:15px;"><a href="${attr(d.websiteUrl)}" style="color:#dbeafe;text-decoration:none;">${esc(d.websiteText.trim())}</a></div>` : ""}
${d.phone.trim() ? `<div style="margin-top:6px;font-size:15px;color:#e5e7eb;">${esc(d.phone.trim())}</div>` : ""}
${optOut}
${d.copyrightName.trim() ? `<div style="margin-top:16px;font-size:12px;color:#cbd5e1;">Copyright &copy; ${new Date().getFullYear()} ${esc(d.copyrightName.trim())}</div>` : ""}
</td></tr>
</table>
</td></tr>
</table>
</body></html>`);
}

/**
 * Reads an email written by buildEmailHtml (or the older script) back into design + body text.
 * Returns null when the HTML is not this design (e.g. edited in Smartlead's own editor); the caller then keeps only the text.
 */
export function parseEmailHtml(html: string): { design: TemplateDesign; text: string } | null {
  const g = (re: RegExp) => (html.match(re)?.[1] ?? "").trim();
  const header = html.match(/<td style="background:(#[0-9a-f]{6});padding:26px 32px;text-align:center;"><a href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
  const contentStart = html.search(/color:#1f2937;">/i);
  const contentEnd = html.indexOf('<table role="presentation" cellpadding="0" cellspacing="0" align="center"');
  if (!header || contentStart < 0 || contentEnd < contentStart) return null;
  const spans = [...header[3].matchAll(/<span style="color:(#[0-9a-f]{6});">([^<]*)<\/span>/gi)];
  const button = html.match(/<td style="background:(#[0-9a-f]{6});border-radius:8px;"><a href="([^"]*)"[^>]*>([^<]*)<\/a>/i);
  const site = html.match(/<a href="([^"]*)" style="color:#dbeafe;text-decoration:none;">([^<]*)<\/a>/i);
  const design: TemplateDesign = {
    logoText1: unesc(spans[0]?.[2] ?? "").trim(),
    logoColor1: spans[0]?.[1] ?? BLANK_DESIGN.logoColor1,
    logoText2: unesc(spans[1]?.[2] ?? "").trim(),
    logoColor2: spans[1]?.[1] ?? BLANK_DESIGN.logoColor2,
    headerBg: header[1],
    buttonText: unesc(button?.[3] ?? BLANK_DESIGN.buttonText).trim(),
    buttonBg: button?.[1] ?? BLANK_DESIGN.buttonBg,
    bookingLink: unesc(button?.[2] ?? ""),
    footerBg: g(/<td style="background:(#[0-9a-f]{6});padding:28px 32px;text-align:center;/i) || BLANK_DESIGN.footerBg,
    senderName: unesc(g(/<div style="font-size:18px;font-weight:700;color:#ffffff;">([^<]*)<\/div>/i)),
    websiteText: unesc(site?.[2] ?? ""),
    websiteUrl: unesc(site?.[1] ?? header[2] ?? ""),
    phone: unesc(g(/<div style="margin-top:6px;font-size:15px;color:#e5e7eb;">([^<]*)<\/div>/i)),
    copyrightName: unesc(g(/Copyright &copy; \d{4} ([^<]*)<\/div>/i)),
  };
  const content = html.slice(html.indexOf(">", contentStart) + 1, contentEnd);
  return { design, text: htmlToText(content) };
}

/** Any HTML body → editable text, for emails that are not in this design. */
export function looseText(html: string): string {
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  return htmlToText(body.replace(/<(style|script)[\s\S]*?<\/\1>/gi, ""));
}

/** Preview helper: fills merge tags with sample values. */
export function withSamples(s: string): string {
  return MERGE_TAGS.reduce((acc, t) => acc.split(t.tag).join(t.sample), s);
}
