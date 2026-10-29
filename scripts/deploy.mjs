// Deploys the COMMITTED code (git archive HEAD) to the VPS over ssh. Used by `npm run deploy` and by GitHub Actions.
//   npm run deploy               upload code, rebuild, migrate DB, build + import the n8n workflow, restart
//   npm run deploy -- --setup    one time: install Docker, firewall, key-only SSH   (never deploys the app)
//   npm run deploy -- --init     one time: upload .env + n8n config made by `npm run deploy:init`
// Target: DEPLOY_HOST / DEPLOY_USER / DEPLOY_KEY (env, used by CI) or deploy/.local/target.json (made by deploy:init).
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const local = existsSync(join(root, "deploy", ".local", "target.json"))
  ? JSON.parse(readFileSync(join(root, "deploy", ".local", "target.json"), "utf8"))
  : {};
const host = process.env.DEPLOY_HOST || local.host;
const user = process.env.DEPLOY_USER || local.user || "root";
const key = process.env.DEPLOY_KEY || local.key;
if (!host || !key) {
  console.error("No target. Run `npm run deploy:init -- --app ... --n8n ... --host <ip>` or set DEPLOY_HOST and DEPLOY_KEY.");
  process.exit(1);
}
const sshArgs = [
  "-i", key,
  "-o", "IdentitiesOnly=yes",
  "-o", "BatchMode=yes",
  "-o", `StrictHostKeyChecking=${process.env.DEPLOY_STRICT_HOST_KEY || "accept-new"}`,
  "-o", "ServerAliveInterval=30",
  `${user}@${host}`,
];
const flag = (f) => process.argv.includes(f);

/** ssh <command>, optionally feeding stdin from another process (tar upload) or a string. */
function ssh(command, { stdin } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn("ssh", [...sshArgs, command], { stdio: [stdin ? "pipe" : "ignore", "inherit", "inherit"] });
    if (stdin && typeof stdin === "string") p.stdin.end(stdin);
    else if (stdin) stdin.pipe(p.stdin);
    p.on("error", reject);
    p.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`ssh exited ${c}: ${command.slice(0, 60)}`))));
  });
}
const fileText = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");

async function main() {
  if (flag("--setup")) {
    console.log(`→ server setup on ${host}`);
    await ssh("bash -s", { stdin: fileText(join(root, "deploy", "server-setup.sh")) });
    return;
  }
  if (flag("--init")) {
    const dir = join(root, "deploy", ".local");
    for (const f of ["env.prod", "n8n-config.json"]) {
      if (!existsSync(join(dir, f))) throw new Error(`deploy/.local/${f} missing. Run npm run deploy:init first.`);
    }
    console.log(`→ uploading settings to ${host}:/opt/fenebris (not printed, not logged)`);
    const put = (f, dest) => ssh(`umask 077 && mkdir -p /opt/fenebris && cat > /opt/fenebris/${dest}`, { stdin: fileText(join(dir, f)) });
    // the basic-auth hash is re-derived from DASH_PASSWORD on the next deploy
    await put("env.prod", ".env");
    await put("n8n-config.json", "n8n-config.json");
    console.log("✔ settings uploaded");
    return;
  }

  const dirty = spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).stdout.trim();
  const sha = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim();
  if (dirty) console.warn("⚠ uncommitted changes are NOT deployed (only committed code is).");
  console.log(`→ deploying ${sha} to ${host}`);
  const tar = spawn("git", ["archive", "--format=tar", "HEAD"], { cwd: root, stdio: ["ignore", "pipe", "inherit"] });
  await ssh("rm -rf /opt/fenebris/app && mkdir -p /opt/fenebris/app && tar -x -C /opt/fenebris/app", { stdin: tar.stdout });
  await ssh("bash /opt/fenebris/app/deploy/remote-deploy.sh");
  console.log(`✔ deployed ${sha}`);
}

main().catch((e) => {
  console.error("✖ " + e.message);
  process.exit(1);
});
