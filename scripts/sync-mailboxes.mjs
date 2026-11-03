// Copies the sending mailboxes (SMTP + IMAP logins) from Smartlead into the git-ignored n8n config files, so that
//  - n8n watches each inbox over IMAP (replies are answered within seconds, not when Smartlead next polls), and
//  - the dashboard sends in-thread answers over SMTP with proper In-Reply-To / References headers.
// Passwords are never printed. Run again whenever a mailbox is added or its password changes, then deploy.
//
//   node scripts/sync-mailboxes.mjs            -> updates deploy/.local/n8n-config.json and n8n/config.local.json
//   node scripts/sync-mailboxes.mjs --upload   -> also copies deploy/.local/n8n-config.json to the server (then: npm run deploy)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const files = ["deploy/.local/n8n-config.json", "n8n/config.local.json"].filter((f) => existsSync(f));
if (!files.length) throw new Error("No n8n config file found");
const key = JSON.parse(readFileSync(files[0], "utf8")).SMARTLEAD_API_KEY;
if (!key) throw new Error("SMARTLEAD_API_KEY is empty");

const r = await fetch(`https://server.smartlead.ai/api/v1/email-accounts/?offset=0&limit=100&api_key=${encodeURIComponent(key)}`);
if (!r.ok) throw new Error(`Smartlead ${r.status}`);
const rows = await r.json();
const secure = (t) => String(t || "").toUpperCase() === "SSL";
const MAILBOXES = rows
  .filter((a) => a.from_email && a.smtp_host && a.imap_host)
  .map((a) => ({
    email: String(a.from_email).toLowerCase(),
    name: a.from_name || "",
    smtp: { host: a.smtp_host, port: Number(a.smtp_port), secure: secure(a.smtp_port_type) || Number(a.smtp_port) === 465, user: a.username, password: a.password },
    imap: {
      host: a.imap_host,
      port: Number(a.imap_port),
      secure: secure(a.imap_port_type) || Number(a.imap_port) === 993,
      user: a.is_different_imap_account ? a.imap_username : a.imap_username || a.username,
      password: a.is_different_imap_account ? a.imap_password : a.imap_password || a.password,
    },
  }));

for (const f of files) {
  const cfg = JSON.parse(readFileSync(f, "utf8"));
  cfg.MAILBOXES = MAILBOXES;
  cfg.MAILBOX_EMAILS = MAILBOXES.map((m) => m.email).join(",");
  writeFileSync(f, JSON.stringify(cfg, null, 2) + "\n");
}
console.log(`${MAILBOXES.length} mailbox(es): ${MAILBOXES.map((m) => `${m.email} (smtp ${m.smtp.host}:${m.smtp.port}, imap ${m.imap.host}:${m.imap.port})`).join("; ") || "none"}`);
console.log(`updated ${files.join(", ")}`);

if (process.argv.includes("--upload")) {
  const t = JSON.parse(readFileSync("deploy/.local/target.json", "utf8"));
  const target = `${t.user || "root"}@${t.host}`;
  const args = ["-o", "BatchMode=yes", ...(t.key ? ["-i", t.key] : []), target, "umask 077 && cat > /opt/fenebris/n8n-config.json"];
  const res = spawnSync("ssh", args, { input: readFileSync("deploy/.local/n8n-config.json", "utf8"), encoding: "utf8" });
  if (res.status !== 0) throw new Error(`upload failed: ${res.stderr}`);
  console.log(`uploaded n8n-config.json to ${t.host} (run npm run deploy next)`);
}
