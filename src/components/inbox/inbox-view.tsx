"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Inbox, Loader2, MailOpen, RefreshCw, Search, Send, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SentimentBadge, StageBadge } from "@/components/badges";
import { cn, formatIst, initials } from "@/lib/utils";
import type { InboxConversation, InboxMessage } from "@/lib/types";

type Filter = "replied" | "attention" | "interested" | "all";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "replied", label: "Replied" },
  { id: "attention", label: "Needs you" },
  { id: "interested", label: "Interested" },
  { id: "all", label: "All sent" },
];

const isInterested = (c: InboxConversation) =>
  c.sentiment === "Positive_Booking_Intent" || c.stage === "BOOKED" || /interested|meeting/i.test(c.category ?? "");
const matches = (c: InboxConversation, f: Filter) =>
  f === "all" ? true : f === "replied" ? !!c.repliedAt : f === "attention" ? c.needsHuman : isInterested(c);

const brandFor = (campaignId: string) => (campaignId === "4238487" ? "Expert in SEO" : "TapadiaTech");

function when(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

/**
 * Renders one email's HTML in a sandboxed frame: no scripts can run, links open in a new tab, and the frame grows to
 * the content height. Email HTML is untrusted, so it never touches the dashboard page itself.
 */
function EmailFrame({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(80);
  const doc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; font-src https: data:"><base target="_blank"><style>html,body{margin:0;padding:0}body{font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#1f2937;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{max-width:100%!important}p{margin:0 0 12px}</style></head><body>${html}</body></html>`;
  const fit = () => {
    const d = ref.current?.contentDocument;
    if (d?.documentElement) setHeight(Math.min(4000, Math.max(40, d.documentElement.scrollHeight)));
  };
  return (
    <iframe
      ref={ref}
      title="Email"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      srcDoc={doc}
      onLoad={fit}
      style={{ height }}
      className="w-full rounded-md border-0 bg-white"
    />
  );
}

function Message({ m, name }: { m: InboxMessage; name: string }) {
  const [showQuote, setShowQuote] = useState(false);
  const mine = m.type === "SENT";
  const label = mine ? (m.step ? `Sequence email ${m.step}` : "Our reply in thread") : "Prospect reply";
  return (
    <div className={cn("rounded-lg border p-3 sm:p-4", mine ? "border-border bg-card" : "border-emerald/30 bg-emerald/[0.04]")}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", mine ? "bg-indigo/10 text-indigo-700" : "bg-emerald/15 text-emerald")}>
            {mine ? "JT" : initials(name || m.from)}
          </span>
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground">{mine ? m.from : name || m.from}</div>
            <div className="truncate text-muted-foreground">to {m.to}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={mine ? "outline" : "emerald"}>{label}</Badge>
          <span className="text-muted-foreground">{m.time ? formatIst(m.time) : ""}</span>
        </div>
      </div>
      {m.subject && mine && m.step ? <div className="mb-2 text-[13px] font-medium">{m.subject}</div> : null}
      <EmailFrame html={m.html} />
      {m.quoteHtml && (
        <div className="mt-2">
          <button type="button" onClick={() => setShowQuote((v) => !v)} className="rounded bg-foreground/[0.06] px-2 py-0.5 text-xs text-muted-foreground hover:bg-foreground/[0.1]">
            {showQuote ? "Hide quoted text" : "•••  Show quoted text"}
          </button>
          {showQuote && (
            <div className="mt-2 border-l-2 border-border pl-3 opacity-80">
              <EmailFrame html={m.quoteHtml} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Composer({ c, onSent }: { c: InboxConversation; onSent: () => void }) {
  const first = (c.name || "").split(/\s+/)[0] || "there";
  const initial = `Hi ${first},\n\n\n\nWarm regards,\nJay T\n${brandFor(c.campaignId)}`;
  const [text, setText] = useState(initial);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    setText(initial);
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
      setMsg({ ok: true, text: "Sent in the same thread. It shows up here within a minute." });
      setText(initial);
      onSent();
    } else setMsg({ ok: false, text: j?.error || "Could not send. Try again." });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>Reply to {c.email} (same thread, from the same mailbox)</span>
      </div>
      <Textarea value={text} onChange={(e) => { setText(e.target.value); setConfirm(false); }} rows={7} className="text-[13px]" />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className={cn("text-xs", msg ? (msg.ok ? "text-emerald" : "text-destructive") : "text-muted-foreground")}>
          {msg?.text ?? "The AI answers automatically. Write here only when you want to step in yourself."}
        </p>
        <Button size="sm" onClick={send} disabled={busy || text.trim().length < 2} variant={confirm ? "indigo" : "default"}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          {confirm ? "Click again to send" : "Send reply"}
        </Button>
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
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/inbox", { cache: "no-store" }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { conversations?: InboxConversation[]; error?: string } | null;
    setLoading(false);
    setList(j?.conversations ?? []);
    setError(r?.ok ? null : j?.error || "Could not load the inbox");
    setUpdatedAt(new Date());
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
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const campaigns = useMemo(() => {
    const m = new Map<string, string>();
    (list ?? []).forEach((c) => m.set(c.campaignId, c.campaignName));
    return [...m.entries()];
  }, [list]);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, (list ?? []).filter((c) => matches(c, f.id)).length])) as Record<Filter, number>, [list]);

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
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      {/* conversation list */}
      <div className={cn("flex min-h-0 flex-col rounded-xl border border-border bg-card", current && "hidden lg:flex")}>
        <div className="space-y-2 border-b border-border p-3">
          <div className="flex gap-1 overflow-x-auto">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  "shrink-0 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                  filter === f.id ? "bg-emerald/10 font-medium text-emerald" : "text-muted-foreground hover:bg-foreground/[0.05]",
                )}
              >
                {f.label} <span className="ml-0.5 opacity-70">{counts[f.id] ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, company" className="h-8 pl-8 text-xs" />
            </div>
            <Button size="icon" variant="outline" className="size-8" onClick={load} aria-label="Refresh" disabled={loading}>
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            </Button>
          </div>
          <Select value={campaign} onValueChange={setCampaign}>
            <SelectTrigger className="h-8 text-xs">
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
        </div>
        <div className="max-h-[70vh] flex-1 overflow-y-auto lg:max-h-[calc(100vh-260px)]">
          {list === null ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading conversations from Smartlead
            </div>
          ) : shown.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Inbox className="mx-auto mb-2 size-6 opacity-60" />
              {error ?? (filter === "replied" ? "No replies yet. They appear here as soon as Smartlead sees them." : "Nothing here yet.")}
            </div>
          ) : (
            shown.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => open(c)}
                className={cn(
                  "block w-full border-b border-border px-3 py-2.5 text-left transition-colors last:border-b-0",
                  selected === c.key ? "bg-emerald/[0.07]" : "hover:bg-foreground/[0.03]",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("truncate text-[13px]", c.repliedAt ? "font-semibold" : "font-medium")}>{c.name || c.email}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{when(c.lastActivity)}</span>
                </div>
                <div className="truncate text-xs text-muted-foreground">{c.company ? `${c.company} · ` : ""}{c.email}</div>
                <div className="mt-0.5 truncate text-xs">{c.subject}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  {c.repliedAt ? <Badge variant="emerald">Replied</Badge> : <Badge variant="outline">{c.stepsSent} sent</Badge>}
                  {c.needsHuman && <Badge variant="amber">Needs you</Badge>}
                  {c.bounced && <Badge variant="rose">Bounced</Badge>}
                  {c.unsubscribed && <Badge variant="rose">Unsubscribed</Badge>}
                  {c.sentiment && <SentimentBadge sentiment={c.sentiment} />}
                  <span className="truncate text-[10px] text-muted-foreground">{c.campaignName}</span>
                </div>
              </button>
            ))
          )}
        </div>
        <div className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
          {updatedAt ? `Updated ${updatedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · refreshes every minute` : "Live from Smartlead"}
        </div>
      </div>

      {/* thread */}
      <div className={cn("min-w-0 rounded-xl border border-border bg-background/50", !current && "hidden lg:block")}>
        {!current ? (
          <div className="flex h-full min-h-80 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <MailOpen className="size-7 opacity-60" />
            Pick a conversation to read the whole thread and reply.
          </div>
        ) : (
          <div className="flex flex-col gap-3 p-3 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-card p-3">
              <div className="flex min-w-0 items-center gap-3">
                <Button size="icon" variant="ghost" className="size-8 lg:hidden" onClick={() => setSelected(null)} aria-label="Back">
                  <ArrowLeft className="size-4" />
                </Button>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald/10 text-emerald">
                  <UserRound className="size-4" />
                </span>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{current.name || current.email}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {current.email}
                    {current.company ? ` · ${current.company}` : ""}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">{current.campaignName}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {current.stage && <StageBadge stage={current.stage} />}
                {current.sentiment && <SentimentBadge sentiment={current.sentiment} />}
                <Button size="xs" variant="outline" onClick={() => loadThread(current)} disabled={threadLoading}>
                  <RefreshCw className={cn("size-3", threadLoading && "animate-spin")} /> Refresh
                </Button>
              </div>
            </div>

            {threadLoading && !thread ? (
              <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading the thread
              </div>
            ) : thread?.error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{thread.error}</div>
            ) : (
              <>
                {(thread?.messages ?? []).map((m, i) => (
                  <Message key={`${m.time}-${i}`} m={m} name={current.name} />
                ))}
                {thread?.canReply ? (
                  <Composer c={current} onSent={() => setTimeout(() => loadThread(current), 4000)} />
                ) : thread ? (
                  <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                    No reply from the prospect yet, so the sequence is still running. Once they reply, the AI answers here in the same thread and you can step in.
                  </p>
                ) : null}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
