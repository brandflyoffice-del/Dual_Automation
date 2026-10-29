"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatUsd, startOfWeek } from "@/lib/utils";
import { IST_TZ, MEETING_STATUS_LABEL, type MeetingStatus } from "@/lib/constants";
import { RegionBadge } from "@/components/badges";
import { useNow } from "./countdown";
import type { MeetingRow } from "@/lib/types";

const DAY = 86400000;
const fmtDay = (d: Date) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: IST_TZ }).format(d);
const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: IST_TZ }).format(new Date(iso));
const dayKey = (d: Date | string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: IST_TZ }).format(new Date(d)); // YYYY-MM-DD in IST

const TONE: Record<string, string> = {
  SCHEDULED: "border-sky-500/30 bg-sky-500/10",
  COMPLETED_PROPOSAL_SENT: "border-indigo/30 bg-indigo/10",
  CLOSED_WON: "border-emerald/40 bg-emerald/10",
  NO_SHOW: "border-rose-500/30 bg-rose-500/10",
  RESCHEDULED: "border-amber-500/30 bg-amber-500/10",
  CANCELLED: "border-rose-500/30 bg-rose-500/5 opacity-60",
};

export function CalendarView({
  meetings,
  calendarUrl,
  onOpen,
}: {
  meetings: MeetingRow[];
  calendarUrl: string;
  onOpen: (m: MeetingRow) => void;
}) {
  const [offset, setOffset] = useState(0);
  const now = useNow(60000);
  const weekStart = useMemo(() => new Date(startOfWeek().getTime() + offset * 7 * DAY), [offset]);
  const days = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY + 12 * 3600000));
  const todayKey = now ? dayKey(new Date(now)) : "";

  const byDay = useMemo(() => {
    const map = new Map<string, MeetingRow[]>();
    for (const m of meetings) {
      const k = dayKey(m.startTime);
      map.set(k, [...(map.get(k) ?? []), m]);
    }
    for (const arr of map.values()) arr.sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime));
    return map;
  }, [meetings]);

  const weekTotal = days.reduce((n, d) => n + (byDay.get(dayKey(d))?.filter((m) => m.status !== "CANCELLED").length ?? 0), 0);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" className="size-8" onClick={() => setOffset((o) => o - 1)} aria-label="Previous week">
            <ChevronLeft className="size-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOffset(0)}>
            This week
          </Button>
          <Button size="icon" variant="outline" className="size-8" onClick={() => setOffset((o) => o + 1)} aria-label="Next week">
            <ChevronRight className="size-4" />
          </Button>
          <span className="font-metric ml-3 text-xs text-muted-foreground">
            {fmtDay(days[0])} – {fmtDay(days[6])} · {weekTotal} meetings · times in IST
          </span>
        </div>
        <Button asChild size="sm" variant="secondary">
          <a href={calendarUrl} target="_blank" rel="noreferrer">
            <ExternalLink /> Open Google Calendar
          </a>
        </Button>
      </div>
      <div className="grid min-h-[420px] grid-cols-1 md:grid-cols-7">
        {days.map((d) => {
          const k = dayKey(d);
          const list = byDay.get(k) ?? [];
          return (
            <div key={k} className={cn("border-b border-border p-2 md:border-b-0 md:border-r md:last:border-r-0", k === todayKey && "bg-emerald/[0.04]")}>
              <div className={cn("mb-2 px-1 text-xs font-medium", k === todayKey ? "text-emerald" : "text-muted-foreground")}>
                {fmtDay(d)}
                {k === todayKey && <span className="ml-1.5 rounded bg-emerald/20 px-1 py-0.5 text-[10px]">Today</span>}
              </div>
              <div className="space-y-2">
                {list.length === 0 && <div className="px-1 py-3 text-[11px] text-muted-foreground/60">—</div>}
                {list.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => onOpen(m)}
                    className={cn("w-full cursor-pointer rounded-lg border p-2.5 text-left transition-colors hover:brightness-125", TONE[m.status])}
                  >
                    <div className="font-metric text-[11px] text-muted-foreground">{fmtTime(m.startTime)} IST</div>
                    <div className="mt-0.5 truncate text-[13px] font-medium">{m.company}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {m.prospectName} · {m.role}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-1">
                      <RegionBadge region={m.region} />
                      <span className="font-metric text-[11px] text-emerald">{formatUsd(m.estimatedTicket)}+</span>
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">{MEETING_STATUS_LABEL[m.status as MeetingStatus]}</div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
