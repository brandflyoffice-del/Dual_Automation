# Fenebris Outreach Command Center

Executive dashboard + n8n automation for Fenebris India Pvt. Ltd.'s **email-only** B2B outreach: AI-enriched leads → 4-step sequence → AI reply handling → auto-booked meetings on Google Calendar (est. ticket ≥ $1,000).

Stack: Next.js 15 (App Router) · TypeScript · Tailwind v4 · shadcn-style UI (Radix) · Recharts · TanStack Table · Prisma + PostgreSQL (Supabase-compatible).

## Run locally

```bash
npm install
npm run db:up        # Postgres 16 in Docker (port 54329)
cp .env.example .env # then edit secrets
npm run db:push      # create tables
npm run db:seed      # fictional demo data (157 leads, 10 meetings)
npm run dev          # http://localhost:3100
npm run build        # production build (needs no DB at build time)
```

For Supabase set `DATABASE_URL` to your pooled connection string and run `db:push` (skip `db:up`).

## Views

`/dashboard` KPIs, funnel, geography, service matrix · `/meetings` One-Click Call Sheet, week calendar, dossier drawer + scratchpad (syncs to the Google Sheet through n8n) · `/leads` filters + "Trigger n8n Scraper Batch" · `/campaigns` sequence monitor, pause/resume, push to booking · `/reports` weekly report with PDF export and share link (`/r/<token>`).

## n8n

One workflow, `Fenebris_Outreach_Autopilot`. See [`n8n/README.md`](n8n/README.md): `npm run init:secrets`, `npm run n8n:build`, `npm run n8n:push:docker` (or `npm run n8n:push` with an n8n API key). The sidebar shows "Automation live" only when n8n is reachable and the workflow is active.

## Env

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | Postgres |
| `WEBHOOK_SECRET` | shared secret for `/api/webhooks/n8n` (header `x-fenebris-secret`); the endpoint returns 503 if unset |
| `N8N_BASE_URL` | where the dashboard calls n8n webhooks; if unreachable the UI says so |
| `GOOGLE_SHEET_URL`, `GOOGLE_CALENDAR_URL`, `BOOKING_LINK` | deep links used in the UI |
| `NEXT_PUBLIC_APP_URL` | base for report share links |

> The seed data is fictional, for demo only. Wipe it (`npm run db:reset`, then don't seed) before real use.
