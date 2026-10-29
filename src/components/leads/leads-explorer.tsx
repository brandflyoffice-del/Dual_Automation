"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { AlertTriangle, ArrowUpDown, CheckCircle2, ChevronLeft, ChevronRight, Search, ShieldAlert, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PainTag, RegionBadge, ScoreChip, SentimentBadge, ServiceBadge, StageBadge } from "@/components/badges";
import { LaunchCampaign } from "@/components/launch-campaign";
import { ICP, INDUSTRY_LABEL, LEAD_STAGES, REGION_META, STAGE_LABEL, type Industry } from "@/lib/constants";
import { formatRevenueBand, formatUsd } from "@/lib/utils";
import type { LeadRow } from "@/lib/types";

const REV_BANDS: Record<string, [number, number]> = {
  all: [0, Infinity],
  "100-500": [100_000, 500_000],
  "500-1m": [500_000, 1_000_000],
  "1-3m": [1_000_000, 3_000_000],
  "3-6m": [3_000_000, 6_000_000],
  "6-10m": [6_000_000, 10_000_001],
};
const REV_LABEL: Record<string, string> = {
  all: "Any revenue",
  "100-500": "$100k – $500k",
  "500-1m": "$500k – $1M",
  "1-3m": "$1M – $3M",
  "3-6m": "$3M – $6M",
  "6-10m": "$6M – $10M",
};

function FilterSelect({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: [string, string][]; placeholder: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-full text-xs sm:w-[170px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v} className="text-xs">
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function LeadsExplorer({ leads }: { leads: LeadRow[] }) {
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("all");
  const [industry, setIndustry] = useState("all");
  const [revenue, setRevenue] = useState("all");
  const [pain, setPain] = useState("all");
  const [stage, setStage] = useState("all");
  const [sorting, setSorting] = useState<SortingState>([{ id: "score", desc: true }]);

  const painTags = useMemo(() => Array.from(new Set(leads.map((l) => l.painPoint).filter(Boolean))) as string[], [leads]);

  const filtered = useMemo(() => {
    const [lo, hi] = REV_BANDS[revenue];
    const needle = q.trim().toLowerCase();
    return leads.filter(
      (l) =>
        (region === "all" || l.region === region) &&
        (industry === "all" || l.industry === industry) &&
        (pain === "all" || l.painPoint === pain) &&
        (stage === "all" || l.stage === stage) &&
        l.revenue >= lo &&
        l.revenue < hi &&
        (!needle || `${l.name} ${l.company} ${l.role} ${l.email} ${l.country}`.toLowerCase().includes(needle)),
    );
  }, [leads, q, region, industry, revenue, pain, stage]);

  const activeFilters = [region, industry, revenue, pain, stage].filter((v) => v !== "all").length + (q ? 1 : 0);

  const columns = useMemo<ColumnDef<LeadRow>[]>(
    () => [
      {
        id: "prospect",
        accessorFn: (r) => r.name,
        header: "Prospect",
        cell: ({ row: { original: l } }) => (
          <div className="min-w-[170px]">
            <div className="text-sm font-medium">{l.name}</div>
            <div className="text-xs text-muted-foreground">{l.role}</div>
          </div>
        ),
      },
      {
        id: "company",
        accessorFn: (r) => r.company,
        header: "Company",
        cell: ({ row: { original: l } }) => (
          <div className="min-w-[190px]">
            <div className="text-sm">{l.company}</div>
            <div className="font-metric text-[11px] text-muted-foreground">
              {formatRevenueBand(l.revenue)} · {INDUSTRY_LABEL[l.industry as Industry] || l.industry}
            </div>
          </div>
        ),
      },
      { id: "region", accessorKey: "region", header: "Geo", cell: ({ row }) => <RegionBadge region={row.original.region} /> },
      {
        id: "pain",
        accessorFn: (r) => r.painPoint ?? "",
        header: "Detected pain point",
        cell: ({ row: { original: l } }) => (
          <div className="max-w-[260px]" title={l.painPointDetail ?? ""}>
            <PainTag>{l.painPoint}</PainTag>
            <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{l.painPointDetail}</div>
          </div>
        ),
      },
      { id: "service", accessorFn: (r) => r.service ?? "", header: "Pitch", cell: ({ row }) => <ServiceBadge service={row.original.service} /> },
      {
        id: "score",
        accessorKey: "score",
        header: ({ column }) => (
          <button className="flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            AI score <ArrowUpDown className="size-3" />
          </button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <ScoreChip score={row.original.score} />
            {row.original.score >= 80 && <Badge variant="emerald">High</Badge>}
          </div>
        ),
      },
      {
        id: "ticket",
        accessorKey: "ticket",
        header: ({ column }) => (
          <button className="flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Est. ticket <ArrowUpDown className="size-3" />
          </button>
        ),
        cell: ({ row }) => <span className="font-metric text-xs">{formatUsd(row.original.ticket)}+</span>,
      },
      {
        id: "email",
        accessorKey: "emailStatus",
        header: "Email",
        cell: ({ row: { original: l } }) =>
          l.emailStatus === "VALID" ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald">
              <CheckCircle2 className="size-3.5" /> Verified
            </span>
          ) : l.emailStatus === "INVALID" ? (
            <span className="inline-flex items-center gap-1 text-xs text-rose-600">
              <ShieldAlert className="size-3.5" /> Invalid
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-amber-700">
              <AlertTriangle className="size-3.5" /> Pending
            </span>
          ),
      },
      {
        id: "stage",
        accessorKey: "stage",
        header: "Follow-up stage",
        cell: ({ row: { original: l } }) => (
          <div className="flex min-w-[150px] flex-col items-start gap-1">
            <StageBadge stage={l.stage} />
            {l.paused && <Badge variant="amber">Paused</Badge>}
            {l.sentiment && l.stage !== "BOOKED" && <SentimentBadge sentiment={l.sentiment} />}
            {l.needsHuman && (
              <Badge variant="rose">
                <AlertTriangle /> Needs human
              </Badge>
            )}
          </div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    initialState: { pagination: { pageSize: 12 } },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const reset = () => {
    setQ("");
    setRegion("all");
    setIndustry("all");
    setRevenue("all");
    setPain("all");
    setStage("all");
  };

  const pageCount = table.getPageCount();
  const pageIndex = table.getState().pagination.pageIndex;

  return (
    <div className="min-w-0 max-w-full space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              table.setPageIndex(0);
            }}
            placeholder="Search name, company, email…"
            className="h-9 pl-8 text-xs"
          />
        </div>
        <FilterSelect
          value={region}
          onChange={setRegion}
          placeholder="Geography"
          options={[["all", "All geographies"], ...ICP.regions.map((r): [string, string] => [r, `${REGION_META[r].flag} ${REGION_META[r].label}`])]}
        />
        <FilterSelect
          value={industry}
          onChange={setIndustry}
          placeholder="Industry"
          options={[["all", "All industries"], ...ICP.industries.map((i): [string, string] => [i, INDUSTRY_LABEL[i]])]}
        />
        <FilterSelect value={revenue} onChange={setRevenue} placeholder="Revenue" options={Object.entries(REV_LABEL)} />
        <FilterSelect value={pain} onChange={setPain} placeholder="Pain point" options={[["all", "All pain points"], ...painTags.map((p): [string, string] => [p, p])]} />
        <FilterSelect
          value={stage}
          onChange={setStage}
          placeholder="Stage"
          options={[["all", "All stages"], ...LEAD_STAGES.map((s): [string, string] => [s, STAGE_LABEL[s]])]}
        />
        {activeFilters > 0 && (
          <Button variant="ghost" size="sm" onClick={reset}>
            <X /> Clear ({activeFilters})
          </Button>
        )}
        <div className="w-full sm:ml-auto sm:w-auto">
          <LaunchCampaign className="w-full sm:w-auto" />
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        <span className="font-metric text-foreground">{filtered.length}</span> of {leads.length} leads
      </div>

      <div className="max-w-full min-w-0 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[1180px] text-left">
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
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16 text-center text-sm text-muted-foreground">
                  No leads match these filters.
                </td>
              </tr>
            )}
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-foreground/[0.04]">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 align-top">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <span className="font-metric text-xs text-muted-foreground">
          Page {pageCount === 0 ? 0 : pageIndex + 1} / {pageCount}
        </span>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" className="size-8" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon" className="size-8" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
