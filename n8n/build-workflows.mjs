// Generates ONE import-ready n8n workflow (all lanes in a single workflow) + sheet template.
// Run: npm run n8n:build
import { mkdirSync, writeFileSync, readdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeWorkflows } from "./lib.mjs";
import { buildWorkflow1 } from "./wf1-lead-scraper.mjs";
import { buildWorkflow2 } from "./wf2-outreach-events.mjs";
import { buildWorkflow3, SHEET_COLUMNS } from "./wf3-meeting-booked.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "workflows");
mkdirSync(out, { recursive: true });
for (const f of readdirSync(out)) if (f.endsWith(".json")) rmSync(join(out, f));

export const NAME = "Fenebris_Outreach_Autopilot";

const wf = mergeWorkflows(NAME, [
  {
    wf: buildWorkflow1(),
    label: "1 Scrape",
    banner: "LANE 1 — LEAD ENGINE: AI Ark (verified email) → site/PageSpeed audit → AI qualification ($1k+ gate) + 4-step sequence → Smartlead → Postgres. Trigger: dashboard Launch campaign.",
  },
  {
    wf: buildWorkflow2(),
    label: "2 Replies",
    banner: "LANE 2 — REPLY BRAIN: Smartlead events → AI classifies replies → real Cal.com slots → AI drafts + auto-sends the reply → Postgres → live dashboard. Also: dashboard pause / resume / push-to-booking.",
  },
  {
    wf: buildWorkflow3(),
    label: "3 Meetings",
    banner: "LANE 3 — MEETING SYNC: Cal.com booking → Google Calendar event with dossier + Meet → Google Sheet row → Postgres meetings → dashboard. Also: outcome + closer notes from the dashboard → Sheet.",
  },
]);

const errors = wf.validate();
// Names referenced by Code-node expressions must still exist after de-duplication.
const names = new Set(wf.nodes.map((n) => n.name));
const refRe = /\$\('([^']+)'\)/g;
for (const n of wf.nodes) {
  const blob = JSON.stringify(n.parameters);
  for (const m of blob.matchAll(refRe)) if (!names.has(m[1])) errors.push(`"${n.name}" references missing node "${m[1]}"`);
}
if (errors.length) {
  console.error(`✖ ${NAME}`);
  errors.forEach((e) => console.error("   - " + e));
  process.exit(1);
}

/**
 * n8n 2.x blocks `$env.*` inside workflows by default (N8N_BLOCK_ENV_ACCESS_IN_NODE=true), so we BAKE the values
 * from n8n/config.local.json (git-ignored) into the generated workflow. Missing values become "" and are reported.
 * Use `--env` to keep live `$env.X` references instead (requires N8N_BLOCK_ENV_ACCESS_IN_NODE=false on the server).
 */
const keepEnv = process.argv.includes("--env");
const cfgPath = join(here, "config.local.json");
const cfg = existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, "utf8")) : {};
const missing = new Set();
const used = new Set();
const bake = (v) => {
  if (typeof v === "string") {
    return v.replace(/\$env\.([A-Z0-9_]+)/g, (_, name) => {
      used.add(name);
      const val = cfg[name];
      if (val === undefined || val === null || val === "") missing.add(name);
      return JSON.stringify(val === undefined || val === null ? "" : String(val));
    });
  }
  if (Array.isArray(v)) return v.map(bake);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, bake(x)]));
  return v;
};
const json = wf.toJSON();
if (!keepEnv) {
  json.nodes = json.nodes.map((n) => ({ ...n, parameters: bake(n.parameters) }));
  // baked JS must still parse
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  for (const n of json.nodes.filter((x) => x.type === "n8n-nodes-base.code")) {
    try {
      new AsyncFunction("$input", "$", "$json", "$items", "$node", "$now", "require", "items", n.parameters.jsCode);
    } catch (e) {
      console.error(`✖ baked Code node "${n.name}" no longer parses: ${e.message}`);
      process.exit(1);
    }
  }
}

writeFileSync(join(out, `${NAME}.json`), JSON.stringify(json, null, 2));
writeFileSync(join(here, "sheet-template.csv"), SHEET_COLUMNS.map((c) => `"${c}"`).join(",") + "\n");

const hooks = wf.nodes.filter((n) => n.type === "n8n-nodes-base.webhook").map((n) => n.parameters.path);
console.log(`✔ ${NAME}.json  (${wf.nodes.filter((n) => !n.type.endsWith("stickyNote")).length} nodes, ${hooks.length} webhooks)`);
console.log("\nProduction webhook URLs  ({N8N_BASE_URL} = your n8n host):");
for (const h of hooks) console.log(`  POST {N8N_BASE_URL}/webhook/${h}`);
if (!keepEnv) {
  console.log(`\nConfig baked from ${existsSync(cfgPath) ? "n8n/config.local.json" : "NOTHING (n8n/config.local.json not found - copy config.example.json)"}`);
  if (missing.size) console.log(`⚠ Empty values (feature stays off until filled, then rebuild + re-import): ${[...missing].sort().join(", ")}`);
  else console.log("✔ All referenced settings have values");
}
