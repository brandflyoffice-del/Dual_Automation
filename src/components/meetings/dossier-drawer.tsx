"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  CloudUpload,
  ExternalLink,
  FileSpreadsheet,
  Globe,
  HelpCircle,
  Linkedin,
  Loader2,
  Mail,
  MailOpen,
  Video,
  XCircle,
} from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { PainTag, RegionBadge, ScoreChip, ServiceBadge } from "@/components/badges";
import { OutcomeSelect } from "./outcome-select";
import { CountdownBadge } from "./countdown";
import { formatDateTime, formatIst, formatRevenueBand, formatUsd, cn } from "@/lib/utils";
import { INDUSTRY_LABEL, REGION_META, SERVICE_META, type Industry, type MeetingStatus, type Region, type Service } from "@/lib/constants";
import type { MeetingRow } from "@/lib/types";

type SaveState = "idle" | "saving" | "saved" | "local" | "error";

function Finding({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-[13px]">
      {ok ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald" />
      ) : (
        <XCircle className="mt-0.5 size-4 shrink-0 text-rose-600" />
      )}
      <span className={ok ? "text-muted-foreground" : "text-foreground"}>{children}</span>
    </li>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <section className="border-b border-border px-6 py-5">
      <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3.5" />
        {title}
      </h3>
      {children}
    </section>
  );
}

export function DossierDrawer({
  meeting,
  open,
  onOpenChange,
  sheetUrl,
  onStatus,
  onNotes,
}: {
  meeting: MeetingRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  sheetUrl: string;
  onStatus: (id: string, s: MeetingStatus) => void;
  onNotes: (id: string, notes: string) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        {meeting ? (
          <DrawerBody key={meeting.id} meeting={meeting} sheetUrl={sheetUrl} onStatus={onStatus} onNotes={onNotes} />
        ) : (
          <>
            <SheetTitle className="sr-only">Meeting</SheetTitle>
            <SheetDescription className="sr-only">No meeting selected</SheetDescription>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({
  meeting: m,
  sheetUrl,
  onStatus,
  onNotes,
}: {
  meeting: MeetingRow;
  sheetUrl: string;
  onStatus: (id: string, s: MeetingStatus) => void;
  onNotes: (id: string, notes: string) => void;
}) {
  const [notes, setNotes] = useState(m.notes);
  const [save, setSave] = useState<SaveState>("idle");
  const lastSaved = useRef(m.notes);
  const a = m.audit;
  const service = m.service ? SERVICE_META[m.service as Service] : null;

  // Scratchpad: debounced auto-save → /api/meetings/:id → n8n → Google Sheet "Closer Notes"
  useEffect(() => {
    if (notes === lastSaved.current) return;
    setSave("saving");
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/meetings/${m.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ notes }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error("save failed");
        lastSaved.current = notes;
        onNotes(m.id, notes);
        setSave(json.n8n?.ok ? "saved" : "local");
      } catch {
        setSave("error");
      }
    }, 900);
    return () => clearTimeout(t);
  }, [notes, m.id, onNotes]);

  return (
    <>
      <div className="border-b border-border px-6 pb-5 pt-6">
        <div className="mb-3 flex flex-wrap items-center gap-2 pr-8">
          <CountdownBadge start={m.startTime} status={m.status} />
          <RegionBadge region={m.region} />
          <ServiceBadge service={m.service} />
          <Badge variant="emerald" className="font-metric">
            {formatUsd(m.estimatedTicket)}+ est.
          </Badge>
        </div>
        <SheetTitle className="text-xl font-semibold tracking-tight">{m.company}</SheetTitle>
        <SheetDescription className="mt-1 text-sm text-muted-foreground">
          {m.prospectName} · {m.role} · {formatRevenueBand(m.revenue)} revenue · {INDUSTRY_LABEL[m.industry as Industry]} ·{" "}
          {m.country}
        </SheetDescription>
        <div className="font-metric mt-3 space-y-0.5 text-xs text-muted-foreground">
          <div>{formatIst(m.startTime)}</div>
          <div className="text-muted-foreground/70">
            {formatDateTime(m.startTime, m.timezone)} {REGION_META[m.region as Region]?.label ?? ""} time
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button asChild disabled={!m.meetLink} className={!m.meetLink ? "pointer-events-none opacity-40" : ""}>
            <a href={m.meetLink ?? "#"} target="_blank" rel="noreferrer">
              <Video /> Join Google Meet
            </a>
          </Button>
          <Button asChild variant="secondary">
            <a href={sheetUrl} target="_blank" rel="noreferrer">
              <FileSpreadsheet className="text-emerald" /> Open Master Sheet
            </a>
          </Button>
          {m.calendarEventUrl && (
            <Button asChild variant="outline" size="icon" title="Open in Google Calendar">
              <a href={m.calendarEventUrl} target="_blank" rel="noreferrer" aria-label="Open in Google Calendar">
                <ExternalLink />
              </a>
            </Button>
          )}
          {m.linkedinUrl && (
            <Button asChild variant="outline" size="icon" title="LinkedIn">
              <a href={m.linkedinUrl} target="_blank" rel="noreferrer" aria-label="LinkedIn">
                <Linkedin />
              </a>
            </Button>
          )}
          {m.website && (
            <Button asChild variant="outline" size="icon" title="Website">
              <a href={m.website} target="_blank" rel="noreferrer" aria-label="Website">
                <Globe />
              </a>
            </Button>
          )}
          <div className="ml-auto">
            <OutcomeSelect value={m.status} onChange={(s) => onStatus(m.id, s)} />
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Section title="AI pre-call brief" icon={Bot}>
          <div className="mb-3 flex items-center justify-between">
            <PainTag>{m.painPoint}</PainTag>
            <ScoreChip score={m.score} />
          </div>
          <p className="text-sm leading-relaxed">{m.dossier?.summary ?? m.painPointDetail ?? "No brief generated yet."}</p>
          {m.dossier?.talkingPoints && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-[13px] text-muted-foreground">
              {m.dossier.talkingPoints.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Website audit — why they're struggling" icon={Globe}>
          {m.painPointDetail && <p className="mb-3 rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-[13px] leading-relaxed">{m.painPointDetail}</p>}
          {a ? (
            <ul className="space-y-2">
              {a.pageSpeedMobile !== undefined && (
                <Finding ok={a.pageSpeedMobile >= 70}>
                  Mobile PageSpeed <span className="font-metric">{a.pageSpeedMobile}/100</span>
                </Finding>
              )}
              {a.lcpSeconds !== undefined && (
                <Finding ok={a.lcpSeconds <= 2.5}>
                  Largest Contentful Paint <span className="font-metric">{a.lcpSeconds}s</span> (target ≤ 2.5s)
                </Finding>
              )}
              {a.hasMetaPixel !== undefined && <Finding ok={!!a.hasMetaPixel}>{a.hasMetaPixel ? "Meta Pixel detected" : "No Meta Pixel — ad retargeting & optimisation blind"}</Finding>}
              {a.hasGa4 !== undefined && <Finding ok={!!a.hasGa4}>{a.hasGa4 ? "GA4 tracking detected" : "No GA4 conversion tracking"}</Finding>}
              {a.securityHeaders && (
                <Finding ok={!!a.securityHeaders.hsts && !!a.securityHeaders.csp}>
                  Security headers — HSTS {a.securityHeaders.hsts ? "✓" : "missing"}, CSP {a.securityHeaders.csp ? "✓" : "missing"}
                </Finding>
              )}
              {a.techStack && a.techStack.length > 0 && (
                <li className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                  Stack:
                  {a.techStack.map((t) => (
                    <Badge key={t} variant="outline">
                      {t}
                    </Badge>
                  ))}
                </li>
              )}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No audit data stored for this prospect.</p>
          )}
        </Section>

        <Section title="3 discovery questions" icon={HelpCircle}>
          <ol className="space-y-2.5">
            {(m.dossier?.discoveryQuestions ?? []).slice(0, 3).map((q, i) => (
              <li key={q} className="flex gap-3 text-sm">
                <span className="font-metric flex size-5 shrink-0 items-center justify-center rounded-md bg-indigo/15 text-[11px] text-indigo-700">{i + 1}</span>
                {q}
              </li>
            ))}
            {!m.dossier?.discoveryQuestions?.length && <li className="text-sm text-muted-foreground">No questions generated.</li>}
          </ol>
          {service && <p className="mt-3 text-[11px] text-muted-foreground">Pitch pillar: {service.label} — {service.stack}</p>}
        </Section>

        <Section title="Email thread they replied to" icon={Mail}>
          <div className="space-y-3">
            {m.thread.length === 0 && <p className="text-sm text-muted-foreground">No thread captured yet.</p>}
            {m.thread.map((t) => (
              <article
                key={t.id}
                className={cn(
                  "rounded-lg border p-3.5",
                  t.direction === "in" ? "border-emerald/30 bg-emerald/[0.06]" : "border-border bg-card",
                )}
              >
                <header className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  {t.direction === "in" ? <MailOpen className="size-3.5 text-emerald" /> : <Mail className="size-3.5" />}
                  <span className="font-medium text-foreground">
                    {t.direction === "in" ? `${m.prospectName} replied` : t.kind === "AI_REPLY" ? "BrandFly AI reply" : `Email ${t.step ?? ""} sent`}
                  </span>
                  {t.kind === "AI_REPLY" && <Badge variant="indigo">AI</Badge>}
                  {t.needsHuman && (
                    <Badge variant="amber">
                      <AlertTriangle /> needs human
                    </Badge>
                  )}
                  <span className="font-metric ml-auto">{formatIst(t.at)}</span>
                </header>
                {t.subject && <div className="mb-1 text-[13px] font-medium">{t.subject}</div>}
                <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-muted-foreground">{t.body}</pre>
              </article>
            ))}
          </div>
        </Section>

        <Section title="Live scratchpad" icon={CloudUpload}>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Meeting notes, objections, next steps… auto-syncs to the Master Google Sheet (Closer Notes) via n8n."
            className="min-h-40 font-mono text-[13px]"
          />
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {save === "saving" && (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Saving…
              </>
            )}
            {save === "saved" && (
              <>
                <CheckCircle2 className="size-3.5 text-emerald" /> Saved · Google Sheet sync sent via n8n
              </>
            )}
            {save === "local" && (
              <>
                <AlertTriangle className="size-3.5 text-amber-700" /> Saved in dashboard · n8n not reachable, sheet will not update until it is
              </>
            )}
            {save === "error" && (
              <>
                <XCircle className="size-3.5 text-rose-600" /> Could not save — keep this tab open and retry
              </>
            )}
            {save === "idle" && "Auto-saves as you type."}
          </div>
        </Section>
      </div>
    </>
  );
}
