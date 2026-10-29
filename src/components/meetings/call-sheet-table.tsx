"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, ExternalLink, FileSpreadsheet, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PainTag, RegionBadge, ServiceBadge } from "@/components/badges";
import { CountdownBadge } from "./countdown";
import { OutcomeSelect } from "./outcome-select";
import { formatIst, formatDateTime, formatRevenueBand, formatUsd, initials } from "@/lib/utils";
import { INDUSTRY_LABEL, type Industry, type MeetingStatus } from "@/lib/constants";
import type { MeetingRow } from "@/lib/types";

export function CallSheetTable({
  data,
  globalFilter,
  sheetUrl,
  onOpen,
  onStatus,
}: {
  data: MeetingRow[];
  globalFilter: string;
  sheetUrl: string;
  onOpen: (m: MeetingRow) => void;
  onStatus: (id: string, status: MeetingStatus) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "when", desc: false }]);

  const columns = useMemo<ColumnDef<MeetingRow>[]>(
    () => [
      {
        id: "when",
        accessorFn: (r) => new Date(r.startTime).getTime(),
        header: ({ column }) => (
          <button className="flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            When <ArrowUpDown className="size-3" />
          </button>
        ),
        cell: ({ row }) => (
          <div className="space-y-1">
            <CountdownBadge start={row.original.startTime} status={row.original.status} />
            <div className="font-metric text-[11px] text-muted-foreground">{formatIst(row.original.startTime)}</div>
            <div className="font-metric text-[11px] text-muted-foreground/70">
              {formatDateTime(row.original.startTime, row.original.timezone)} local
            </div>
          </div>
        ),
      },
      {
        id: "prospect",
        accessorFn: (r) => `${r.prospectName} ${r.role} ${r.email}`,
        header: "Prospect & Role",
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo/15 text-[11px] font-semibold text-indigo-700">
              {initials(row.original.prospectName)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{row.original.prospectName}</div>
              <div className="truncate text-xs text-muted-foreground">{row.original.role}</div>
            </div>
          </div>
        ),
      },
      {
        id: "company",
        accessorFn: (r) => `${r.company} ${INDUSTRY_LABEL[r.industry as Industry] ?? ""} ${r.country}`,
        header: "Company & Revenue",
        cell: ({ row }) => (
          <div>
            <div className="text-sm font-medium">{row.original.company}</div>
            <div className="font-metric text-[11px] text-muted-foreground">
              {formatRevenueBand(row.original.revenue)} · {INDUSTRY_LABEL[row.original.industry as Industry]}
            </div>
          </div>
        ),
      },
      { id: "region", accessorKey: "region", header: "Region", cell: ({ row }) => <RegionBadge region={row.original.region} /> },
      {
        id: "pain",
        accessorFn: (r) => r.painPoint ?? "",
        header: "Core Pain Point",
        cell: ({ row }) => <PainTag>{row.original.painPoint}</PainTag>,
      },
      {
        id: "service",
        accessorFn: (r) => r.service ?? "",
        header: "Target Service",
        cell: ({ row }) => <ServiceBadge service={row.original.service} />,
      },
      {
        id: "ticket",
        accessorKey: "estimatedTicket",
        header: ({ column }) => (
          <button className="flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Est. Ticket <ArrowUpDown className="size-3" />
          </button>
        ),
        cell: ({ row }) => (
          <Badge variant="emerald" className="font-metric text-xs">
            {formatUsd(row.original.estimatedTicket)}+
          </Badge>
        ),
      },
      {
        id: "join",
        header: "Join",
        enableSorting: false,
        cell: ({ row }) => {
          const m = row.original;
          const disabled = !m.meetLink || m.status === "CANCELLED";
          return (
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <Button asChild size="sm" disabled={disabled} className={disabled ? "pointer-events-none opacity-40" : ""}>
                <a href={m.meetLink ?? "#"} target="_blank" rel="noreferrer">
                  <Video /> Join Google Meet
                </a>
              </Button>
              <Button asChild size="icon" variant="outline" className="size-8" title="Open Master Google Sheet">
                <a href={sheetUrl} target="_blank" rel="noreferrer" aria-label="Open Master Google Sheet">
                  <FileSpreadsheet className="size-4 text-emerald" />
                </a>
              </Button>
              {m.calendarEventUrl && (
                <Button asChild size="icon" variant="outline" className="size-8" title="Open in Google Calendar">
                  <a href={m.calendarEventUrl} target="_blank" rel="noreferrer" aria-label="Open in Google Calendar">
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
              )}
            </div>
          );
        },
      },
      {
        id: "outcome",
        accessorKey: "status",
        header: "Outcome",
        enableSorting: false,
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <OutcomeSelect value={row.original.status} onChange={(s) => onStatus(row.original.id, s)} />
          </div>
        ),
      },
    ],
    [sheetUrl, onStatus],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    globalFilterFn: (row, _id, value: string) => {
      const q = value.toLowerCase();
      const r = row.original;
      return [r.prospectName, r.company, r.role, r.country, r.painPoint, r.service, INDUSTRY_LABEL[r.industry as Industry], r.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <div className="max-w-full min-w-0 overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[1280px] text-left">
        <thead className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id} className="whitespace-nowrap px-4 py-3 font-medium">
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-16 text-center text-sm text-muted-foreground">
                No meetings match this view yet. The email engine will drop new bookings here automatically.
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onOpen(row.original)}
              className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-foreground/[0.04]"
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3 align-middle">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
