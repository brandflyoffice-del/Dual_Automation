"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Status = { n8n: "not_configured" | "unreachable" | "workflow_inactive" | "live"; detail: string; db: boolean; lastEventAt: string | null };

const COPY: Record<Status["n8n"], { label: string; dot: string; text: string }> = {
  live: { label: "Automation live", dot: "bg-emerald", text: "text-emerald" },
  workflow_inactive: { label: "Workflow not active", dot: "bg-amber-500", text: "text-amber-700" },
  unreachable: { label: "n8n unreachable", dot: "bg-rose-500", text: "text-rose-600" },
  not_configured: { label: "n8n not configured", dot: "bg-zinc-400", text: "text-muted-foreground" },
};

/** Sidebar health card: polls /api/system/status so the UI never claims automation is running when it is not. */
export function SystemStatus() {
  const [s, setS] = useState<Status | null>(null);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch("/api/system/status", { cache: "no-store" });
        if (!stop) setS(await r.json());
      } catch {
        if (!stop) setS({ n8n: "unreachable", detail: "Dashboard API unreachable", db: false, lastEventAt: null });
      }
    };
    load();
    const t = setInterval(load, 30000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  const c = s ? COPY[s.n8n] : null;
  return (
    <div className="rounded-lg border border-border bg-muted p-3 text-[11px] leading-relaxed text-muted-foreground">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-foreground">
        <span className="relative flex size-2">
          {s?.n8n === "live" && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald opacity-60" />}
          <span className={cn("relative inline-flex size-2 rounded-full", c?.dot ?? "bg-zinc-300 animate-pulse")} />
        </span>
        <span className={c?.text}>{c?.label ?? "Checking…"}</span>
      </div>
      {s ? s.detail : "Probing n8n and database…"}
      {s && !s.db && <div className="mt-1 text-rose-600">Database unreachable</div>}
    </div>
  );
}
