"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, RefreshCw, XCircle } from "lucide-react";
import type { HealthReport, ServiceHealth } from "@/lib/service-health";
import { cn } from "@/lib/utils";

/** Shared poller for /api/system/credits (the server caches checks for 15 minutes). */
export function useServiceHealth(everyMs = 10 * 60_000) {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async (refresh = false) => {
    if (refresh) setBusy(true);
    try {
      const r = await fetch(`/api/system/credits${refresh ? "?refresh=1" : ""}`, { cache: "no-store" });
      if (r.ok) setReport((await r.json()) as HealthReport);
    } catch {
      // keep the last report
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(() => load(), everyMs);
    return () => clearInterval(t);
  }, [load, everyMs]);
  return { report, busy, refresh: () => load(true) };
}

const isExternal = (href: string) => /^https?:/.test(href);

function FixLink({ s, className }: { s: ServiceHealth; className?: string }) {
  return isExternal(s.fix.href) ? (
    <a href={s.fix.href} target="_blank" rel="noopener noreferrer" className={cn("inline-flex items-center gap-1 font-medium hover:underline", className)}>
      {s.fix.label} <ExternalLink className="size-3" />
    </a>
  ) : (
    <Link href={s.fix.href} className={cn("font-medium hover:underline", className)}>
      {s.fix.label}
    </Link>
  );
}

/** Top-of-page banner: shown only when a paid service is out of credit, near its limit, or its key fails. */
export function ServiceAlerts() {
  const { report, busy, refresh } = useServiceHealth();
  const issues = (report?.services ?? []).filter((s) => s.level !== "ok").sort((a, b) => (a.level === "error" ? -1 : 1) - (b.level === "error" ? -1 : 1));
  if (!issues.length) return null;
  return (
    <div className="mb-4 space-y-2">
      {issues.map((s) => (
        <div
          key={s.service}
          role="alert"
          className={cn(
            "flex flex-col gap-2 rounded-xl border px-3 py-2.5 text-[13px] sm:flex-row sm:items-center sm:gap-3",
            s.level === "error" ? "border-rose-300 bg-rose-50 text-rose-900" : "border-amber-300 bg-amber-50 text-amber-900",
          )}
        >
          <div className="flex min-w-0 flex-1 items-start gap-2">
            {s.level === "error" ? <XCircle className="mt-0.5 size-4 shrink-0 text-rose-600" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />}
            <div className="min-w-0">
              <span className="font-semibold">{s.service}:</span> {s.detail}
              <div className="text-[11px] opacity-80">Affects: {s.affects}</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3 pl-6 text-xs sm:pl-0">
            <FixLink s={s} />
            <button type="button" onClick={refresh} disabled={busy} className="inline-flex items-center gap-1 opacity-80 hover:opacity-100">
              {busy ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />} Check again
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Settings > Integrations: every paid service with its status, Apify's monthly usage, and where to top up. */
export function CreditsPanel() {
  const { report, busy, refresh } = useServiceHealth(5 * 60_000);
  return (
    <div className="rounded-xl border border-border bg-card shadow-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
        <div>
          <div className="text-sm font-semibold">Credits & services</div>
          <div className="text-[11px] text-muted-foreground">
            {report ? `Checked ${new Date(report.checkedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}. ` : ""}A red or amber line also shows at the top of every page.
          </div>
        </div>
        <button type="button" onClick={refresh} disabled={busy} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-foreground/[0.04]">
          {busy ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />} Check now
        </button>
      </div>
      <div className="divide-y divide-border">
        {!report && (
          <div className="flex items-center gap-2 px-5 py-4 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Checking OpenAI, Apify, Smartlead and Cal.com…
          </div>
        )}
        {report?.services.map((s) => (
          <div key={s.service} className="grid gap-1 px-5 py-3 sm:grid-cols-[140px_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
            <div className="flex items-center gap-2 text-[13px] font-medium">
              {s.level === "ok" ? <CheckCircle2 className="size-4 text-emerald" /> : s.level === "warn" ? <AlertTriangle className="size-4 text-amber-600" /> : <XCircle className="size-4 text-rose-600" />}
              {s.service}
            </div>
            <div className="min-w-0 text-xs">
              <div className={cn(s.level === "error" ? "text-rose-700" : s.level === "warn" ? "text-amber-800" : "text-foreground")}>{s.detail}</div>
              {s.usage && s.usage.limitUsd > 0 && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-foreground/[0.08]">
                    <div
                      className={cn("h-full rounded-full", s.level === "error" ? "bg-rose-500" : s.level === "warn" ? "bg-amber-500" : "bg-emerald")}
                      style={{ width: `${Math.min(100, (s.usage.usedUsd / s.usage.limitUsd) * 100)}%` }}
                    />
                  </div>
                  {s.usage.resetsAt && <span className="text-[11px] text-muted-foreground">resets {new Date(s.usage.resetsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
                </div>
              )}
              <div className="text-[11px] text-muted-foreground">Used for: {s.affects}</div>
            </div>
            <FixLink s={s} className="text-xs text-emerald" />
          </div>
        ))}
      </div>
      <p className="border-t border-border px-5 py-2.5 text-[11px] text-muted-foreground">
        OpenAI does not share the account balance with apps, so it shows &quot;Credit available&quot; or &quot;Out of credit&quot;. See the exact balance on the OpenAI billing page.
      </p>
    </div>
  );
}
