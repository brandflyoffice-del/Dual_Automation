import { db } from "./db";
import {
  ACTIVE_STAGES,
  ICP,
  INDUSTRY_LABEL,
  REGION_META,
  SENT_STAGES,
  SERVICE_META,
  type Industry,
  type Region,
  type Service,
} from "./constants";
import { endOfWeek, safePct, startOfWeek } from "./utils";

export const clampTicket = (n: number) => Math.min(ICP.maxTicketModel, Math.max(ICP.minTicket, n));

export async function getDashboardData() {
  const [leads, meetings] = await Promise.all([
    db.lead.findMany({
      select: {
        id: true,
        region: true,
        industry: true,
        stage: true,
        emailStatus: true,
        currentStep: true,
        sequencePaused: true,
        replySentiment: true,
        recommendedService: true,
        qualificationScore: true,
        estimatedTicket: true,
        repliedAt: true,
      },
    }),
    db.meeting.findMany({
      include: { lead: { select: { companyName: true, firstName: true, lastName: true, role: true, region: true } } },
      orderBy: { startTime: "asc" },
    }),
  ]);

  const wkStart = startOfWeek();
  const wkEnd = endOfWeek();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
  const liveMeetings = meetings.filter((m) => m.status !== "CANCELLED");

  const qualified = leads.filter((l) => l.estimatedTicket >= ICP.minTicket);
  const emailed = leads.filter((l) => SENT_STAGES.includes(l.stage));
  const positive = leads.filter((l) => l.replySentiment === "Positive_Booking_Intent");
  const active = leads.filter((l) => ACTIVE_STAGES.includes(l.stage) && !l.sequencePaused);
  const meetingsThisWeek = liveMeetings.filter((m) => m.startTime >= wkStart && m.startTime <= wkEnd);
  const bookedLast7 = liveMeetings.filter((m) => m.createdAt >= sevenDaysAgo);

  const meetingLeadIds = new Set(liveMeetings.map((m) => m.leadId));
  const pipelineFromMeetings = liveMeetings
    .filter((m) => m.status !== "NO_SHOW")
    .reduce((s, m) => s + clampTicket(m.estimatedTicket), 0);
  const pipelineFromReplies = leads
    .filter(
      (l) =>
        !meetingLeadIds.has(l.id) &&
        l.replySentiment &&
        ["Positive_Booking_Intent", "Question_Needs_FollowUp"].includes(l.replySentiment) &&
        l.stage === "REPLIED",
    )
    .reduce((s, l) => s + clampTicket(l.estimatedTicket), 0);

  const kpis = {
    qualifiedLeads: qualified.length,
    highPriority: qualified.filter((l) => l.qualificationScore >= 80).length,
    activeSequences: active.length,
    positiveReplyRate: safePct(positive.length, emailed.length),
    positiveReplies: positive.length,
    meetingsThisWeek: meetingsThisWeek.length,
    bookedLast7Days: bookedLast7.length,
    pipelineValue: pipelineFromMeetings + pipelineFromReplies,
    pipelineMeetings: liveMeetings.length,
  };

  const funnel = [
    { stage: "Scraped", value: leads.length },
    { stage: "Verified", value: leads.filter((l) => l.emailStatus === "VALID").length },
    { stage: "Emailed", value: emailed.length },
    { stage: "Follow-Up 1", value: leads.filter((l) => l.currentStep >= 2).length },
    { stage: "Follow-Up 2", value: leads.filter((l) => l.currentStep >= 3).length },
    { stage: "Follow-Up 3", value: leads.filter((l) => l.currentStep >= 4).length },
    { stage: "Positive Reply", value: positive.length },
    { stage: "Meeting Booked", value: meetingLeadIds.size },
  ];

  const geo = ICP.regions.map((r: Region) => {
    const ls = leads.filter((l) => l.region === r);
    const em = ls.filter((l) => SENT_STAGES.includes(l.stage));
    const pos = ls.filter((l) => l.replySentiment === "Positive_Booking_Intent");
    const mt = liveMeetings.filter((m) => m.lead.region === r);
    return {
      region: r,
      name: REGION_META[r].label,
      color: REGION_META[r].color,
      leads: ls.length,
      emailed: em.length,
      positive: pos.length,
      meetings: mt.length,
      replyRate: safePct(pos.length, em.length),
    };
  });

  const services = (Object.keys(SERVICE_META) as Service[]).map((s) => {
    const ls = leads.filter((l) => l.recommendedService === s);
    return {
      service: s,
      name: SERVICE_META[s].short,
      color: SERVICE_META[s].color,
      leads: ls.length,
      pipeline: ls.reduce((a, l) => a + clampTicket(l.estimatedTicket), 0),
      booked: ls.filter((l) => l.stage === "BOOKED").length,
    };
  });

  const upcoming = liveMeetings.filter((m) => m.startTime.getTime() > Date.now() - 45 * 60000).slice(0, 5);

  return { kpis, funnel, geo, services, upcoming };
}

export async function getMeetingsData() {
  const meetings = await db.meeting.findMany({
    include: {
      lead: {
        include: {
          sequences: { orderBy: { step: "asc" } },
          events: { orderBy: { occurredAt: "asc" } },
        },
      },
    },
    orderBy: { startTime: "asc" },
  });
  return meetings;
}

export async function getLeadsData() {
  return db.lead.findMany({
    include: {
      sequences: { orderBy: { step: "asc" } },
      meetings: { select: { id: true, startTime: true, status: true } },
    },
    orderBy: [{ qualificationScore: "desc" }, { createdAt: "desc" }],
  });
}

export async function getCampaignData() {
  const sequences = await db.campaignSequence.findMany({
    include: { lead: { select: { id: true, firstName: true, lastName: true, companyName: true, role: true, stage: true, sequencePaused: true, region: true } } },
    orderBy: [{ leadId: "asc" }, { step: "asc" }],
  });

  const steps = [1, 2, 3, 4].map((step) => {
    const rows = sequences.filter((s) => s.step === step);
    const sent = rows.filter((s) => s.status === "SENT");
    const opened = sent.filter((s) => s.opens > 0).length;
    const clicked = sent.filter((s) => s.clicks > 0).length;
    const replied = rows.filter((s) => s.replied).length;
    return {
      step,
      scheduled: rows.filter((s) => s.status === "SCHEDULED").length,
      sent: sent.length,
      opened,
      clicked,
      replied,
      openRate: safePct(opened, sent.length),
      replyRate: safePct(replied, sent.length),
    };
  });

  const leads = await db.lead.findMany({
    where: { sequences: { some: {} } },
    include: { sequences: { orderBy: { step: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });

  return { steps, leads };
}

export async function computeReportMetrics(weekStart: Date, weekEnd: Date) {
  const [seqs, meetings, leads, events] = await Promise.all([
    db.campaignSequence.findMany({ where: { sentAt: { gte: weekStart, lte: weekEnd } }, include: { lead: true } }),
    db.meeting.findMany({
      where: { createdAt: { gte: weekStart, lte: weekEnd } },
      include: { lead: true },
      orderBy: { startTime: "asc" },
    }),
    db.lead.findMany({ where: { createdAt: { gte: weekStart, lte: weekEnd } } }),
    db.emailEvent.findMany({ where: { occurredAt: { gte: weekStart, lte: weekEnd } }, include: { lead: true } }),
  ]);

  const first = seqs.filter((s) => s.step === 1);
  const follow = seqs.filter((s) => s.step > 1);
  const replies = events.filter((e) => e.type === "REPLY_RECEIVED");
  const positive = replies.filter((e) => e.sentiment === "Positive_Booking_Intent");
  const liveMeetings = meetings.filter((m) => m.status !== "CANCELLED");
  const pipelineAdded = liveMeetings.reduce((s, m) => s + clampTicket(m.estimatedTicket), 0);

  const byIndustry = (Object.keys(INDUSTRY_LABEL) as Industry[])
    .map((ind) => {
      const contacted = first.filter((s) => s.lead.industry === ind).length;
      const rep = replies.filter((e) => e.lead.industry === ind).length;
      const mt = liveMeetings.filter((m) => m.lead.industry === ind);
      return {
        industry: ind,
        label: INDUSTRY_LABEL[ind],
        contacted,
        replies: rep,
        meetings: mt.length,
        pipeline: mt.reduce((s, m) => s + clampTicket(m.estimatedTicket), 0),
        replyRate: safePct(rep, contacted),
      };
    })
    .sort((a, b) => b.meetings - a.meetings || b.pipeline - a.pipeline);

  return {
    leadsScraped: leads.length,
    leadsContacted: first.length,
    followUpsSent: follow.length,
    replies: replies.length,
    positiveReplies: positive.length,
    meetingsBooked: liveMeetings.length,
    pipelineAdded,
    topIndustries: byIndustry.slice(0, 5),
    meetings: liveMeetings.map((m) => ({
      company: m.lead.companyName,
      prospect: `${m.lead.firstName} ${m.lead.lastName}`.trim(),
      role: m.lead.role,
      startTime: m.startTime.toISOString(),
      service: m.lead.recommendedService,
      ticket: m.estimatedTicket,
    })),
  };
}

export type ReportMetrics = Awaited<ReturnType<typeof computeReportMetrics>>;
