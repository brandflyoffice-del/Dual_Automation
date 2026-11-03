// Server-only: the rows behind each export (Leads, Email activity, Meetings), already in readable words.
import { db } from "@/lib/db";
import { INDUSTRY_LABEL, MEETING_STATUS_LABEL, OUTREACH_CAMPAIGNS, REGION_META, SENTIMENT_LABEL, SERVICE_META, STAGE_LABEL } from "@/lib/constants";
import type { ExportTable } from "@/lib/export";

export const DATASETS = {
  leads: { scopes: ["all", "contacted", "replied", "interested", "booked", "not_contacted"] },
  emails: { scopes: ["7", "30", "90", "all"] },
  meetings: { scopes: ["upcoming", "past", "all"] },
} as const;
export type Dataset = keyof typeof DATASETS;

const IST = "Asia/Kolkata";
const when = (d: Date | null | undefined) =>
  d ? d.toLocaleString("en-GB", { timeZone: IST, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " IST" : "";
const campaignName = (id: string | null) => (id ? (OUTREACH_CAMPAIGNS.find((c) => c.id === id)?.name ?? id) : "");
const label = <T extends string>(map: Record<string, string>, v: T | null | undefined) => (v ? (map[v] ?? v) : "");
const n = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const today = () => new Date().toLocaleDateString("en-GB", { timeZone: IST, day: "2-digit", month: "short", year: "numeric" });

const LEAD_SCOPE_TITLE: Record<string, string> = {
  all: "All leads",
  contacted: "Leads that were emailed",
  replied: "Leads that replied",
  interested: "Interested leads",
  booked: "Leads with a booked meeting",
  not_contacted: "Leads not emailed yet",
};

async function leads(scope: string): Promise<ExportTable> {
  const where =
    scope === "contacted"
      ? { currentStep: { gt: 0 } }
      : scope === "replied"
        ? { repliedAt: { not: null } }
        : scope === "interested"
          ? { OR: [{ replySentiment: "Positive_Booking_Intent" }, { stage: "BOOKED" }] }
          : scope === "booked"
            ? { stage: "BOOKED" }
            : scope === "not_contacted"
              ? { currentStep: 0 }
              : {};
  const rows = await db.lead.findMany({
    where: { ...where, source: { not: "demo" } },
    orderBy: { createdAt: "desc" },
    include: { meetings: { orderBy: { startTime: "desc" }, take: 1, select: { startTime: true, status: true } } },
  });
  return {
    title: `BrandFly · ${LEAD_SCOPE_TITLE[scope] ?? "Leads"}`,
    subtitle: `${n(rows.length, "lead")} · exported ${today()}`,
    columns: [
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "role", label: "Role" },
      { key: "company", label: "Company" },
      { key: "website", label: "Website" },
      { key: "linkedin", label: "LinkedIn" },
      { key: "country", label: "Country" },
      { key: "region", label: "Region" },
      { key: "industry", label: "Industry" },
      { key: "employees", label: "Employees" },
      { key: "business", label: "What they do" },
      { key: "pain", label: "Pain point" },
      { key: "painDetail", label: "Pain point detail" },
      { key: "service", label: "Recommended service" },
      { key: "score", label: "Score" },
      { key: "ticket", label: "Est. deal (USD)" },
      { key: "stage", label: "Stage" },
      { key: "emailsSent", label: "Emails sent" },
      { key: "reply", label: "Reply" },
      { key: "repliedAt", label: "Replied at" },
      { key: "meeting", label: "Meeting" },
      { key: "campaign", label: "Campaign" },
      { key: "source", label: "Found via" },
      { key: "added", label: "Added" },
    ],
    rows: rows.map((l) => {
      const dossier = (l.dossier ?? {}) as { business?: string | null };
      const m = l.meetings[0];
      return {
        name: `${l.firstName} ${l.lastName}`.trim(),
        email: l.email,
        role: l.role,
        company: l.companyName,
        website: l.companyWebsite ?? "",
        linkedin: l.linkedinUrl ?? "",
        country: l.country,
        region: REGION_META[l.region as keyof typeof REGION_META]?.label ?? l.region,
        industry: label(INDUSTRY_LABEL, l.industry),
        employees: l.employeeCount ? String(l.employeeCount) : "",
        business: dossier.business ?? "",
        pain: l.painPoint ?? "",
        painDetail: l.painPointDetail ?? "",
        service: l.recommendedService ? (SERVICE_META[l.recommendedService as keyof typeof SERVICE_META]?.label ?? l.recommendedService) : "",
        score: String(l.qualificationScore),
        ticket: l.estimatedTicket ? String(l.estimatedTicket) : "",
        stage: label(STAGE_LABEL, l.stage),
        emailsSent: String(l.currentStep),
        reply: label(SENTIMENT_LABEL, l.replySentiment),
        repliedAt: when(l.repliedAt),
        meeting: m ? `${when(m.startTime)} (${label(MEETING_STATUS_LABEL, m.status)})` : "",
        campaign: campaignName(l.campaignId),
        source: l.source,
        added: when(l.createdAt),
      };
    }),
  };
}

const EVENT_LABEL: Record<string, string> = {
  EMAIL_SENT: "Email sent",
  REPLY_RECEIVED: "Reply received",
  AI_REPLY_SENT: "AI reply sent",
  MANUAL_REPLY_SENT: "Your reply sent",
  EMAIL_BOUNCED: "Bounced",
  EMAIL_OPENED: "Opened",
  LINK_CLICKED: "Link clicked",
};

async function emails(scope: string): Promise<ExportTable> {
  const days = Number(scope);
  const since = Number.isFinite(days) && days > 0 ? new Date(Date.now() - days * 86_400_000) : null;
  const rows = await db.emailEvent.findMany({
    where: { ...(since ? { occurredAt: { gte: since } } : {}), lead: { source: { not: "demo" } } },
    orderBy: { occurredAt: "desc" },
    take: 20_000,
    include: { lead: { select: { firstName: true, lastName: true, email: true, companyName: true, campaignId: true } } },
  });
  return {
    title: "BrandFly · Email activity",
    subtitle: `${n(rows.length, "email")} ${since ? `in the last ${days} days` : "(all time)"} · sent, replies and answers · exported ${today()}`,
    columns: [
      { key: "at", label: "When" },
      { key: "what", label: "What" },
      { key: "name", label: "Prospect" },
      { key: "email", label: "Email" },
      { key: "company", label: "Company" },
      { key: "subject", label: "Subject" },
      { key: "text", label: "Message" },
      { key: "intent", label: "AI read it as" },
      { key: "from", label: "Our mailbox" },
    ],
    rows: rows.map((e) => ({
      at: when(e.occurredAt),
      what: (EVENT_LABEL[e.type] ?? e.type) + (e.type === "EMAIL_SENT" && e.step ? ` (email ${e.step})` : "") + (e.needsHuman ? " · needs you" : ""),
      name: `${e.lead.firstName} ${e.lead.lastName}`.trim(),
      email: e.lead.email,
      company: e.lead.companyName,
      subject: e.subject ?? "",
      text: (e.aiReply || e.body || "").slice(0, 2000),
      intent: e.type === "REPLY_RECEIVED" ? label(SENTIMENT_LABEL, e.sentiment) : "",
      from: e.eaccount ?? "",
    })),
  };
}

async function meetings(scope: string): Promise<ExportTable> {
  const now = new Date();
  const where = scope === "upcoming" ? { startTime: { gte: now } } : scope === "past" ? { startTime: { lt: now } } : {};
  const rows = await db.meeting.findMany({
    where: { ...where, lead: { source: { not: "demo" } } },
    orderBy: { startTime: scope === "upcoming" ? "asc" : "desc" },
    include: { lead: { select: { firstName: true, lastName: true, email: true, role: true, companyName: true, companyWebsite: true, painPoint: true, country: true } } },
  });
  return {
    title: `BrandFly · ${scope === "upcoming" ? "Upcoming meetings" : scope === "past" ? "Past meetings" : "All meetings"}`,
    subtitle: `${n(rows.length, "meeting")} · times in IST · exported ${today()}`,
    columns: [
      { key: "at", label: "When (IST)" },
      { key: "name", label: "Prospect" },
      { key: "email", label: "Email" },
      { key: "role", label: "Role" },
      { key: "company", label: "Company" },
      { key: "country", label: "Country" },
      { key: "pain", label: "Pain point" },
      { key: "status", label: "Status" },
      { key: "meet", label: "Google Meet" },
      { key: "ticket", label: "Est. deal (USD)" },
      { key: "notes", label: "Notes" },
    ],
    rows: rows.map((m) => ({
      at: when(m.startTime),
      name: `${m.lead.firstName} ${m.lead.lastName}`.trim(),
      email: m.lead.email,
      role: m.lead.role,
      company: m.lead.companyName,
      country: m.lead.country,
      pain: m.lead.painPoint ?? "",
      status: label(MEETING_STATUS_LABEL, m.status),
      meet: m.meetLink ?? "",
      ticket: m.estimatedTicket ? String(m.estimatedTicket) : "",
      notes: m.notes,
    })),
  };
}

export function buildExport(dataset: Dataset, scope: string): Promise<ExportTable> {
  return dataset === "leads" ? leads(scope) : dataset === "emails" ? emails(scope) : meetings(scope);
}
