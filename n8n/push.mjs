// Pushes n8n/workflows/Fenebris_Outreach_Autopilot.json into n8n and activates it.
//
//   node n8n/push.mjs                      -> n8n public API (needs N8N_API_KEY in n8n/config.local.json or env)
//   node n8n/push.mjs --docker <container> -> n8n CLI inside a Docker container (no API key needed)
//
// Upserts by workflow name, so re-running after `npm run n8n:build` updates the same workflow.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, "workflows", "Fenebris_Outreach_Autopilot.json");
if (!existsSync(file)) {
  console.error("Workflow JSON missing. Run: npm run n8n:build");
  process.exit(1);
}
const wf = JSON.parse(readFileSync(file, "utf8"));
const cfgPath = join(here, "config.local.json");
const cfg = existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, "utf8")) : {};
const dockerIdx = process.argv.indexOf("--docker");

/* ───────────────────────── Docker CLI mode ───────────────────────── */
if (dockerIdx !== -1) {
  const c = process.argv[dockerIdx + 1];
  if (!c) throw new Error("usage: node n8n/push.mjs --docker <container-name>");
  const run = (args) => execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

  // credentials (Postgres) first so the workflow can reference them
  const credFile = join(here, "credentials", "fenebris-postgres.local.json");
  if (existsSync(credFile)) {
    run(["cp", credFile, `${c}:/tmp/fenebris-credentials.json`]);
    console.log(run(["exec", c, "n8n", "import:credentials", "--input=/tmp/fenebris-credentials.json"]).trim());
  }
  // n8n CLI wants an array and an id; keep the id stable so re-runs update in place
  const withId = { ...wf, id: wf.id ?? "fenebrisAutopilot01", active: false };
  const tmp = join(here, "workflows", ".import.tmp.json");
  (await import("node:fs")).writeFileSync(tmp, JSON.stringify([withId]));
  run(["cp", tmp, `${c}:/tmp/fenebris-workflow.json`]);
  console.log(run(["exec", c, "n8n", "import:workflow", "--input=/tmp/fenebris-workflow.json"]).trim());
  (await import("node:fs")).rmSync(tmp, { force: true });
  try {
    console.log(run(["exec", c, "n8n", "publish:workflow", `--id=${withId.id}`]).trim());
  } catch {
    console.log(run(["exec", c, "n8n", "update:workflow", `--id=${withId.id}`, "--active=true"]).trim());
  }
  console.log(`\nImported + activated. RESTART the container so webhooks register:  docker restart ${c}`);
  process.exit(0);
}

/* ───────────────────────── Public API mode ───────────────────────── */
const base = (process.env.N8N_BASE_URL || cfg.N8N_BASE_URL || "http://localhost:5678").replace(/\/$/, "");
const key = process.env.N8N_API_KEY || cfg.N8N_API_KEY;
if (!key) {
  console.error(
    "No N8N_API_KEY. In n8n: Settings → n8n API → Create an API key, then put it in n8n/config.local.json as N8N_API_KEY\n" +
      "(or run with --docker <container> to import through the n8n CLI instead).",
  );
  process.exit(1);
}
const api = async (method, path, body) => {
  const r = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: { "X-N8N-API-KEY": key, "content-type": "application/json", accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
};

// Public API only accepts these top-level fields
const payload = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: { executionOrder: "v1" } };
const list = await api("GET", `/workflows?name=${encodeURIComponent(wf.name)}&limit=50`);
const existing = (list.data || []).find((w) => w.name === wf.name);
const saved = existing ? await api("PUT", `/workflows/${existing.id}`, payload) : await api("POST", "/workflows", payload);
console.log(`${existing ? "Updated" : "Created"} workflow ${saved.id}`);
await api("POST", `/workflows/${saved.id}/activate`);
console.log("Activated. Webhooks are live at:");
for (const n of wf.nodes.filter((x) => x.type === "n8n-nodes-base.webhook")) console.log(`  POST ${base}/webhook/${n.parameters.path}`);
