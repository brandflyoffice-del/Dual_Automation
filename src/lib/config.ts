// Server-only runtime configuration (never import from client components).
export const config = {
  sheetUrl: process.env.GOOGLE_SHEET_URL ?? "https://docs.google.com/spreadsheets",
  calendarUrl: process.env.GOOGLE_CALENDAR_URL ?? "https://calendar.google.com/calendar/u/0/r",
  bookingLink: process.env.BOOKING_LINK ?? "https://cal.com/fenebris/discovery",
  n8nBase: (process.env.N8N_BASE_URL ?? "").replace(/\/$/, ""),
  webhookSecret: process.env.WEBHOOK_SECRET ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100",
};

export const n8nWebhooks = {
  scraperBatch: "/webhook/fenebris-scraper-batch",
  leadControl: "/webhook/fenebris-lead-control",
  meetingUpdate: "/webhook/fenebris-meeting-update",
} as const;

/** POST to an n8n webhook. Returns a structured result instead of throwing so UI can show honest status. */
export async function callN8n(path: string, body: unknown): Promise<{ ok: boolean; status: number; message: string }> {
  if (!config.n8nBase) {
    return { ok: false, status: 0, message: "N8N_BASE_URL is not configured. Saved locally; n8n was not notified." };
  }
  try {
    const res = await fetch(`${config.n8nBase}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-fenebris-secret": config.webhookSecret },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    return { ok: res.ok, status: res.status, message: res.ok ? "n8n accepted the request" : `n8n responded ${res.status}` };
  } catch (e) {
    return { ok: false, status: 0, message: `Could not reach n8n: ${(e as Error).message}` };
  }
}
