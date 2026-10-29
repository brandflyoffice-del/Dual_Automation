// Generates the production settings files in deploy/.local/ (git-ignored). Nothing is uploaded here.
//   node scripts/prod-init.mjs --app app.example.com --n8n n8n.example.com [--host 1.2.3.4] [--user root] [--key ~/.ssh/fenebris_vps]
// Re-running keeps the existing secrets (a changed Postgres password would lock the database out).
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "deploy", ".local");
mkdirSync(out, { recursive: true });

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {});
const readEnv = (p) =>
  Object.fromEntries(
    existsSync(p)
      ? readFileSync(p, "utf8")
          .split(/\r?\n/)
          .filter((l) => /^[A-Z0-9_]+=/.test(l))
          .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^["']+|["']+$/g, "")])
      : [],
  );

const targetPath = join(out, "target.json");
const prev = readEnv(join(out, "env.prod"));
const target = { ...readJson(targetPath) };
const appDomain = arg("app") || prev.APP_DOMAIN;
const n8nDomain = arg("n8n") || prev.N8N_DOMAIN;
if (!appDomain || !n8nDomain) {
  console.error("usage: node scripts/prod-init.mjs --app app.example.com --n8n n8n.example.com [--host IP] [--user root] [--key PATH]");
  process.exit(1);
}
if (arg("host")) target.host = arg("host");
if (arg("user")) target.user = arg("user");
if (arg("key")) target.key = arg("key");
target.user ??= "root";
target.key ??= join(homedir(), ".ssh", "fenebris_vps");
writeFileSync(targetPath, JSON.stringify(target, null, 2));

const secret = (n = 32) => randomBytes(n).toString("hex");
const keep = (k, make) => prev[k] || make();
const local = readJson(join(root, "n8n", "config.local.json"));
const localEnv = readEnv(join(root, ".env"));

const env = {
  APP_DOMAIN: appDomain,
  N8N_DOMAIN: n8nDomain,
  TZ: "Asia/Kolkata",
  POSTGRES_PASSWORD: keep("POSTGRES_PASSWORD", () => secret(24)),
  N8N_ENCRYPTION_KEY: keep("N8N_ENCRYPTION_KEY", () => secret(24)),
  WEBHOOK_SECRET: keep("WEBHOOK_SECRET", () => secret(32)),
  DASH_USER: keep("DASH_USER", () => "brandfly"),
  DASH_PASSWORD: keep("DASH_PASSWORD", () => secret(9)),
  GOOGLE_SHEET_URL: localEnv.GOOGLE_SHEET_URL || "",
  GOOGLE_CALENDAR_URL: localEnv.GOOGLE_CALENDAR_URL || "",
  BOOKING_LINK: localEnv.BOOKING_LINK || local.BOOKING_LINK || "",
};
writeFileSync(join(out, "env.prod"), Object.entries(env).map(([k, v]) => `${k}='${v}'`).join("\n") + "\n");

// Same baked config as local, with the three addresses that change on the server.
const cfg = {
  ...local,
  DASHBOARD_URL: "http://dashboard:3400",
  DASHBOARD_WEBHOOK_SECRET: env.WEBHOOK_SECRET,
  PUBLIC_N8N_URL: `https://${n8nDomain}`,
  N8N_INTERNAL_URL: "http://localhost:5678",
};
writeFileSync(join(out, "n8n-config.json"), JSON.stringify(cfg, null, 2));
writeFileSync(
  join(out, "dashboard-login.txt"),
  `Dashboard  https://${appDomain}\nuser       ${env.DASH_USER}\npassword   ${env.DASH_PASSWORD}\n(HTTP basic auth in front of the dashboard. Keep this file private.)\n`,
);

console.log(`Wrote deploy/.local/{env.prod, n8n-config.json, dashboard-login.txt, target.json}`);
console.log(`  app   https://${appDomain}\n  n8n   https://${n8nDomain}`);
console.log(`  server ${target.user}@${target.host ?? "(set with --host)"}   key ${target.key}`);
console.log("Next: npm run deploy -- --setup   then   npm run deploy -- --init   then   npm run deploy");
