import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { config } from "@/lib/config";
import { publish } from "@/lib/bus";
import { EMAIL_EVENT_TYPES, SENTIMENTS } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * n8n → Dashboard webhook.
 *
 * Header: x-fenebris-secret: <WEBHOOK_SECRET>
 * Body:   { event, ingest?, data }
 *
 *  - ingest=false (default): n8n already wrote to Postgres. We only revalidate + push a live event.
 *  - ingest=true: the handler performs the idempotent upsert itself (use when n8n can't reach the DB).
 */

const emailEvent = z.object({
  email: z.string().email(),
  type: z.enum(EMAIL_EVENT_TYPES),
  step: z.number().int().min(1).max(4).nullish(),
  externalId: z.string().nullish(),
  subject: z.string().nullish(),
  body: z.string().nullish(),
  sentiment: z.enum(SENTIMENTS).nullish(),
  aiReply: z.string().nullish(),
  aiReplySent: z.boolean().optional(),
  needsHuman: z.boolean().optional(),
  occurredAt: z.string().datetime().optional(),
});

const meetingUpsert = z.object({
  leadEmail: z.string().email(),
  uid: z.string().min(1),
  previousUid: z.string().nullish(),
  status: z.enum(["SCHEDULED", "COMPLETED_PROPOSAL_SENT", "CLOSED_WON", "NO_SHOW", "RESCHEDULED", "CANCELLED"]).default("SCHEDULED"),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  timezone: z.string().default("UTC"),
  meetLink: z.string().nullish(),
  calendarEventId: z.string().nullish(),
  calendarEventUrl: z.string().nullish(),
  estimatedTicket: z.number().int().min(0).default(0),
});

const leadUpsert = z.object({
  lead: z.object({
    email: z.string().email(),
    firstName: z.string(),
    lastName: z.string().default(""),
    role: z.string(),
    companyName: z.string(),
    companyDomain: z.string(),
    country: z.string(),
    region: z.enum(["US", "UK", "EUROPE", "UAE"]),
    industry: z.enum(["ECOMMERCE_RETAIL", "FINTECH", "REAL_ESTATE_LOGISTICS", "EDTECH", "HOSPITALITY"]),
    annualRevenue: z.number().int().min(100_000).max(10_000_000),
    estimatedTicket: z.number().int().min(1000),
    qualificationScore: z.number().int().min(0).max(100).default(0),
    emailStatus: z.string().default("VALID"),
    painPoint: z.string().nullish(),
    painPointDetail: z.string().nullish(),
    recommendedService: z.enum(["WEB_ECOM", "DIGITAL_MARKETING", "STAFF_AUG", "MANAGED_IT"]).nullish(),
    linkedinUrl: z.string().nullish(),
    companyWebsite: z.string().nullish(),
    employeeCount: z.number().int().nullish(),
    outreachLeadId: z.string().nullish(),
    campaignId: z.string().nullish(),
    auditFindings: z.any().optional(),
    dossier: z.any().optional(),
  }),
  sequences: z
    .array(z.object({ step: z.number().int().min(1).max(4), subject: z.string(), body: z.string(), scheduledAt: z.string().datetime().optional() }))
    .default([]),
});

const envelope = z.object({
  event: z.enum(["ping", "lead_synced", "email_event", "meeting_synced", "batch_finished"]),
  ingest: z.boolean().default(false),
  data: z.record(z.string(), z.any()).default({}),
});

function authorized(req: Request) {
  if (!config.webhookSecret) return false;
  const got = Buffer.from(req.headers.get("x-fenebris-secret") ?? "");
  const want = Buffer.from(config.webhookSecret);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function POST(req: Request) {
  if (!config.webhookSecret) {
    return NextResponse.json({ error: "WEBHOOK_SECRET is not configured on the dashboard" }, { status: 503 });
  }
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = envelope.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid envelope", issues: parsed.error.issues }, { status: 400 });
  const { event, ingest, data } = parsed.data;

  try {
    switch (event) {
      case "ping":
        return NextResponse.json({ ok: true, pong: true });

      case "batch_finished": {
        const via = data.provider === "apify" ? "Apify" : data.provider === "ai-ark" ? "AI Ark" : "Lead search";
        publish({ type: event, title: "Scraper batch finished", detail: `${via} · ${data.qualified ?? "?"} qualified · ${data.rejected ?? "?"} rejected` });
        break;
      }

      case "lead_synced": {
        if (ingest) {
          const p = leadUpsert.parse(data);
          const l = p.lead;
          const lead = await db.lead.upsert({
            where: { email: l.email.toLowerCase() },
            create: { ...l, email: l.email.toLowerCase(), stage: "VERIFIED", auditFindings: l.auditFindings ?? undefined, dossier: l.dossier ?? undefined },
            update: { ...l, email: l.email.toLowerCase(), auditFindings: l.auditFindings ?? undefined, dossier: l.dossier ?? undefined },
          });
          for (const s of p.sequences) {
            await db.campaignSequence.upsert({
              where: { leadId_step: { leadId: lead.id, step: s.step } },
              create: { leadId: lead.id, step: s.step, subject: s.subject, body: s.body, scheduledAt: s.scheduledAt ? new Date(s.scheduledAt) : null },
              update: { subject: s.subject, body: s.body, scheduledAt: s.scheduledAt ? new Date(s.scheduledAt) : null },
            });
          }
        }
        publish({ type: event, title: "New qualified lead", detail: `${data.lead?.companyName ?? data.companyName ?? "Lead"} synced` });
        break;
      }

      case "email_event": {
        if (ingest) {
          const e = emailEvent.parse(data);
          const lead = await db.lead.findUnique({ where: { email: e.email.toLowerCase() } });
          if (!lead) return NextResponse.json({ error: "unknown lead" }, { status: 404 });
          const dup = e.externalId
            ? await db.emailEvent.findFirst({ where: { leadId: lead.id, type: e.type, step: e.step ?? null, externalId: e.externalId } })
            : null;
          if (!dup) {
            await db.emailEvent.create({
              data: {
                leadId: lead.id, type: e.type, step: e.step ?? null, externalId: e.externalId ?? null, subject: e.subject ?? null,
                body: e.body ?? null, sentiment: e.sentiment ?? null, aiReply: e.aiReply ?? null, aiReplySent: e.aiReplySent ?? false,
                needsHuman: e.needsHuman ?? false, occurredAt: e.occurredAt ? new Date(e.occurredAt) : new Date(),
              },
            });
            const step = e.step ?? 1;
            if (e.type === "EMAIL_SENT") {
              await db.campaignSequence.updateMany({ where: { leadId: lead.id, step }, data: { status: "SENT", sentAt: new Date() } });
              const stage = ["STEP_1_SENT", "FOLLOWUP_2", "FOLLOWUP_3", "BREAKUP_SENT"][step - 1];
              if (!["REPLIED", "BOOKED", "NOT_INTERESTED"].includes(lead.stage)) {
                await db.lead.update({ where: { id: lead.id }, data: { stage, currentStep: Math.max(lead.currentStep, step) } });
              }
            } else if (e.type === "EMAIL_OPENED") {
              await db.campaignSequence.updateMany({ where: { leadId: lead.id, step }, data: { opens: { increment: 1 } } });
            } else if (e.type === "LINK_CLICKED") {
              await db.campaignSequence.updateMany({ where: { leadId: lead.id, step }, data: { clicks: { increment: 1 } } });
            } else if (e.type === "REPLY_RECEIVED") {
              await db.campaignSequence.updateMany({ where: { leadId: lead.id, step }, data: { replied: true } });
              await db.lead.update({
                where: { id: lead.id },
                data: {
                  replySentiment: e.sentiment ?? null,
                  repliedAt: new Date(),
                  needsHuman: e.needsHuman ?? false,
                  stage: e.sentiment === "Not_Interested" ? "NOT_INTERESTED" : e.sentiment === "Out_Of_Office" ? lead.stage : "REPLIED",
                },
              });
            }
          }
        }
        const label: Record<string, string> = {
          EMAIL_SENT: "Email sent", EMAIL_OPENED: "Email opened", LINK_CLICKED: "Link clicked",
          REPLY_RECEIVED: "Reply received", EMAIL_BOUNCED: "Email bounced", AI_REPLY_SENT: "AI reply sent",
        };
        publish({ type: event, title: label[data.type] ?? "Outreach event", detail: [data.email, data.sentiment].filter(Boolean).join(" · ") });
        break;
      }

      case "meeting_synced": {
        if (ingest) {
          const m = meetingUpsert.parse(data);
          const lead = await db.lead.findUnique({ where: { email: m.leadEmail.toLowerCase() } });
          if (!lead) return NextResponse.json({ error: "unknown lead" }, { status: 404 });
          const existing = await db.meeting.findFirst({
            where: { calBookingUid: { in: [m.uid, ...(m.previousUid ? [m.previousUid] : [])] } },
          });
          const fields = {
            calBookingUid: m.uid, startTime: new Date(m.startTime), endTime: new Date(m.endTime), prospectTimezone: m.timezone,
            meetLink: m.meetLink ?? null, calendarEventId: m.calendarEventId ?? null, calendarEventUrl: m.calendarEventUrl ?? null,
            status: m.status, estimatedTicket: m.estimatedTicket || lead.estimatedTicket,
          };
          if (existing) await db.meeting.update({ where: { id: existing.id }, data: fields });
          else await db.meeting.create({ data: { ...fields, leadId: lead.id } });
          if (m.status !== "CANCELLED") await db.lead.update({ where: { id: lead.id }, data: { stage: "BOOKED", sequencePaused: true } });
        }
        publish({
          type: event,
          title: data.status === "CANCELLED" ? "Meeting cancelled" : data.previousUid ? "Meeting rescheduled" : "Meeting booked 🎉",
          detail: data.leadEmail,
        });
        break;
      }
    }
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "validation failed", issues: err.issues }, { status: 422 });
    console.error("[webhook:n8n]", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }

  for (const p of ["/dashboard", "/meetings", "/leads", "/campaigns", "/reports"]) revalidatePath(p);
  return NextResponse.json({ ok: true, event });
}

export async function GET() {
  return NextResponse.json({ service: "fenebris-n8n-webhook", ready: !!config.webhookSecret });
}
