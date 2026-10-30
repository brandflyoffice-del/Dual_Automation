import { PageHeader } from "@/components/page-header";
import { LiveRefresh } from "@/components/live-refresh";
import { LeadsExplorer } from "@/components/leads/leads-explorer";
import { getLeadsData } from "@/lib/queries";
import type { LeadRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const leads = await getLeadsData();
  const rows: LeadRow[] = leads.map((l) => ({
    id: l.id,
    name: `${l.firstName} ${l.lastName}`.trim(),
    email: l.email,
    emailStatus: l.emailStatus,
    role: l.role,
    company: l.companyName,
    website: l.companyWebsite,
    country: l.country,
    region: l.region,
    industry: l.industry,
    revenue: l.annualRevenue,
    painPoint: l.painPoint,
    painPointDetail: l.painPointDetail,
    service: l.recommendedService,
    score: l.qualificationScore,
    ticket: l.estimatedTicket,
    stage: l.stage,
    currentStep: l.currentStep,
    paused: l.sequencePaused,
    sentiment: l.replySentiment,
    needsHuman: l.needsHuman,
    hasMeeting: l.meetings.length > 0,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <>
      <PageHeader
        title="Lead & Pain-Point Intelligence"
        description="Every lead is ICP-filtered (US/UK/EU/UAE · $100k–$10M revenue), email-verified and audited for a real hook before a single email is sent."
        actions={<LiveRefresh />}
      />
      <LeadsExplorer leads={rows} />
    </>
  );
}
