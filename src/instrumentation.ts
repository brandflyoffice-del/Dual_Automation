// Runs once when the dashboard server starts. In production it starts the live reply watch for every sending mailbox.
// Local development never watches (it would read the real mailboxes); MAILBOX_WATCH=off turns it off in production too.
// The import sits inside the NEXT_RUNTIME check so the mail libraries are never bundled for the edge runtime.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NODE_ENV !== "production" || process.env.MAILBOX_WATCH === "off") return;
    const { startMailboxWatch } = await import("./lib/mailbox-watch");
    startMailboxWatch();
  }
}
