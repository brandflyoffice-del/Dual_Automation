import fs from "node:fs";

const cfg = JSON.parse(fs.readFileSync(new URL("../n8n/config.local.json", import.meta.url), "utf8"));
const body = {
  provider: "ai-ark",
  name: "system-test-5",
  regions: ["US"],
  industries: ["ECOMMERCE_RETAIL"],
  roles: ["Founder"],
  employees: ["1,10"],
  limit: 5,
  emailType: "work",
  maxPerCompany: 1,
};
const res = await fetch("http://127.0.0.1:5678/webhook/fenebris-scraper-batch", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-fenebris-secret": cfg.DASHBOARD_WEBHOOK_SECRET,
  },
  body: JSON.stringify(body),
});
const text = await res.text();
console.log("launch", res.status, text.slice(0, 180));
console.log("startedAt", new Date().toISOString());
