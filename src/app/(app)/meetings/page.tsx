import { PageHeader } from "@/components/page-header";
import { LiveRefresh } from "@/components/live-refresh";
import { MeetingsHub } from "@/components/meetings/meetings-hub";
import { getMeetingsData } from "@/lib/queries";
import { config } from "@/lib/config";
import type { AuditFindings, Dossier, MeetingRow, ThreadMessage } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MeetingsPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const { open } = await searchParams;
  const meetings = await getMeetingsData();

  const rows: MeetingRow[] = meetings.map((m) => {
    const l = m.lead;
    const seqByStep = new Map(l.sequences.map((s) => [s.step, s]));
    const thread: ThreadMessage[] = l.events
      .filter((e) => ["EMAIL_SENT", "REPLY_RECEIVED", "AI_REPLY_SENT"].includes(e.type))
      .map((e) => {
        const seq = e.step ? seqByStep.get(e.step) : undefined;
        return {
          id: e.id,
          direction: e.type === "REPLY_RECEIVED" ? ("in" as const) : ("out" as const),
          kind: e.type === "EMAIL_SENT" ? ("SEQUENCE" as const) : e.type === "REPLY_RECEIVED" ? ("REPLY" as const) : ("AI_REPLY" as const),
          step: e.step,
          subject: e.subject ?? seq?.subject ?? "",
          body: e.body ?? e.aiReply ?? seq?.body ?? "",
          at: e.occurredAt.toISOString(),
          sentiment: e.sentiment,
          needsHuman: e.needsHuman,
        };
      });
    return {
      id: m.id,
      leadId: l.id,
      startTime: m.startTime.toISOString(),
      endTime: m.endTime.toISOString(),
      timezone: m.prospectTimezone,
      meetLink: m.meetLink,
      calendarEventUrl: m.calendarEventUrl,
      status: m.status,
      estimatedTicket: m.estimatedTicket,
      notes: m.notes,
      prospectName: `${l.firstName} ${l.lastName}`.trim(),
      email: l.email,
      role: l.role,
      linkedinUrl: l.linkedinUrl,
      company: l.companyName,
      website: l.companyWebsite,
      revenue: l.annualRevenue,
      country: l.country,
      region: l.region,
      industry: l.industry,
      painPoint: l.painPoint,
      painPointDetail: l.painPointDetail,
      service: l.recommendedService,
      score: l.qualificationScore,
      audit: (l.auditFindings as AuditFindings | null) ?? null,
      dossier: (l.dossier as Dossier | null) ?? null,
      thread,
    };
  });

  return (
    <>
      <PageHeader
        title="Meetings"
        description="Open the row, join the Google Meet, read the brief. Every row is a qualified ($1k+) meeting booked by email."
        actions={<LiveRefresh />}
      />
      <MeetingsHub meetings={rows} sheetUrl={config.sheetUrl} calendarUrl={config.calendarUrl} openId={open} />
    </>
  );
}
