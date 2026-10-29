"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MEETING_STATUSES, MEETING_STATUS_LABEL, type MeetingStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  CLOSED_WON: "border-emerald/40 text-emerald",
  COMPLETED_PROPOSAL_SENT: "border-indigo/40 text-indigo-700",
  NO_SHOW: "border-rose-500/40 text-rose-600",
  CANCELLED: "border-rose-500/40 text-rose-600",
  RESCHEDULED: "border-amber-500/40 text-amber-700",
};

export function OutcomeSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: MeetingStatus) => void;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as MeetingStatus)}>
      <SelectTrigger className={cn("h-8 w-[210px] text-xs", TONE[value], className)} onClick={(e) => e.stopPropagation()}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {MEETING_STATUSES.map((s) => (
          <SelectItem key={s} value={s} className="text-xs">
            {MEETING_STATUS_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
