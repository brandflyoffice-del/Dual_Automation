# Fenebris n8n automation — ONE workflow, email only

`Fenebris_Outreach_Autopilot` is a single n8n workflow (89 nodes, 5 webhooks + 1 daily schedule) with three lanes:

| Lane | What it does | Entry points |
|------|--------------|--------------|
| 1 Lead engine | Apollo → ZeroBounce (valid only) → site/PageSpeed audit → AI qualification (hard gate ≥ $1,000 ticket) + 4 emails (Day 0/3/7/11) → Instantly → Postgres | `POST /webhook/fenebris-scraper-batch`, daily 06:00 IST |
| 2 Reply brain | Instantly events → AI classifies replies → real Cal.com slots → AI drafts and sends the in-thread reply (guard-railed) → Postgres → live dashboard. Also pause / resume / push-to-booking | `POST /webhook/fenebris-outreach-events`, `POST /webhook/fenebris-lead-control` |
| 3 Meeting sync | Cal.com booking → Google Calendar event `[Fenebris Discovery] Company (Prospect - Role) - Est. $X+` with dossier + Meet → Google Sheet → Postgres → dashboard. Also outcome + closer notes → Sheet | `POST /webhook/fenebris-cal-booking?token=…`, `POST /webhook/fenebris-meeting-update` |

No calling anywhere: the sheet column is "Email / LinkedIn" instead of a phone column.

## Why n8n "would not connect" (and the fix)

1. **MCP 401** – Cursor's log showed `HTTP 401 Unauthorized ... configured Authorization header`. n8n is up on `localhost:5678`, but the access token in `~/.cursor/mcp.json` is no longer accepted (regenerated or n8n was reset). Earlier in the day the same log showed `ECONNREFUSED` because n8n was not running yet.
   **Fix:** n8n → *Settings → Instance-level MCP* → enable → copy the new access token → replace the `Authorization: Bearer …` value in the `n8n` entry of `~/.cursor/mcp.json` → reload Cursor.
2. **n8n 2.x blocks `$env.*`** (`N8N_BLOCK_ENV_ACCESS_IN_NODE` defaults to true), and Code nodes cannot `require('crypto')` unless allow-listed. The workflow therefore **bakes its settings in at build time** from `n8n/config.local.json` and verifies Cal.com with a URL token (HMAC is used too when `crypto` is allowed). No container env changes needed.
3. **Docker networking** – n8n runs in Docker, so `localhost` inside it is the container. The workflow reaches the dashboard at `http://host.docker.internal:3100` and Postgres at `host.docker.internal:54329`. In production use the public dashboard URL / Supabase host.

## Build & deploy

```bash
npm run init:secrets        # creates a strong shared secret in .env + n8n/config.local.json (never printed)
# edit n8n/config.local.json: API keys, IDs (see config.example.json)
npm run n8n:build           # generates + validates n8n/workflows/Fenebris_Outreach_Autopilot.json
npm run n8n:push:docker     # imports credential + workflow through the n8n CLI in the container, then:
docker restart n8nangravtity-n8n-1
# or, with an n8n API key (Settings → n8n API) stored as N8N_API_KEY in config.local.json:
npm run n8n:push            # upsert by name + activate through the public API (no restart needed)
```

Re-run `build` + `push` after changing any key (values are baked into the workflow). The dashboard sidebar shows **Automation live** only when n8n is up *and* the workflow is active.

## What you must still supply (nothing here can be invented)

| Item | Where |
|------|-------|
| Apollo, ZeroBounce, PageSpeed, OpenAI keys | `config.local.json` |
| Instantly API key + campaign id | `config.local.json` |
| Cal.com API key + event type id | `config.local.json` |
| Google Calendar + Google Sheets OAuth | n8n UI → open the Google nodes once and connect the account (the workflow ships with empty credential slots) |
| `GOOGLE_SHEET_ID` | sheet "Fenebris Master Scheduled Meetings", tab **Scheduled Meetings**, headers from `sheet-template.csv` |
| Case studies text | `CASE_STUDIES` (the AI is instructed never to invent any) |

The Postgres credential is created automatically (`fenebrisPostgres01`, local dev docker DB). For Supabase edit `n8n/credentials/fenebris-postgres.local.json` and re-push.

## External setup

* **Instantly**: one campaign with 4 steps using `{{subject_1}}/{{email_1}}` … `{{subject_4}}/{{email_4}}`, delays 0/3/7/11 days. Webhook (sent, opened, click, reply, bounce) → `…/webhook/fenebris-outreach-events` with header `x-fenebris-secret: <DASHBOARD_WEBHOOK_SECRET>`.
* **Cal.com**: 30-min "Fenebris Discovery" with Google Meet; webhook → `…/webhook/fenebris-cal-booking?token=<CAL_WEBHOOK_TOKEN>` for BOOKING_CREATED / RESCHEDULED / CANCELLED.
* Public access: expose n8n and the dashboard through your existing Cloudflare tunnel / domain; set `N8N_BASE_URL` in the dashboard `.env` and `DASHBOARD_URL` in `config.local.json`.

## Verified vs. not yet verified

Verified on n8n 2.40.5 in your Docker: import + publish, credential created, all 5 webhooks registered, auth rejects unsigned calls (401), a signed Instantly-style `email_sent` event was written to Postgres and moved the lead `VERIFIED → STEP_1_SENT`, dashboard → n8n scraper trigger accepted, dashboard status = live.

Not yet verified (needs your keys/accounts): Apollo, ZeroBounce, OpenAI, Instantly send/pause endpoints, Cal.com `/slots`, Google Calendar/Sheets nodes. Run one test lead end to end before pointing a real campaign at it.

## Compliance

Cold email to UK/EU/UAE needs a lawful basis and an unsubscribe path. Keep Instantly's unsubscribe link and your physical address on, honour `Not_Interested`, and have counsel confirm PECR/GDPR positioning per region.
