#!/usr/bin/env bash
# Runs ON THE SERVER (called by scripts/deploy.mjs over ssh). Idempotent: safe to run on every push.
#   /opt/fenebris/app                 code uploaded by scripts/deploy.mjs (git archive)
#   /opt/fenebris/.env                compose settings + secrets          (from `npm run deploy:init`)
#   /opt/fenebris/n8n-config.json     baked into the n8n workflow at build (from `npm run deploy:init`)
set -euo pipefail

ROOT=/opt/fenebris
APP="$ROOT/app"
cd "$ROOT"

[ -f .env ] || { echo "Missing $ROOT/.env. Run: npm run deploy:init  (then npm run deploy -- --init)"; exit 1; }
[ -f n8n-config.json ] || { echo "Missing $ROOT/n8n-config.json. Run: npm run deploy:init"; exit 1; }
[ -d "$APP/deploy" ] || { echo "Missing $APP/deploy. The upload step did not run."; exit 1; }

# 1. infra files travel with the code
cp "$APP/deploy/docker-compose.prod.yml" "$APP/deploy/Caddyfile" "$APP/deploy/backup.sh" "$ROOT/"
mkdir -p "$ROOT/postgres-init" "$ROOT/backups"
cp "$APP/deploy/postgres-init/"* "$ROOT/postgres-init/"
DC="docker compose -f $ROOT/docker-compose.prod.yml --env-file $ROOT/.env"

# 2. dashboard basic-auth hash (the dashboard has no login of its own)
set -a; . ./.env; set +a
if [ -z "${DASH_PASS_HASH:-}" ]; then
  [ -n "${DASH_PASSWORD:-}" ] || { echo "Set DASH_PASSWORD in .env"; exit 1; }
  hash="$(docker run --rm caddy:2 caddy hash-password --plaintext "$DASH_PASSWORD")"
  printf "DASH_PASS_HASH='%s'\n" "$hash" >> .env      # single quotes: compose must not expand the $ signs
  echo "dashboard login hash created"
fi

# 3. database + dashboard image + schema
$DC up -d db
$DC build dashboard
$DC run --rm --no-deps dashboard npx prisma db push --skip-generate    # refuses destructive changes on its own

# 4. everything up
$DC up -d --remove-orphans
for i in $(seq 1 40); do
  [ "$($DC ps --format '{{.Health}}' n8n)" = "healthy" ] && break
  sleep 3
done
[ "$($DC ps --format '{{.Health}}' n8n)" = "healthy" ] || { echo "n8n did not become healthy"; $DC logs --tail 40 n8n; exit 1; }
N8N="$($DC ps -q n8n)"

# 5. n8n credentials. Postgres is always refreshed. The two Google ones are created EMPTY once (same ids the workflow
#    uses), then connected by a human in the n8n UI; they are never overwritten after that.
mkdir -p "$APP/n8n/workflows"    # git-ignored, so not part of the upload
node_run() { docker run --rm -v "$APP":/app -v "$ROOT/n8n-config.json":/app/n8n/config.local.json:ro -e PGPW="$POSTGRES_PASSWORD" -w /app node:22-bookworm-slim "$@"; }
node_run node -e '
const fs=require("fs");
const mk=(id,name,type,data)=>({id,name,type,data});
fs.writeFileSync("/app/n8n/workflows/.cred-pg.json",JSON.stringify([mk("fenebrisPostgres01","Fenebris Postgres","postgres",
 {host:"db",port:5432,database:"fenebris",user:"fenebris",password:process.env.PGPW,ssl:"disable",allowUnauthorizedCerts:false,maxConnections:10,sshTunnel:false})]));
fs.writeFileSync("/app/n8n/workflows/.cred-gcal.json",JSON.stringify([mk("y5FL0LJTf7OK7BZo","Google Calendar account","googleCalendarOAuth2Api",{clientId:"",clientSecret:""})]));
fs.writeFileSync("/app/n8n/workflows/.cred-gsheets.json",JSON.stringify([mk("dXHwZhsv0bI9TBiw","Google Sheets account","googleSheetsOAuth2Api",{clientId:"",clientSecret:""})]));
'
docker cp "$APP/n8n/workflows/.cred-pg.json" "$N8N:/tmp/cred-pg.json"
docker exec "$N8N" n8n import:credentials --input=/tmp/cred-pg.json
for pair in "y5FL0LJTf7OK7BZo:gcal" "dXHwZhsv0bI9TBiw:gsheets"; do
  id="${pair%%:*}"; f="${pair##*:}"
  if docker exec "$N8N" n8n export:credentials --id="$id" --output=/tmp/probe.json >/dev/null 2>&1; then
    echo "credential $id already exists, left untouched"
  else
    docker cp "$APP/n8n/workflows/.cred-$f.json" "$N8N:/tmp/cred-$f.json"
    docker exec "$N8N" n8n import:credentials --input="/tmp/cred-$f.json"
    echo "credential $id created EMPTY: open it in n8n and click 'Sign in with Google'"
  fi
done
rm -f "$APP"/n8n/workflows/.cred-*.json

# 6. build the ONE workflow with the server config baked in, import it, publish it, restart so webhooks register
node_run node n8n/build-workflows.mjs
node_run node -e '
const fs=require("fs");const wf=JSON.parse(fs.readFileSync("/app/n8n/workflows/Fenebris_Outreach_Autopilot.json","utf8"));
fs.writeFileSync("/app/n8n/workflows/.import.json",JSON.stringify([{...wf,id:wf.id??"fenebrisAutopilot01",active:false}]));'
docker cp "$APP/n8n/workflows/.import.json" "$N8N:/tmp/fenebris-workflow.json"
docker exec "$N8N" n8n import:workflow --input=/tmp/fenebris-workflow.json
docker exec "$N8N" n8n publish:workflow --id=fenebrisAutopilot01 \
  || docker exec "$N8N" n8n update:workflow --id=fenebrisAutopilot01 --active=true
rm -f "$APP/n8n/workflows/.import.json"
$DC restart n8n

# 7. smoke test through the public HTTPS names
sleep 15
ok=1
curl -fsS -o /dev/null "https://$N8N_DOMAIN/healthz" && echo "n8n   https://$N8N_DOMAIN  OK" || { echo "n8n   https://$N8N_DOMAIN  FAILED"; ok=0; }
code="$(curl -s -o /dev/null -w '%{http_code}' "https://$APP_DOMAIN/")"
[ "$code" = "401" ] && echo "app   https://$APP_DOMAIN  OK (login required)" || { echo "app   https://$APP_DOMAIN  unexpected HTTP $code"; ok=0; }
docker image prune -f >/dev/null
[ "$ok" = 1 ] && echo "DEPLOY OK" || { echo "DEPLOY FINISHED WITH FAILURES"; exit 1; }
