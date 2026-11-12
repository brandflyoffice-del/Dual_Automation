"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, Check, ChevronDown, ChevronUp, ExternalLink, Loader2, Rocket, X } from "lucide-react";
import { OUTREACH_CAMPAIGNS } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Run = {
  id: string;
  name: string;
  provider: string;
  campaignId: string | null;
  target: number;
  stage: string;
  found: number;
  passed: number;
  writing: number;
  qualified: number;
  removed?: number;
  matched?: number;
  known?: number;
  added: number;
  status: "running" | "done" | "failed";
  message: string;
  startedAt: string;
  finishedAt: string | null;
};

const ORDER = ["searching", "filtering", "checking", "writing", "adding", "done"];
const DISMISS_KEY = "fenebris.launchDismissed";

function readDismissed(): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(DISMISS_KEY) || "[]") as string[];
  } catch {
    return [];
  }
}

function steps(r: Run) {
  const via = r.provider === "apify" ? "Apify" : "AI Ark";
  return [
    { label: `Searching ${via} for decision makers`, detail: r.found ? `${r.found} people found${r.target ? ` (target ${r.target})` : ""}` : `Target ${r.target} leads` },
    {
      label: "Filtering to your places, roles and sizes",
      detail: r.matched
        ? `${r.matched} matched${r.known ? ` · ${r.known} already in your list` : ""}`
        : r.passed
          ? `${r.passed} passed`
          : r.found
            ? `Checking ${r.found} people`
            : "",
    },
    {
      label: "Checking emails and websites",
      detail: [r.writing ? `${r.writing} websites read` : r.passed ? `${r.passed} leads` : "", r.removed ? `${r.removed} removed: email domain does not accept mail` : ""].filter(Boolean).join(" · "),
    },
    { label: "AI finding pain points and writing emails", detail: r.qualified ? `${r.qualified} qualified` : r.writing ? `${r.writing} leads` : "" },
    { label: "Adding to Smartlead and your dashboard", detail: r.added ? `${r.added} added` : r.qualified ? `${r.qualified} to add` : "" },
  ];
}

/** Floating card that follows a Launch run through n8n stage by stage, on every page, without blocking anything. */
export function LaunchProgress() {
  const [run, setRun] = useState<Run | null>(null);
  const [open, setOpen] = useState(true);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const last = useRef<Record<string, string>>({});

  const load = useCallback(async () => {
    const r = await fetch("/api/launch/runs", { cache: "no-store" }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { runs?: Run[] } | null;
    const latest = j?.runs?.[0] ?? null;
    if (latest) {
      const before = last.current[latest.id];
      if (before === "running" && latest.status !== "running") {
        const camp = OUTREACH_CAMPAIGNS.find((c) => c.id === latest.campaignId)?.name ?? "your campaign";
        if (latest.status === "failed") toast.error("Launch failed", { description: latest.message || "The launch stopped with an error.", duration: 20000 });
        else if (latest.added > 0) toast.success("Campaign ready", { description: `${latest.added} new leads added to ${camp}, each with its own emails.`, duration: 12000 });
        else toast.warning("No new leads", { description: latest.message || "No new leads this time.", duration: 15000 });
      }
      last.current[latest.id] = latest.status;
    }
    setRun(latest);
  }, []);

  useEffect(() => {
    setDismissed(readDismissed());
    load();
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/events");
      es.onmessage = () => load();
    } catch {}
    const onStart = () => {
      setOpen(true);
      setTimeout(load, 500);
    };
    window.addEventListener("launch:started", onStart);
    return () => {
      es?.close();
      window.removeEventListener("launch:started", onStart);
    };
  }, [load]);

  // Poll quickly while a run is going, slowly otherwise.
  useEffect(() => {
    const t = setInterval(load, run?.status === "running" ? 4000 : 30000);
    return () => clearInterval(t);
  }, [load, run?.status]);

  if (!run || dismissed.includes(run.id)) return null;
  // A finished run stays visible for 10 minutes so the result can be read.
  if (run.status !== "running" && run.finishedAt && Date.now() - new Date(run.finishedAt).getTime() > 10 * 60_000) return null;

  // A finished run keeps the stage it stopped at: only the steps it really passed are ticked.
  const idx = run.stage === "done" ? 5 : Math.max(0, ORDER.indexOf(run.stage));
  const outcome = run.status === "running" ? "running" : run.status === "failed" ? "failed" : run.added > 0 ? "ready" : "empty";
  const list = steps(run);
  const pct = Math.round((Math.min(idx, 5) / 5) * 100);
  const camp = OUTREACH_CAMPAIGNS.find((c) => c.id === run.campaignId);

  function dismiss() {
    if (!run) return;
    const next = [...dismissed, run.id].slice(-20);
    setDismissed(next);
    try {
      window.localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    } catch {}
  }

  return (
    <div className="fixed bottom-20 right-3 z-40 w-[calc(100vw-1.5rem)] max-w-[340px] overflow-hidden rounded-xl border border-border bg-card shadow-xl lg:bottom-4 lg:right-4">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        {outcome === "running" ? (
          <Loader2 className="size-4 animate-spin text-emerald" />
        ) : outcome === "ready" ? (
          <Check className="size-4 text-emerald" />
        ) : outcome === "empty" ? (
          <AlertTriangle className="size-4 text-amber-600" />
        ) : (
          <X className="size-4 text-rose-600" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold">
            {outcome === "running" ? "Campaign launching" : outcome === "ready" ? "Campaign ready" : outcome === "empty" ? "No new leads" : "Launch failed"}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {run.name || camp?.name || "Lead search"} · {run.provider === "apify" ? "Apify" : "AI Ark"}
          </div>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} className="rounded p-1 text-muted-foreground hover:bg-foreground/[0.05]" aria-label={open ? "Collapse" : "Expand"}>
          {open ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
        </button>
        {run.status !== "running" && (
          <button type="button" onClick={dismiss} className="rounded p-1 text-muted-foreground hover:bg-foreground/[0.05]" aria-label="Close">
            <X className="size-4" />
          </button>
        )}
      </div>
      <div className="h-1 bg-foreground/[0.06]">
        <div
          className={cn("h-full transition-all duration-700", outcome === "failed" ? "bg-rose-500" : outcome === "empty" ? "bg-amber-500" : "bg-emerald")}
          style={{ width: `${outcome === "failed" || outcome === "empty" ? 100 : pct}%` }}
        />
      </div>
      {open && (
        <div className="space-y-2 px-3 py-3">
          <ol className="space-y-2">
            {list.map((s, i) => {
              const state = i < idx ? "done" : i === idx ? (outcome === "running" ? "now" : outcome === "failed" ? "error" : outcome === "empty" ? "stopped" : "done") : "todo";
              return (
                <li key={s.label} className="flex gap-2">
                  <span
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full",
                      state === "done" ? "bg-emerald text-white" : state === "now" ? "text-emerald" : state === "error" ? "bg-rose-500 text-white" : state === "stopped" ? "bg-amber-500 text-white" : "border border-border",
                    )}
                  >
                    {state === "done" ? <Check className="size-3" /> : state === "now" ? <Loader2 className="size-4 animate-spin" /> : state === "error" ? <X className="size-3" /> : state === "stopped" ? <AlertTriangle className="size-2.5" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block text-xs", state === "todo" ? "text-muted-foreground" : "font-medium text-foreground")}>{s.label}</span>
                    {state !== "todo" && s.detail && <span className="block text-[11px] text-muted-foreground">{s.detail}</span>}
                    {state === "todo" && outcome !== "running" && <span className="block text-[11px] text-muted-foreground">Not reached</span>}
                  </span>
                </li>
              );
            })}
          </ol>
          {outcome === "failed" && (
            <div className="rounded-lg bg-rose-500/[0.07] px-2.5 py-2 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-rose-700">
                <X className="size-3.5" /> Launch failed
              </div>
              <div className="mt-0.5 text-foreground/80">{run.message || "The launch stopped with an error."}</div>
              <Link href="/settings?tab=integrations" className="mt-2 inline-block font-medium text-rose-700 hover:underline">
                Check API keys in Settings
              </Link>
            </div>
          )}
          {outcome === "empty" && (
            <div className="rounded-lg bg-amber-500/[0.08] px-2.5 py-2 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-amber-700">
                <AlertTriangle className="size-3.5" /> No new leads this time
              </div>
              {run.message && <div className="mt-0.5 text-foreground/80">{run.message}</div>}
            </div>
          )}
          {outcome === "ready" && (
            <div className="rounded-lg bg-emerald/[0.06] px-2.5 py-2 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-emerald">
                <Rocket className="size-3.5" /> {`${run.added} new leads added`}
              </div>
              <div className="mt-2 flex gap-2">
                <Link href="/leads" className="font-medium text-emerald hover:underline">
                  View leads
                </Link>
                {camp && (
                  <a href={`https://app.smartlead.ai/app/email-campaign/${camp.id}/analytics`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                    <ExternalLink className="size-3" /> Open in Smartlead
                  </a>
                )}
              </div>
            </div>
          )}
          {run.status === "running" && <p className="text-[11px] text-muted-foreground">You can keep working. This card updates on its own and tells you when it is done.</p>}
        </div>
      )}
    </div>
  );
}
