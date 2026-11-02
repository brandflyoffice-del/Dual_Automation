"use client";

import { useEffect, useState } from "react";
import { CalendarCheck2, Loader2, Mail, Plus, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EMAIL_RE } from "@/lib/settings-shared";

export function MeetingAlerts() {
  const [saved, setSaved] = useState<string[] | null>(null);
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
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

  function add() {
    const e = draft.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) return toast.error("That is not a valid email");
    if (emails.includes(e)) return setDraft("");
    if (emails.length >= 10) return toast.error("Up to 10 people");
    setEmails([...emails, e]);
    setDraft("");
  }

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/settings/meeting-alerts", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ emails }) });
      const json = await res.json();
      if (!res.ok) return toast.error(json.error || "Could not save");
      setSaved(json.emails);
      setEmails(json.emails);
      toast.success("Saved. New bookings invite these people.");
    } finally {
      setBusy(false);
    }
  }

  const dirty = !!saved && saved.join() !== emails.join();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-4 text-emerald" /> Team members invited to every meeting
          </CardTitle>
          <CardDescription>
            Each booked meeting is a Google Calendar event with a Google Meet link. People listed here are added as guests, so they get the Gmail invitation with a
            &ldquo;Join with Google Meet&rdquo; button and the meeting appears in their own Google Calendar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={draft}
              type="email"
              placeholder="closer@company.com"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
            />
            <Button variant="secondary" onClick={add} disabled={!draft.trim()}>
              <Plus />
              Add
            </Button>
          </div>
          <div className="flex min-h-9 flex-wrap gap-1.5">
            {emails.length === 0 && <span className="text-sm text-muted-foreground">Nobody yet. Only the connected Google account gets the meetings.</span>}
            {emails.map((e) => (
              <span key={e} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs">
                {e}
                <button type="button" aria-label={`Remove ${e}`} onClick={() => setEmails(emails.filter((x) => x !== e))} className="text-muted-foreground hover:text-foreground">
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">The prospect also sees these addresses in the guest list of the invite. Applies to meetings booked after you save.</p>
          <Button onClick={save} disabled={!dirty || busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Save />}
            Save
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck2 className="size-4 text-emerald" /> Morning email with today&apos;s meetings
          </CardTitle>
          <CardDescription>
            Google Calendar can email each person a list of the day&apos;s meetings every morning, with the Join links. This is Google&apos;s own &ldquo;Daily agenda&rdquo;
            email; each person switches it on once in their own Google account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-foreground">
            <li>Open Google Calendar on a computer and click the gear icon, then Settings.</li>
            <li>Under &ldquo;Settings for my calendars&rdquo;, click your calendar.</li>
            <li>Open &ldquo;Other notifications&rdquo;.</li>
            <li>Set &ldquo;Daily agenda&rdquo; to Email. Also set &ldquo;New events&rdquo; to Email if you want a mail for every new booking.</li>
          </ol>
          <p className="mt-3 text-[11px] text-muted-foreground">Google sends the agenda at about 5 AM in each person&apos;s own time zone.</p>
        </CardContent>
      </Card>
    </div>
  );
}
