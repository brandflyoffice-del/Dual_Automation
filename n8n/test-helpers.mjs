// Checks the pure-JS HMAC used inside n8n Code nodes against node:crypto. Run: node n8n/test-helpers.mjs
import { createHmac } from "node:crypto";
import { SIGN_JS, FMT_JS, PAGE_JS, PHONE_JS } from "./helpers.mjs";

const api = new Function(`${SIGN_JS}\n${FMT_JS}\n${PAGE_JS}\n${PHONE_JS}\nreturn { hmacHex, slotSig, slotLabel, hourIn, pageHtml, pageButton, cleanPhone };`)();

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
const PHONES = [
  ["+1 (415) 692-3800", "us", "+14156923800"], ["415.692.3800", "us", "+14156923800"], ["1-415-692-3800", "ca", "+14156923800"],
  ["+1 415 555 0123", "us", null], ["+1 111 692 3800", "us", null], ["+1 415 911 3800", "us", null], ["+1 800 692 380", "us", null],
  ["+44 (0)7700 900123", "gb", "+447700900123"], ["07700 900123", "gb", "+447700900123"], ["0044 7700 900123", "de", "+447700900123"],
  ["+971 50 123 4567", "ae", "+971501234567"], ["+49 151 23456789", "de", "+4915123456789"], ["+39 06 6982 1234", "it", "+390669821234"],
  ["+1 415 692 3800 ext 12", "us", "+14156923800"], ["n/a", "us", null], ["", "us", null], ["1234567890", "us", null], ["0000000000", "gb", null],
  ["692 3800", "us", null], ["7700 900123", "xx", null], ["+86 138 0013 8000", "cn", "+8613800138000"],
];
for (const [raw, cc, want] of PHONES) {
  const got = api.cleanPhone(raw, cc);
  if (got !== want) { bad++; console.error("phone", JSON.stringify(raw), cc, "want", want, "got", got); }
}
console.log(bad ? `FAILED (${bad})` : "helpers OK (hmac matches node:crypto, label + page render + phone check)");
process.exit(bad ? 1 : 0);
