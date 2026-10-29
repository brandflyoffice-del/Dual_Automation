// Checks the pure-JS HMAC used inside n8n Code nodes against node:crypto. Run: node n8n/test-helpers.mjs
import { createHmac } from "node:crypto";
import { SIGN_JS, FMT_JS, PAGE_JS } from "./helpers.mjs";

const api = new Function(`${SIGN_JS}\n${FMT_JS}\n${PAGE_JS}\nreturn { hmacHex, slotSig, slotLabel, hourIn, pageHtml, pageButton };`)();

let bad = 0;
const cases = [
  ["secret", "a@b.com|2026-11-04T10:30:00.000Z"],
  ["x".repeat(100), "message with unicode é ü 日本"],
  ["", "empty key"],
  ["k", ""],
  ["strong-secret-value-0123456789", "q".repeat(500)],
];
for (const [key, msg] of cases) {
  const want = createHmac("sha256", key).update(msg).digest("hex");
  const got = api.hmacHex(key, msg);
  if (want !== got) {
    bad++;
    console.error("MISMATCH", JSON.stringify({ key: key.slice(0, 8), msg: msg.slice(0, 20) }), want, got);
  }
}
const sig = api.slotSig("s", "A@B.com", "2026-11-04T10:30:00.000Z");
if (sig !== createHmac("sha256", "s").update("a@b.com|2026-11-04T10:30:00.000Z").digest("hex").slice(0, 32)) {
  bad++;
  console.error("slotSig mismatch");
}
const label = api.slotLabel(Date.UTC(2026, 10, 4, 15, 0), "America/New_York");
if (!/Wednesday/.test(label) || !/10:00/.test(label)) { bad++; console.error("label", label); }
if (api.hourIn(Date.UTC(2026, 10, 4, 15, 0), "America/New_York") !== 10) { bad++; console.error("hourIn"); }
if (!api.pageHtml("T", "m", api.pageButton("?x=1&y=2", "Go")).includes("&amp;")) { bad++; console.error("page"); }
console.log(bad ? `FAILED (${bad})` : "helpers OK (hmac matches node:crypto, label + page render)");
process.exit(bad ? 1 : 0);
