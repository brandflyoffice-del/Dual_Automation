import { Badge } from "@/components/ui/badge";
import {
  INDUSTRY_LABEL,
  MEETING_STATUS_LABEL,
  REGION_META,
  SENTIMENT_LABEL,
  SERVICE_META,
  STAGE_LABEL,
  type Industry,
  type MeetingStatus,
  type Region,
  type Sentiment,
  type Service,
} from "@/lib/constants";

export function RegionBadge({ region }: { region: string }) {
  const m = REGION_META[region as Region];
  if (!m) return <Badge>{region}</Badge>;
  return (
    <Badge variant="outline" className="gap-1.5">
      <span className="font-metric text-[10px] tracking-wide">{region === "EUROPE" ? "EU" : region}</span>
    </Badge>
  );
}

export function ServiceBadge({ service }: { service?: string | null }) {
  if (!service) return <span className="text-xs text-muted-foreground">—</span>;
  const m = SERVICE_META[service as Service];
  if (!m) return <Badge>{service}</Badge>;
  return (
    <Badge variant="outline" className="gap-1.5">
      <span className="size-1.5 rounded-full" style={{ background: m.color }} />
      {m.short}
    </Badge>
  );
}

export function IndustryLabel({ industry }: { industry: string }) {
  return <>{INDUSTRY_LABEL[industry as Industry] ?? industry}</>;
}

export function PainTag({ children }: { children?: React.ReactNode }) {
  if (!children) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <Badge variant="rose" className="max-w-[200px] truncate">
      {children}
    </Badge>
  );
}

export function StageBadge({ stage }: { stage: string }) {
  const variant =
    stage === "BOOKED"
      ? "emerald"
      : stage === "REPLIED"
        ? "indigo"
        : stage === "NOT_INTERESTED"
          ? "rose"
          : stage === "BREAKUP_SENT"
            ? "amber"
            : stage === "SCRAPED" || stage === "VERIFIED"
              ? "outline"
              : "sky";
  return <Badge variant={variant}>{STAGE_LABEL[stage] ?? stage}</Badge>;
}

export function SentimentBadge({ sentiment }: { sentiment?: string | null }) {
  if (!sentiment) return null;
  const variant =
    sentiment === "Positive_Booking_Intent"
      ? "emerald"
      : sentiment === "Question_Needs_FollowUp"
        ? "indigo"
        : sentiment === "Not_Interested"
          ? "rose"
          : "amber";
  return <Badge variant={variant}>{SENTIMENT_LABEL[sentiment as Sentiment] ?? sentiment}</Badge>;
}

export function MeetingStatusBadge({ status }: { status: string }) {
  const variant =
    status === "CLOSED_WON"
      ? "emerald"
      : status === "COMPLETED_PROPOSAL_SENT"
        ? "indigo"
        : status === "NO_SHOW" || status === "CANCELLED"
          ? "rose"
          : status === "RESCHEDULED"
            ? "amber"
            : "sky";
  return <Badge variant={variant}>{MEETING_STATUS_LABEL[status as MeetingStatus] ?? status}</Badge>;
}

export function ScoreChip({ score }: { score: number }) {
  const tone = score >= 85 ? "text-emerald" : score >= 70 ? "text-indigo-700" : "text-amber-700";
  return (
    <span className={`font-metric inline-flex items-center gap-1.5 text-xs font-medium ${tone}`}>
      <span className="relative h-1.5 w-10 overflow-hidden rounded-full bg-foreground/10">
        <span className="absolute inset-y-0 left-0 rounded-full bg-current" style={{ width: `${score}%` }} />
      </span>
      {score}
    </span>
  );
}
