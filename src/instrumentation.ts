// Runs once when the dashboard server starts. In production it starts the live reply watch for every sending mailbox
// and the timer that starts mailboxes again after "Stop for today" (Email Analytics).
// Local development never watches (it would read the real mailboxes); MAILBOX_WATCH=off turns the watch off in production too.
// The imports sit inside the NEXT_RUNTIME check so the mail libraries are never bundled for the edge runtime.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NODE_ENV !== "production") return;
    const { startPauseTimer } = await import("./lib/mailbox-control");
    startPauseTimer();
    if (process.env.MAILBOX_WATCH === "off") return;
    const { startMailboxWatch } = await import("./lib/mailbox-watch");
    startMailboxWatch();
  }
}
