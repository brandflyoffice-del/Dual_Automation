# CLAUDE.md — Fenebris Outreach OS

**Read [AGENTS.md](AGENTS.md) fully before doing anything.** It is the source of truth (architecture, repo map, n8n lanes, status, pending, gotchas). Do not re-explore the repo; read only the files you are about to change.

**Keep AGENTS.md current.** After meaningful work, edit its Status, Pending and Gotchas sections (short, factual, no secrets) and bump the "Last updated" date. If this file and AGENTS.md disagree, AGENTS.md wins; fix the stale one.

## Non-negotiable rules (full list in AGENTS.md §0)
- Reply to the user in **English** (they write Hinglish/Hindi).
- **EMAIL ONLY.** No call/phone CTAs. The phone number lives only in the HTML signature footer of the Smartlead emails; do not remove it.
- **ONE n8n workflow** (`Fenebris_Outreach_Autopilot`). Do not split it.
- Real code only; no mock UI. Say plainly what is verified and what is not.
- Never print or commit secrets: `.env`, `n8n/config.local.json`, `n8n/credentials/*.local.json`.
- Never email or start campaigns with the three real leads (names are in the Smartlead campaigns 4238486 / 4238487, not repeated here because the repo may be public); never start Smartlead campaigns `4238486` / `4238487`. Smartlead's own AI auto-reply stays **off**.
- Do not disturb other workflows on the shared n8n container `n8nangravtity-n8n-1`.
- Do not run `db:seed` / `db:reset` against the live DB (seed data is fictional).

## Stack in one line
Next.js 15 dashboard (port **3400**, light theme, brand "BrandFly") + Postgres 16 (docker `fenebris-db`, host port 54329) + one n8n 2.40.5 workflow generated from `n8n/*.mjs` builders and baked with `n8n/config.local.json`.

## Commands
```
npm run dev | build | start | lint | typecheck
npm run db:up | db:push | db:studio
npm run init:secrets
npm run n8n:build            # merge + validate + bake -> n8n/workflows/Fenebris_Outreach_Autopilot.json
npm run n8n:push:docker      # CLI import (then: docker restart n8nangravtity-n8n-1)
npm run n8n:push             # public API import (needs N8N_API_KEY)
node n8n/test-helpers.mjs    # unit checks for n8n/helpers.mjs
npm run deploy:init -- --app app.<domain> --n8n n8n.<domain> --host <ip>   # writes deploy/.local (git-ignored)
npm run deploy -- --setup | --init                                         # one-time server prep / settings upload
npm run deploy               # ships committed code to the VPS (also what GitHub Actions runs on push to main)
```
Production hosting is described in AGENTS.md §11. It was written but **not yet run on the server**; the user said not to deploy until told.
n8n 2.x blocks `$env.*`, so config is baked at build time. Never CLI-import unless the Google credential ids in the built JSON match the attached ones (see AGENTS.md §6).

## Editing conventions
- Windows + PowerShell 5.1: no `&&`; files are CRLF, so use the Edit tool or node for multi-line changes, not `String.Replace`.
- n8n Code nodes: never declare `items`; node names must be unique; every `$('Name')` must exist (the build validates this).
- Server components are `force-dynamic`; client row types are in `src/lib/types.ts`; DB status columns are strings validated in code.
- Light theme tokens live in `src/app/globals.css`; prefer `bg-foreground/[0.04]` over `bg-white/..`.
- Match surrounding code style and comment density.
