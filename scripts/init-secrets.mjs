// Generates a strong shared webhook secret + Cal.com URL token and writes them to .env and n8n/config.local.json.
// Idempotent: keeps existing non-placeholder values unless --force is passed. Never prints the secrets.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const force = process.argv.includes("--force");
const isWeak = (v) => !v || /change-me|^$|same value|long-random/i.test(v);

let envTxt = readFileSync(".env", "utf8");
const m = envTxt.match(/^WEBHOOK_SECRET="?([^"\r\n]*)"?/m);
let secret = m?.[1];
if (force || isWeak(secret)) secret = randomBytes(24).toString("hex");
envTxt = /^WEBHOOK_SECRET=/m.test(envTxt)
  ? envTxt.replace(/^WEBHOOK_SECRET=.*$/m, `WEBHOOK_SECRET="${secret}"`)
  : envTxt + `\nWEBHOOK_SECRET="${secret}"\n`;
writeFileSync(".env", envTxt);

const cfgPath = "n8n/config.local.json";
const cfg = existsSync(cfgPath)
  ? JSON.parse(readFileSync(cfgPath, "utf8").replace(/^\uFEFF/, ""))
  : JSON.parse(readFileSync("n8n/config.example.json", "utf8"));
delete cfg._comment;
cfg.DASHBOARD_WEBHOOK_SECRET = secret;
if (force || isWeak(cfg.CAL_WEBHOOK_TOKEN)) cfg.CAL_WEBHOOK_TOKEN = randomBytes(16).toString("hex");
if (!cfg.DASHBOARD_URL || /fenebris\.com/.test(cfg.DASHBOARD_URL)) cfg.DASHBOARD_URL = "http://host.docker.internal:3100";
writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
console.log("secrets ready: .env WEBHOOK_SECRET and n8n/config.local.json are in sync (values not printed)");
