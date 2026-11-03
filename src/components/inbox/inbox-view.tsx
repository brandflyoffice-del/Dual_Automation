"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Bot, ExternalLink, Inbox, Loader2, MailOpen, RefreshCw, Search, Send, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { SentimentBadge, StageBadge } from "@/components/badges";
import { cn, initials } from "@/lib/utils";
import type { InboxConversation, InboxMessage } from "@/lib/types";

type Filter = "replied" | "attention" | "interested" | "all";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "replied", label: "Replied" },
  { id: "attention", label: "Needs you" },
  { id: "interested", label: "Interested" },
  { id: "all", label: "All" },
];

const isInterested = (c: InboxConversation) =>
  c.sentiment === "Positive_Booking_Intent" || c.stage === "BOOKED" || /interested|meeting/i.test(c.category ?? "");
const matches = (c: InboxConversation, f: Filter) =>
  f === "all" ? true : f === "replied" ? !!c.repliedAt : f === "attention" ? c.needsHuman : isInterested(c);

const brandFor = (campaignId: string) => (campaignId === "4238487" ? "Expert in SEO" : "TapadiaTech");
const IST = "Asia/Kolkata";

function shortWhen(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: IST })
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: IST });
}
const fullWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: IST });

/** Original email HTML in a sandboxed frame (no scripts; links open in a new tab). Only used in the "View email" panel. */
function EmailFrame({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(400);
  const doc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'"><base target="_blank"><style>html,body{margin:0}body{font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2937;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{max-width:100%!important}</style></head><body>${html}</body></html>`;
  return (
    <iframe
      ref={ref}
      title="Email"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      srcDoc={doc}
      onLoad={() => {
        const d = ref.current?.contentDocument;
        if (d?.documentElement) setHeight(Math.min(3000, d.documentElement.scrollHeight + 8));
      }}
      style={{ height }}
      className="w-full rounded-md border border-border bg-white"
    />
  );
}

const LABEL: Record<InboxMessage["kind"], string> = { SEQUENCE: "Email", PROSPECT: "Reply", AI: "AI reply", TEAM: "You" };

function Bubble({ m, name, onView }: { m: InboxMessage; name: string; onView: (m: InboxMessage) => void }) {
  const ours = m.type === "SENT";
  const [open, setOpen] = useState(m.kind !== "SEQUENCE");
  const long = m.text.length > 320;
  return (
    <div className={cn("flex gap-2", ours ? "flex-row-reverse" : "flex-row")}>
      <span
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
          ours ? (m.kind === "AI" ? "bg-emerald/15 text-emerald" : "bg-indigo/10 text-indigo-700") : "bg-foreground/[0.07] text-foreground/70",
        )}
      >
        {ours ? m.kind === "AI" ? <Bot className="size-3.5" /> : "JT" : initials(name || m.from)}
      </span>
      <div className={cn("min-w-0 max-w-[85%] sm:max-w-[75%]", ours && "items-end")}>
        <div className={cn("mb-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground", ours && "justify-end")}>
          <span className="font-medium text-foreground/80">{m.kind === "SEQUENCE" ? `${LABEL.SEQUENCE}${m.step ? ` ${m.step}` : ""}` : ours ? LABEL[m.kind] : name || m.from}</span>
          <span>·</span>
          <span>{m.time ? fullWhen(m.time) : ""}</span>
        </div>
        <div
          className={cn(
            "rounded-2xl border px-3 py-2 text-[13px] leading-relaxed",
            ours ? "rounded-tr-sm border-emerald/20 bg-emerald/[0.06]" : "rounded-tl-sm border-border bg-card",
          )}
        >
          {m.kind === "SEQUENCE" && m.subject && <div className="mb-1 font-medium">{m.subject}</div>}
          <div className={cn("whitespace-pre-wrap break-words", !open && long && "line-clamp-4")}>{m.text || "(no text)"}</div>
          {(long || m.html) && (
            <div className="mt-1 flex gap-3 text-[11px]">
              {long && (
                <button type="button" onClick={() => setOpen((v) => !v)} className="font-medium text-emerald hover:underline">
                  {open ? "Show less" : "Show more"}
                </button>
              )}
              {m.html && (
                <button type="button" onClick={() => onView(m)} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                  <ExternalLink className="size-3" /> View email
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Composer({ c, onSent }: { c: InboxConversation; onSent: () => void }) {
  const first = (c.name || "").split(/\s+/)[0] || "there";
  const initial = `Hi ${first},\n\n\n\nWarm regards,\nJay T\n${brandFor(c.campaignId)}`;
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState(initial);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    setText(initial);
    setExpanded(false);
    setConfirm(false);
    setMsg(null);
  }, [c.key]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send() {
    if (!confirm) return setConfirm(true);
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/inbox/reply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ campaignId: c.campaignId, email: c.email, message: text }),
    }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { error?: string } | null;
    setBusy(false);
    setConfirm(false);
    if (r?.ok) {
      setMsg({ ok: true, text: "Sent in the same thread." });
      setText(initial);
      setExpanded(false);
      onSent();
    } else setMsg({ ok: false, text: j?.error || "Could not send. Try again." });
  }

  if (!expanded)
    return (
      <div className="flex items-center gap-2 border-t border-border bg-card px-3 py-2">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex-1 rounded-full border border-border bg-background px-3 py-1.5 text-left text-xs text-muted-foreground hover:border-emerald/40"
        >
          Write a reply yourself (the AI answers automatically)
        </button>
        {msg && <span className={cn("text-[11px]", msg.ok ? "text-emerald" : "text-destructive")}>{msg.text}</span>}
      </div>
    );
  return (
    <div className="border-t border-border bg-card p-2.5">
      <Textarea autoFocus value={text} onChange={(e) => { setText(e.target.value); setConfirm(false); }} rows={5} className="text-[13px]" />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className={cn("text-[11px]", msg ? (msg.ok ? "text-emerald" : "text-destructive") : "text-muted-foreground")}>
          {msg?.text ?? `To ${c.email}, from the same mailbox, in the same thread.`}
        </p>
        <div className="flex gap-1.5">
          <Button size="xs" variant="ghost" onClick={() => setExpanded(false)}>
            Cancel
          </Button>
          <Button size="xs" onClick={send} disabled={busy || text.trim().length < 2} variant={confirm ? "indigo" : "default"}>
            {busy ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
            {confirm ? "Click again to send" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function InboxView() {
  const [list, setList] = useState<InboxConversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("replied");
  const [campaign, setCampaign] = useState("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [thread, setThread] = useState<{ key: string; messages: InboxMessage[]; canReply: boolean; error?: string } | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [viewing, setViewing] = useState<InboxMessage | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/inbox", { cache: "no-store" }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { conversations?: InboxConversation[]; error?: string } | null;
    setLoading(false);
    setList(j?.conversations ?? []);
    setError(r?.ok ? null : j?.error || "Could not load the inbox");
  }, []);

  const loadThread = useCallback(async (c: InboxConversation) => {
    setThreadLoading(true);
    const r = await fetch(`/api/inbox/thread?campaignId=${c.campaignId}&email=${encodeURIComponent(c.email)}`, { cache: "no-store" }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { messages?: InboxMessage[]; canReply?: boolean; error?: string } | null;
    setThreadLoading(false);
    setThread({ key: c.key, messages: j?.messages ?? [], canReply: !!j?.canReply, error: r?.ok ? undefined : j?.error || "Could not load this thread" });
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [thread]);

  const campaigns = useMemo(() => {
    const m = new Map<string, string>();
    (list ?? []).forEach((c) => m.set(c.campaignId, c.campaignName));
    return [...m.entries()];
  }, [list]);
  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.id, (list ?? []).filter((c) => matches(c, f.id)).length])) as Record<Filter, number>,
    [list],
  );
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (list ?? []).filter(
      (c) =>
        matches(c, filter) &&
        (campaign === "all" || c.campaignId === campaign) &&
        (!needle || [c.name, c.email, c.company, c.subject].some((v) => (v ?? "").toLowerCase().includes(needle))),
    );
  }, [list, filter, campaign, q]);
  const current = (list ?? []).find((c) => c.key === selected) ?? null;

  function open(c: InboxConversation) {
    setSelected(c.key);
    setThread(null);
    loadThread(c);
  }

  return (
    <div className="grid h-[calc(100dvh-11rem)] min-h-[480px] overflow-hidden rounded-xl border border-border bg-card lg:h-[calc(100dvh-8.5rem)] lg:grid-cols-[320px_1fr]">
      {/* conversation list */}
      <div className={cn("flex min-h-0 flex-col border-border lg:border-r", current && "hidden lg:flex")}>
        <div className="space-y-2 border-b border-border p-2.5">
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-8 pl-8 text-xs" />
            </div>
            <Button size="icon" variant="outline" className="size-8" onClick={load} aria-label="Refresh" disabled={loading}>
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            </Button>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex flex-1 gap-0.5 rounded-md bg-foreground/[0.04] p-0.5">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "flex-1 rounded px-1 py-1 text-[11px] transition-colors",
                    filter === f.id ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.label}
                  <span className="ml-1 text-[10px] opacity-60">{counts[f.id] ?? 0}</span>
                </button>
              ))}
            </div>
          </div>
          {campaigns.length > 1 && (
            <Select value={campaign} onValueChange={setCampaign}>
              <SelectTrigger className="h-7 text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All campaigns</SelectItem>
                {campaigns.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {list === null ? (
            <div className="flex items-center justify-center gap-2 p-8 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading
            </div>
          ) : shown.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              <Inbox className="mx-auto mb-2 size-5 opacity-60" />
              {error ?? (filter === "replied" ? "No replies yet." : "Nothing here.")}
            </div>
          ) : (
            shown.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => open(c)}
                className={cn(
                  "flex w-full gap-2.5 border-b border-border/70 px-3 py-2.5 text-left transition-colors",
                  selected === c.key ? "bg-emerald/[0.07]" : "hover:bg-foreground/[0.03]",
                )}
              >
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06] text-[11px] font-semibold text-foreground/70">
                  {initials(c.name || c.email)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn("truncate text-[13px]", c.repliedAt ? "font-semibold" : "font-medium")}>{c.name || c.email}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{shortWhen(c.lastActivity)}</span>
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">{c.company || c.email}</span>
                  <span className="mt-0.5 block truncate text-xs">{c.subject}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1">
                    {c.needsHuman && <Badge variant="amber" className="px-1.5 py-0 text-[10px]">Needs you</Badge>}
                    {c.sentiment ? <SentimentBadge sentiment={c.sentiment} /> : c.repliedAt ? <Badge variant="emerald" className="px-1.5 py-0 text-[10px]">Replied</Badge> : <span className="text-[10px] text-muted-foreground">{c.stepsSent} sent</span>}
                    {c.bounced && <Badge variant="rose" className="px-1.5 py-0 text-[10px]">Bounced</Badge>}
                    {c.unsubscribed && <Badge variant="rose" className="px-1.5 py-0 text-[10px]">Unsubscribed</Badge>}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* thread */}
      <div className={cn("flex min-h-0 min-w-0 flex-col bg-background/60", !current && "hidden lg:flex")}>
        {!current ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-xs text-muted-foreground">
            <MailOpen className="size-6 opacity-60" />
            Pick a conversation.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2.5 border-b border-border bg-card px-3 py-2">
              <Button size="icon" variant="ghost" className="size-7 lg:hidden" onClick={() => setSelected(null)} aria-label="Back">
                <ArrowLeft className="size-4" />
              </Button>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald/10 text-emerald">
                <UserRound className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold">
                  {current.name || current.email}
                  {current.company ? <span className="font-normal text-muted-foreground"> · {current.company}</span> : null}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {current.email} · {current.campaignName}
                </div>
              </div>
              <div className="hidden items-center gap-1 sm:flex">
                {current.stage && <StageBadge stage={current.stage} />}
              </div>
              <Button size="icon" variant="ghost" className="size-7" onClick={() => loadThread(current)} disabled={threadLoading} aria-label="Refresh thread">
                <RefreshCw className={cn("size-3.5", threadLoading && "animate-spin")} />
              </Button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-4">
              {threadLoading && !thread ? (
                <div className="flex items-center justify-center gap-2 p-10 text-xs text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Loading the thread
                </div>
              ) : thread?.error ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">{thread.error}</div>
              ) : (
                <>
                  {(thread?.messages ?? []).map((m, i) => (
                    <Bubble key={`${m.time}-${i}`} m={m} name={current.name} onView={setViewing} />
                  ))}
                  {thread && !thread.canReply && (
                    <p className="text-center text-[11px] text-muted-foreground">No reply yet. The sequence keeps running until they answer.</p>
                  )}
                </>
              )}
              <div ref={bottom} />
            </div>

            {thread?.canReply && <Composer c={current} onSent={() => setTimeout(() => loadThread(current), 2500)} />}
          </>
        )}
      </div>

      <Sheet open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <SheetContent>
          <SheetTitle className="text-sm">{viewing?.subject || "Email"}</SheetTitle>
          <SheetDescription className="mb-3 text-xs">
            {viewing ? `${viewing.from} → ${viewing.to} · ${viewing.time ? fullWhen(viewing.time) : ""}` : ""}
          </SheetDescription>
          {viewing?.html ? <EmailFrame html={viewing.html} /> : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
