"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useServiceHealth } from "@/components/service-alerts";
import Link from "next/link";

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
  // A paid service out of credit stops the automation too, even when n8n itself is up.
  const { report } = useServiceHealth();
  const down = (report?.services ?? []).filter((x) => x.level === "error");
  const low = (report?.services ?? []).filter((x) => x.level === "warn");

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
  if (s?.n8n === "live" && (down.length || low.length)) {
    const bad = down.length > 0;
    return (
      <Link href="/settings?tab=integrations" className={cn("block rounded-lg border p-3 text-[11px] leading-relaxed", bad ? "border-rose-300 bg-rose-50 text-rose-900" : "border-amber-300 bg-amber-50 text-amber-900")}>
        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium">
          <span className={cn("inline-flex size-2 rounded-full", bad ? "bg-rose-500" : "bg-amber-500")} />
          {bad ? "Action needed" : "Running low"}
        </div>
        {(bad ? down : low).map((x) => (
          <div key={x.service}>
            {x.service}: {x.detail.split(":")[0]}
          </div>
        ))}
        <div className="mt-1 underline">Open Credits & services</div>
      </Link>
    );
  }
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
