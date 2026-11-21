import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { config } from "@/lib/config";
import { getSequences, listCampaigns, saveSequences, smartleadConfigured, type SlSequenceStep } from "@/lib/smartlead";
import { BLANK_DESIGN, HEX, MAX_STEPS, buildEmailHtml, looseText, parseEmailHtml, textToHtml, type TemplateDesign, type TemplateStep } from "@/lib/email-template";

export const dynamic = "force-dynamic";

// Email Templates page: reads a campaign's emails from Smartlead as design + plain text, and writes them back in the
// card template. Every save first keeps a copy of what Smartlead had (last 5 per campaign, app_settings
// "template_backup:<id>"), so "Undo last save" can put it back exactly.

const ID = /^\d{4,12}$/;
const delayOf = (s: SlSequenceStep) => Number(s.seq_delay_details?.delayInDays ?? s.seq_delay_details?.delay_in_days ?? 0);
const liveVariants = (s: SlSequenceStep) => (s.sequence_variants || []).filter((v) => !v.is_deleted);
const backupKey = (id: string) => `template_backup:${id}`;
type Backup = { at: string; steps: SlSequenceStep[] };

async function backups(id: string): Promise<Backup[]> {
  const row = await db.appSetting.findUnique({ where: { key: backupKey(id) } }).catch(() => null);
  const items = (row?.value as { items?: Backup[] } | undefined)?.items;
  return Array.isArray(items) ? items : [];
}
async function writeBackups(id: string, items: Backup[]) {
  const value = { items: items.slice(0, 5) } as unknown as Prisma.InputJsonValue;
  await db.appSetting.upsert({ where: { key: backupKey(id) }, create: { key: backupKey(id), value }, update: { value } });
}

/** Smartlead steps → what the editor shows. */
function toEditor(steps: SlSequenceStep[]) {
  let design: TemplateDesign | null = null;
  const warnings: string[] = [];
  const out: TemplateStep[] = steps.map((s) => {
    const vs = liveVariants(s);
    const src = vs.length
      ? vs.map((v) => ({ id: v.id, label: v.variant_label, subject: v.subject, html: v.email_body }))
      : [{ id: null, label: null, subject: s.subject, html: s.email_body }];
    return {
      id: s.id,
      seqNumber: s.seq_number,
      delayDays: delayOf(s),
      variants: src.map((v) => {
        const parsed = parseEmailHtml(v.html || "");
        if (parsed) design ??= parsed.design;
        else warnings.push(`Email ${s.seq_number}${v.label ? ` (version ${v.label})` : ""} is not in the card design yet; saving puts it in the design with the same text.`);
        return { id: v.id, label: v.label, subject: v.subject || "", text: parsed ? parsed.text : looseText(v.html || "") };
      }),
    };
  });
  return { design: design ?? { ...BLANK_DESIGN, bookingLink: config.bookingLink }, steps: out, warnings };
}

/** Same shape the old script and Smartlead accept: step ids kept, A/B versions as seq_variants. */
function restorePayload(steps: SlSequenceStep[]) {
  return steps.map((s) => {
    const vs = liveVariants(s);
    const base = { id: s.id, seq_number: s.seq_number, seq_delay_details: { delay_in_days: delayOf(s) } };
    return vs.length
      ? { ...base, seq_variants: vs.map((v) => ({ id: v.id, variant_label: v.variant_label, subject: v.subject, email_body: v.email_body })) }
      : { ...base, subject: s.subject, email_body: s.email_body };
  });
}

export async function GET(req: Request) {
  if (!(await smartleadConfigured())) return NextResponse.json({ error: "Smartlead is not connected" }, { status: 503 });
  const id = new URL(req.url).searchParams.get("campaignId");
  try {
    if (!id) {
      const campaigns = await listCampaigns();
      return NextResponse.json({ campaigns: campaigns.map((c) => ({ id: c.id, name: c.name, status: c.status })) });
    }
    if (!ID.test(id)) return NextResponse.json({ error: "Pick a campaign" }, { status: 400 });
    const [steps, saved] = await Promise.all([getSequences(id), backups(id)]);
    return NextResponse.json({ campaignId: id, ...toEditor(steps), lastBackupAt: saved[0]?.at ?? null });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

const color = z.string().regex(HEX, "Colours look like #FF7302");
const url = z.union([z.literal(""), z.string().trim().url().max(300)]);
const design = z.object({
  logoText1: z.string().trim().min(1, "Logo text is empty").max(40),
  logoColor1: color,
  logoText2: z.string().trim().max(40),
  logoColor2: color,
  headerBg: color,
  buttonText: z.string().trim().min(2, "Button text is empty").max(40),
  buttonBg: color,
  bookingLink: z.string().trim().url("The booking link must be a full https:// link").max(300),
  footerBg: color,
  senderName: z.string().trim().max(60),
  websiteText: z.string().trim().max(60),
  websiteUrl: url,
  phone: z.string().trim().max(40),
  copyrightName: z.string().trim().max(60),
});
const variant = z.object({
  id: z.number().int().nullable(),
  label: z.string().max(10).nullable(),
  subject: z.string().trim().min(1, "Every email needs a subject").max(200),
  text: z.string().trim().min(1, "An email body is empty").max(8000),
});
const putBody = z.object({
  campaignId: z.string().regex(ID),
  design,
  steps: z
    .array(z.object({ id: z.number().int().nullable(), seqNumber: z.number().int().min(1), delayDays: z.number().int().min(0).max(60), variants: z.array(variant).min(1).max(5) }))
    .min(1, "Keep at least one email")
    .max(MAX_STEPS, `At most ${MAX_STEPS} emails`),
});

export async function PUT(req: Request) {
  if (!(await smartleadConfigured())) return NextResponse.json({ error: "Smartlead is not connected" }, { status: 503 });
  const parsed = putBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the fields" }, { status: 400 });
  const { campaignId, design: d, steps } = parsed.data;
  try {
    const current = await getSequences(campaignId);
    // Steps with an id must still exist in Smartlead; id null = a new follow-up (Smartlead creates it). Steps left out of
    // the list are deleted by Smartlead. Order on the page = order sent, so seq_number is renumbered 1..n.
    if (new Set(steps.filter((s) => s.id !== null).map((s) => s.id)).size !== steps.filter((s) => s.id !== null).length)
      return NextResponse.json({ error: "The same email appears twice. Reload and try again." }, { status: 400 });
    for (const s of steps) {
      if (s.id === null) continue;
      const cur = current.find((c) => c.id === s.id);
      if (!cur) return NextResponse.json({ error: `Email ${s.seqNumber} changed in Smartlead since this page loaded. Reload and try again.` }, { status: 409 });
      const ids = new Set(liveVariants(cur).map((v) => v.id));
      if (s.variants.some((v) => v.id !== null && !ids.has(v.id))) return NextResponse.json({ error: "The A/B versions changed in Smartlead. Reload and try again." }, { status: 409 });
    }
    const sequences = steps.map((s, k) => {
      const base = { ...(s.id !== null ? { id: s.id } : {}), seq_number: k + 1, seq_delay_details: { delay_in_days: k === 0 ? 0 : s.delayDays } };
      const mk = (v: (typeof s.variants)[number]) => ({ subject: v.subject, email_body: buildEmailHtml(d, textToHtml(v.text)) });
      const hasAB = s.variants.length > 1 || s.variants[0].label !== null;
      return hasAB
        ? { ...base, seq_variants: s.variants.map((v, i) => ({ ...(v.id !== null ? { id: v.id } : {}), variant_label: v.label ?? String.fromCharCode(65 + i), ...mk(v) })) }
        : { ...base, ...mk(s.variants[0]) };
    });
    await writeBackups(campaignId, [{ at: new Date().toISOString(), steps: current }, ...(await backups(campaignId))]);
    await saveSequences(campaignId, sequences);
    return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: `Smartlead did not accept the change: ${(e as Error).message}` }, { status: 502 });
  }
}

/** Undo: puts back exactly what Smartlead had before the last save from this page. */
export async function POST(req: Request) {
  if (!(await smartleadConfigured())) return NextResponse.json({ error: "Smartlead is not connected" }, { status: 503 });
  const body = z.object({ campaignId: z.string().regex(ID), action: z.literal("undo") }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Pick a campaign" }, { status: 400 });
  const id = body.data.campaignId;
  try {
    const [last, ...rest] = await backups(id);
    if (!last) return NextResponse.json({ error: "Nothing to undo for this campaign" }, { status: 404 });
    await saveSequences(id, restorePayload(last.steps));
    await writeBackups(id, rest);
    return NextResponse.json({ ok: true, restoredFrom: last.at });
  } catch (e) {
    return NextResponse.json({ error: `Smartlead did not accept the undo: ${(e as Error).message}` }, { status: 502 });
  }
}
