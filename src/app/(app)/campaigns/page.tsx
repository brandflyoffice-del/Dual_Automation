import { PageHeader } from "@/components/page-header";
import { LiveRefresh } from "@/components/live-refresh";
import { LaunchCampaign } from "@/components/launch-campaign";
import { SequenceMonitor } from "@/components/campaigns/sequence-monitor";
import { getCampaignData } from "@/lib/queries";
import type { SequenceLead } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const { steps, leads } = await getCampaignData();
  const rows: SequenceLead[] = leads.map((l) => ({
    id: l.id,
    name: `${l.firstName} ${l.lastName}`.trim(),
    company: l.companyName,
    role: l.role,
    region: l.region,
    stage: l.stage,
    paused: l.sequencePaused,
    sentiment: l.replySentiment,
    steps: l.sequences.map((s) => ({
      step: s.step,
      subject: s.subject,
      body: s.body,
      status: s.status,
      sentAt: s.sentAt?.toISOString() ?? null,
      scheduledAt: s.scheduledAt?.toISOString() ?? null,
      opens: s.opens,
      clicks: s.clicks,
      replied: s.replied,
    })),
  }));

  return (
    <>
      <PageHeader
        title="Sequence & Follow-Up Monitor"
        description="The 4-step AI-personalised email sequence: Day 0 hook, Day 3 ROI case study, Day 7 bottleneck reminder, Day 11 breakup. Replies stop the sequence and the AI takes over."
        actions={
          <>
            <LaunchCampaign className="hidden lg:inline-flex" />
            <LiveRefresh />
          </>
        }
      />
      <SequenceMonitor steps={steps} leads={rows} />
    </>
  );
}
