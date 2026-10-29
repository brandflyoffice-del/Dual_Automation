"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, FileSpreadsheet, LayoutList, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { CallSheetTable } from "./call-sheet-table";
import { CalendarView } from "./calendar-view";
import { DossierDrawer } from "./dossier-drawer";
import { useNow } from "./countdown";
import { cn, endOfWeek, formatUsd } from "@/lib/utils";
import { MEETING_STATUS_LABEL, type MeetingStatus } from "@/lib/constants";
import type { MeetingRow } from "@/lib/types";

type Scope = "upcoming" | "today" | "week" | "past" | "all";
const SCOPES: { id: Scope; label: string }[] = [
  { id: "upcoming", label: "Upcoming" },
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "past", label: "Past" },
  { id: "all", label: "All" },
];

export function MeetingsHub({
  meetings,
  sheetUrl,
  calendarUrl,
  openId,
}: {
  meetings: MeetingRow[];
  sheetUrl: string;
  calendarUrl: string;
  openId?: string;
}) {
  const [view, setView] = useState<"sheet" | "calendar">("sheet");
  const [scope, setScope] = useState<Scope>("upcoming");
  const [query, setQuery] = useState("");
  const [overrides, setOverrides] = useState<Record<string, { status?: string; notes?: string }>>({});
  const [openMeetingId, setOpenMeetingId] = useState<string | null>(openId ?? null);
  const now = useNow(30000);
  const overridesRef = useRef(overrides);
  useEffect(() => {
    overridesRef.current = overrides;
  }, [overrides]);

  // server data is the base; optimistic overrides sit on top until the next refresh replaces them
  const data = useMemo(
    () =>
      meetings.map((m) => ({
        ...m,
        status: overrides[m.id]?.status ?? m.status,
        notes: overrides[m.id]?.notes ?? m.notes,
      })),
    [meetings, overrides],
  );

  useEffect(() => {
    setOverrides({});
  }, [meetings]);

  const scoped = useMemo(() => {
    const t = now ?? 0;
    const eod = new Date(t);
    eod.setHours(23, 59, 59, 999);
    const wkEnd = endOfWeek(new Date(t)).getTime();
    return data.filter((m) => {
      const s = new Date(m.startTime).getTime();
      const live = s + 45 * 60000 > t;
      switch (scope) {
        case "upcoming":
          return live && m.status !== "CANCELLED";
        case "today":
          return live && s <= eod.getTime() && m.status !== "CANCELLED";
        case "week":
          return s <= wkEnd && s >= new Date(t).setHours(0, 0, 0, 0) && m.status !== "CANCELLED";
        case "past":
          return !live || m.status === "CANCELLED";
        default:
          return true;
      }
    });
  }, [data, scope, now]);

  const changeStatus = useCallback(async (id: string, status: MeetingStatus) => {
    const prev = overridesRef.current[id]?.status;
    setOverrides((o) => ({ ...o, [id]: { ...o[id], status } }));
    try {
      const res = await fetch(`/api/meetings/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error("failed");
      toast.success(`Outcome → ${MEETING_STATUS_LABEL[status]}`, {
        description: json.n8n?.ok ? "Google Sheet updated via n8n" : "Saved. n8n not reachable — sheet not updated",
      });
    } catch {
      setOverrides((o) => ({ ...o, [id]: { ...o[id], status: prev } }));
      toast.error("Could not update outcome. Reverted.");
    }
  }, []);

  const saveNotes = useCallback((id: string, notes: string) => {
    setOverrides((o) => ({ ...o, [id]: { ...o[id], notes } }));
  }, []);

  const openMeeting = data.find((m) => m.id === openMeetingId) ?? null;

  const todayCount = data.filter((m) => {
    const s = new Date(m.startTime).getTime();
    const t = now ?? 0;
    const eod = new Date(t).setHours(23, 59, 59, 999);
    return m.status !== "CANCELLED" && s + 45 * 60000 > t && s <= eod;
  }).length;
  const upcomingValue = data
    .filter((m) => m.status === "SCHEDULED" && new Date(m.startTime).getTime() > (now ?? 0))
    .reduce((s, m) => s + m.estimatedTicket, 0);

  return (
    <div className="min-w-0 max-w-full space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-[1fr_1fr_1.6fr]">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Meetings today</div>
            <div className="font-metric mt-1 text-2xl font-semibold text-emerald">{todayCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Upcoming pipeline (est.)</div>
            <div className="font-metric mt-1 truncate text-xl font-semibold sm:text-2xl">{formatUsd(upcomingValue)}+</div>
          </CardContent>
        </Card>
        <Card className="col-span-2 xl:col-span-1">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Master Google Sheet</div>
              <div className="mt-1 text-sm font-medium">BrandFly Scheduled Meetings</div>
            </div>
            <Button asChild size="sm" className="shrink-0">
              <a href={sheetUrl} target="_blank" rel="noreferrer">
                <FileSpreadsheet /> Open Master Sheet
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border p-0.5">
          {(
            [
              ["sheet", "List", LayoutList],
              ["calendar", "Calendar", CalendarDays],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                view === id ? "bg-foreground/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
        {view === "sheet" && (
          <div className="flex max-w-full overflow-x-auto rounded-lg border border-border p-0.5">
            {SCOPES.map((s) => (
              <button
                key={s.id}
                onClick={() => setScope(s.id)}
                className={cn(
                  "shrink-0 cursor-pointer whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  scope === s.id ? "bg-foreground/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
        <div className="relative w-full min-w-0 sm:ml-auto sm:w-72">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search prospect or company…" className="pl-8" />
        </div>
      </div>

      {view === "sheet" ? (
        <CallSheetTable
          data={scoped}
          globalFilter={query}
          sheetUrl={sheetUrl}
          onOpen={(m) => setOpenMeetingId(m.id)}
          onStatus={changeStatus}
        />
      ) : (
        <CalendarView
          meetings={data.filter((m) => {
            const q = query.toLowerCase();
            return !q || `${m.prospectName} ${m.company} ${m.painPoint ?? ""}`.toLowerCase().includes(q);
          })}
          calendarUrl={calendarUrl}
          onOpen={(m) => setOpenMeetingId(m.id)}
        />
      )}

      <DossierDrawer
        meeting={openMeeting}
        open={!!openMeeting}
        onOpenChange={(o) => !o && setOpenMeetingId(null)}
        sheetUrl={sheetUrl}
        onStatus={changeStatus}
        onNotes={saveNotes}
      />
    </div>
  );
}