"use client";

import { useState } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { Download, FileSpreadsheet, FileText, FileType2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Dataset = "leads" | "emails" | "meetings";

const DATASETS: { id: Dataset; label: string; scopes: { id: string; label: string }[] }[] = [
  {
    id: "leads",
    label: "Leads",
    scopes: [
      { id: "all", label: "All leads" },
      { id: "contacted", label: "Emailed" },
      { id: "replied", label: "Replied" },
      { id: "interested", label: "Interested" },
      { id: "booked", label: "Meeting booked" },
      { id: "not_contacted", label: "Not emailed yet" },
    ],
  },
  {
    id: "emails",
    label: "Email activity",
    scopes: [
      { id: "7", label: "Last 7 days" },
      { id: "30", label: "Last 30 days" },
      { id: "90", label: "Last 90 days" },
      { id: "all", label: "All time" },
    ],
  },
  {
    id: "meetings",
    label: "Meetings",
    scopes: [
      { id: "upcoming", label: "Upcoming" },
      { id: "past", label: "Past" },
      { id: "all", label: "All" },
    ],
  },
];

const FORMATS = [
  { id: "csv", label: "CSV", hint: "Excel / Google Sheets", icon: FileSpreadsheet },
  { id: "pdf", label: "PDF", hint: "To share or print", icon: FileType2 },
  { id: "md", label: "Markdown", hint: "Docs / Notion", icon: FileText },
] as const;

/** Export button: pick what (leads, email activity, meetings), which rows, and the file type. Downloads straight away. */
export function ExportMenu({ dataset = "leads", className }: { dataset?: Dataset; className?: string }) {
  const [open, setOpen] = useState(false);
  const [what, setWhat] = useState<Dataset>(dataset);
  const ds = DATASETS.find((d) => d.id === what)!;
  const [scope, setScope] = useState<Record<Dataset, string>>({ leads: "all", emails: "30", meetings: "upcoming" });

  function download(format: string) {
    const a = document.createElement("a");
    a.href = `/api/export?dataset=${what}&scope=${encodeURIComponent(scope[what])}&format=${format}`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setOpen(false);
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <Download className="size-3.5" /> Export
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align="end" sideOffset={6} className="z-50 w-[300px] rounded-xl border border-border bg-card p-3 shadow-lg">
          <div className="mb-2 text-xs font-medium text-muted-foreground">What to export</div>
          <div className="mb-3 grid grid-cols-3 gap-1 rounded-md bg-foreground/[0.04] p-0.5">
            {DATASETS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setWhat(d.id)}
                className={cn("rounded px-1 py-1.5 text-[11px]", what === d.id ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div className="mb-2 text-xs font-medium text-muted-foreground">Which</div>
          <div className="mb-3 flex flex-wrap gap-1">
            {ds.scopes.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setScope((p) => ({ ...p, [what]: s.id }))}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px]",
                  scope[what] === s.id ? "border-emerald/40 bg-emerald/10 font-medium text-emerald" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="mb-2 text-xs font-medium text-muted-foreground">Download as</div>
          <div className="grid gap-1.5">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => download(f.id)}
                className="flex items-center gap-2.5 rounded-lg border border-border px-2.5 py-2 text-left hover:border-emerald/40 hover:bg-emerald/[0.04]"
              >
                <f.icon className="size-4 text-emerald" />
                <span className="text-[13px] font-medium">{f.label}</span>
                <span className="ml-auto text-[11px] text-muted-foreground">{f.hint}</span>
              </button>
            ))}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
