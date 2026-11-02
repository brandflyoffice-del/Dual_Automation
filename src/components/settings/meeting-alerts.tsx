"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarCheck2, Check, Eye, Loader2, Mail, Save, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EMAIL_RE } from "@/lib/settings-shared";
import { cn } from "@/lib/utils";

const MAX = 10;

const AGENDA_STEPS = [
  { title: "Open Google Calendar settings", text: "On a computer, open Google Calendar, click the gear icon, then Settings." },
  { title: "Pick your calendar", text: "Under “Settings for my calendars” on the left, click your own calendar." },
  { title: "Open “Other notifications”", text: "Scroll down to that block." },
  { title: "Set “Daily agenda” to Email", text: "Optional: also set “New events” to Email to get a mail for every new booking." },
];

export function MeetingAlerts() {
  const input = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState<string[] | null>(null);
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/settings/meeting-alerts")
      .then((r) => r.json())
      .then((d: { emails: string[] }) => {
        setSaved(d.emails);
        setEmails(d.emails);
      })
      .catch(() => toast.error("Could not load meeting alerts"));
  }, []);

  /** Adds every address in the text (comma, space or new line separated). Returns the new list, or null when something was invalid. */
  function add(text = draft): string[] | null {
    const parts = text
      .split(/[\s,;]+/)
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);
    if (!parts.length) return emails;
    const bad = parts.filter((p) => !EMAIL_RE.test(p));
    const next = [...emails];
    for (const p of parts) if (EMAIL_RE.test(p) && !next.includes(p) && next.length < MAX) next.push(p);
    setEmails(next);
    if (bad.length) {
      setDraft(bad.join(", "));
      setError(`${bad.length === 1 ? "This is" : "These are"} not a valid email: ${bad.join(", ")}`);
      return null;
    }
    if (parts.length + emails.length > MAX && next.length >= MAX) setError(`Up to ${MAX} people. Extra addresses were not added.`);
    else setError("");
    setDraft("");
    return next;
  }

  async function save() {
    const list = draft.trim() ? add() : emails;
    if (!list) return;
    setBusy(true);
    try {
      const res = await fetch("/api/settings/meeting-alerts", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ emails: list }) });
      const json = await res.json();
      if (!res.ok) return toast.error(json.error || "Could not save");
      setSaved(json.emails);
      setEmails(json.emails);
      toast.success("Saved. New bookings invite these people.");
    } catch (e) {
      toast.error("Network error", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (!saved) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading meeting alerts…
      </div>
    );
  }

  const dirty = saved.join() !== emails.join();

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader className="border-b border-border pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <span className="flex size-8 items-center justify-center rounded-lg bg-emerald/10 text-emerald">
                <Users className="size-4" />
              </span>
              Team invited to every meeting
            </CardTitle>
            <Badge variant={emails.length ? "emerald" : "outline"}>
              <span className="font-metric">
                {emails.length}/{MAX}
              </span>
              people
            </Badge>
          </div>
          <CardDescription>
            Each booked meeting is a Google Calendar event with a Google Meet link. People listed here are added as guests to every new booking.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div>
            <label htmlFor="alert-email" className="mb-1.5 block text-[13px] font-medium">
              Email addresses
            </label>
            <div
              onClick={() => input.current?.focus()}
              className={cn(
                "flex min-h-11 cursor-text flex-wrap items-center gap-1.5 rounded-md border bg-card px-2 py-1.5 transition-colors focus-within:ring-2",
                error ? "border-rose-500 focus-within:ring-rose-500/25" : "border-input focus-within:border-ring focus-within:ring-ring/30",
              )}
            >
              {emails.map((e) => (
                <span key={e} className="inline-flex max-w-full items-center gap-1 rounded-md border border-emerald/25 bg-emerald/[0.07] py-0.5 pl-2 pr-1 text-[12px] text-foreground">
                  <Mail className="size-3 shrink-0 text-emerald" />
                  <span className="truncate">{e}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${e}`}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setEmails(emails.filter((x) => x !== e));
                    }}
                    className="rounded p-0.5 text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              <input
                id="alert-email"
                ref={input}
                value={draft}
                type="text"
                inputMode="email"
                autoComplete="off"
                disabled={emails.length >= MAX}
                placeholder={emails.length >= MAX ? "List is full" : emails.length ? "Add another…" : "closer@company.com"}
                onChange={(e) => {
                  setDraft(e.target.value);
                  if (error) setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
                    if (!draft.trim()) return;
                    e.preventDefault();
                    add();
                  }
                  if (e.key === "Backspace" && !draft && emails.length) setEmails(emails.slice(0, -1));
                }}
                onPaste={(e) => {
                  const t = e.clipboardData.getData("text");
                  if (/[\s,;]/.test(t.trim())) {
                    e.preventDefault();
                    add(t);
                  }
                }}
                onBlur={() => draft.trim() && add()}
                className="h-7 min-w-40 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
              />
            </div>
            <p className={cn("mt-1.5 text-[11px]", error ? "text-rose-600" : "text-muted-foreground")}>
              {error || "Press Enter or comma after each address. You can paste several at once."}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { icon: Mail, text: "Gmail invite with a “Join with Google Meet” button" },
              { icon: CalendarCheck2, text: "The meeting in their own Google Calendar" },
              { icon: Check, text: "Updates when the time moves or it is cancelled" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-[12px] leading-snug">
                <Icon className="mt-0.5 size-3.5 shrink-0 text-emerald" />
                {text}
              </div>
            ))}
          </div>

          <div className="flex gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2.5 text-[12px] leading-relaxed text-amber-900">
            <Eye className="mt-0.5 size-4 shrink-0 text-amber-700" />
            <span>
              <span className="font-medium">The prospect can see these addresses</span> in the invite&apos;s guest list. Use work addresses you are happy to share. Changes apply to
              meetings booked after you save.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Button onClick={save} disabled={(!dirty && !draft.trim()) || busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Save />}
              Save changes
            </Button>
            <Button
              variant="secondary"
              disabled={!dirty || busy}
              onClick={() => {
                setEmails(saved);
                setDraft("");
                setError("");
              }}
            >
              Discard
            </Button>
            {!emails.length && <span className="text-[12px] text-muted-foreground">Nobody yet: only the connected Google account gets the meetings.</span>}
          </div>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-indigo/10 text-indigo">
              <CalendarCheck2 className="size-4" />
            </span>
            Morning email with today&apos;s meetings
          </CardTitle>
          <CardDescription>
            Google Calendar&apos;s own &ldquo;Daily agenda&rdquo; email lists the day&apos;s meetings with their Join links. Each person switches it on once in their own Google
            account; it takes a minute.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <ol className="relative space-y-4">
            {AGENDA_STEPS.map((s, i) => (
              <li key={s.title} className="relative flex gap-3">
                {i < AGENDA_STEPS.length - 1 && <span aria-hidden className="absolute left-[13px] top-7 h-[calc(100%-4px)] w-px bg-border" />}
                <span className="font-metric relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border border-indigo/30 bg-card text-[11px] font-semibold text-indigo">
                  {i + 1}
                </span>
                <span className="min-w-0 pt-0.5">
                  <span className="block text-[13px] font-medium">{s.title}</span>
                  <span className="block text-[12px] leading-snug text-muted-foreground">{s.text}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">Google sends the agenda at about 5 AM in each person&apos;s own time zone.</p>
        </CardContent>
      </Card>
    </div>
  );
}
