/**
 * Demo seed for the Fenebris dashboard.
 * ALL companies / people below are fictional demo data (domains are invented) so the UI renders
 * with realistic volume. Real data replaces it as soon as Workflow 1 starts upserting.
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { computeReportMetrics } from "../src/lib/queries";

const db = new PrismaClient();
const BOOKING = process.env.BOOKING_LINK ?? "https://cal.com/fenebris/discovery";

type Pain = "SLOW" | "ADS" | "SEC" | "DEV";
type Row = [
  first: string, last: string, role: string, company: string, domain: string, country: string,
  region: string, industry: string, revenueK: number, employees: number, pain: Pain, service: string,
  score: number, ticket: number, stage: string, daysAgo: number,
];

const ROWS: Row[] = [
  // ── BOOKED (10) — each gets a meeting
  ["Marcus", "Reyes", "Founder & CEO", "Lumora Home", "lumorahome.co", "United States", "US", "ECOMMERCE_RETAIL", 3200, 18, "SLOW", "WEB_ECOM", 93, 8500, "BOOKED", 6],
  ["Priya", "Raman", "CTO", "LedgerLoop", "ledgerloop.io", "United States", "US", "FINTECH", 6800, 34, "SEC", "MANAGED_IT", 90, 12000, "BOOKED", 7],
  ["Oliver", "Hartley", "Co-Founder", "Kestrel & Vane", "kestrelvane.co.uk", "United Kingdom", "UK", "ECOMMERCE_RETAIL", 2100, 14, "ADS", "DIGITAL_MARKETING", 89, 4800, "BOOKED", 5],
  ["Sophie", "Lindqvist", "CEO", "NordHaven Properties", "nordhaven.se", "Sweden", "EUROPE", "REAL_ESTATE_LOGISTICS", 4400, 27, "SLOW", "WEB_ECOM", 87, 9500, "BOOKED", 8],
  ["Omar", "Al-Mansoori", "Founder", "Gulf Crate Logistics", "gulfcrate.ae", "United Arab Emirates", "UAE", "REAL_ESTATE_LOGISTICS", 5200, 41, "SEC", "MANAGED_IT", 91, 15000, "BOOKED", 4],
  ["Hannah", "Brooks", "Operations Director", "Tidewater Eats Group", "tidewatereats.com", "United States", "US", "HOSPITALITY", 2700, 63, "DEV", "STAFF_AUG", 85, 6500, "BOOKED", 9],
  ["Callum", "Pryce", "CTO", "PayBridge Labs", "paybridgelabs.co.uk", "United Kingdom", "UK", "FINTECH", 3900, 22, "DEV", "STAFF_AUG", 92, 18000, "BOOKED", 7],
  ["Laila", "Haddad", "Co-Founder & CEO", "Majlis Learning", "majlislearning.ae", "United Arab Emirates", "UAE", "EDTECH", 1600, 16, "ADS", "DIGITAL_MARKETING", 86, 5200, "BOOKED", 3],
  ["Jonas", "Weber", "Founder", "Kaffeehaus Collective", "kaffeehauscollective.de", "Germany", "EUROPE", "HOSPITALITY", 1200, 29, "SLOW", "WEB_ECOM", 82, 3500, "BOOKED", 5],
  ["Emily", "Carver", "CEO", "Stackwell Supply", "stackwellsupply.com", "United States", "US", "ECOMMERCE_RETAIL", 7400, 52, "ADS", "DIGITAL_MARKETING", 94, 14000, "BOOKED", 10],
  // ── REPLIED, awaiting booking (3)
  ["Rashid", "Khan", "Co-Founder", "FitForge Studios", "fitforgestudios.ae", "United Arab Emirates", "UAE", "HOSPITALITY", 1900, 38, "SLOW", "WEB_ECOM", 83, 4200, "REPLIED", 3],
  ["Isabelle", "Moreau", "CEO", "Atelier Pontoise", "atelierpontoise.fr", "France", "EUROPE", "ECOMMERCE_RETAIL", 2600, 19, "SEC", "MANAGED_IT", 80, 2800, "REPLIED", 4],
  ["Tom", "Eriksen", "CTO", "ClassCircle", "classcircle.io", "United States", "US", "EDTECH", 2300, 15, "DEV", "STAFF_AUG", 88, 7800, "REPLIED", 2],
  // ── NOT INTERESTED (2)
  ["Greg", "Sutton", "Founder", "Sutton Parcel Co", "suttonparcel.com", "United States", "US", "REAL_ESTATE_LOGISTICS", 900, 9, "ADS", "DIGITAL_MARKETING", 71, 1800, "NOT_INTERESTED", 6],
  ["Lena", "Fischer", "Operations Director", "Fischer Fulfilment", "fischerfulfilment.de", "Germany", "EUROPE", "REAL_ESTATE_LOGISTICS", 3100, 33, "SEC", "MANAGED_IT", 74, 4000, "NOT_INTERESTED", 5],
  // ── BREAKUP SENT (2)
  ["Aiden", "Foster", "CEO", "Foster & Finch Interiors", "fosterfinch.co.uk", "United Kingdom", "UK", "ECOMMERCE_RETAIL", 1500, 12, "SLOW", "WEB_ECOM", 78, 3200, "BREAKUP_SENT", 12],
  ["Noura", "Al-Suwaidi", "Co-Founder", "Souq Basket", "souqbasket.ae", "United Arab Emirates", "UAE", "ECOMMERCE_RETAIL", 2200, 21, "ADS", "DIGITAL_MARKETING", 79, 4500, "BREAKUP_SENT", 13],
  // ── FOLLOW-UP 3 (5)
  ["Ben", "Hargrove", "Founder & CEO", "Hargrove Pay", "hargrovepay.com", "United States", "US", "FINTECH", 4800, 26, "SEC", "MANAGED_IT", 86, 11000, "FOLLOWUP_3", 8],
  ["Charlotte", "Dubois", "CEO", "Maison Dubois Épicerie", "maisondubois.fr", "France", "EUROPE", "HOSPITALITY", 1100, 24, "SLOW", "WEB_ECOM", 76, 2500, "FOLLOWUP_3", 8],
  ["Faisal", "Rahman", "CTO", "Zayed Rentals", "zayedrentals.ae", "United Arab Emirates", "UAE", "REAL_ESTATE_LOGISTICS", 3600, 30, "DEV", "STAFF_AUG", 84, 9000, "FOLLOWUP_3", 7],
  ["Megan", "Doyle", "Operations Director", "Corkline Coffee Roasters", "corklinecoffee.ie", "Ireland", "EUROPE", "HOSPITALITY", 1400, 31, "ADS", "DIGITAL_MARKETING", 77, 3000, "FOLLOWUP_3", 9],
  ["Ryan", "Castellano", "Co-Founder", "Vaultline", "vaultline.io", "United States", "US", "FINTECH", 5500, 29, "DEV", "STAFF_AUG", 90, 16000, "FOLLOWUP_3", 8],
  // ── FOLLOW-UP 2 (7)
  ["Eleanor", "Whitcombe", "Founder", "Whitcombe Wellness", "whitcombewellness.co.uk", "United Kingdom", "UK", "ECOMMERCE_RETAIL", 1800, 13, "SLOW", "WEB_ECOM", 81, 4000, "FOLLOWUP_2", 4],
  ["Arjun", "Mehta", "CEO", "RentSure UK", "rentsure.co.uk", "United Kingdom", "UK", "REAL_ESTATE_LOGISTICS", 2900, 20, "ADS", "DIGITAL_MARKETING", 80, 5500, "FOLLOWUP_2", 4],
  ["Katarina", "Novak", "CTO", "Skolo Academy", "skolo.eu", "Netherlands", "EUROPE", "EDTECH", 1700, 17, "DEV", "STAFF_AUG", 85, 7200, "FOLLOWUP_2", 5],
  ["Dylan", "Pearce", "Founder", "Pearce Fitness Hubs", "pearcefitnesshubs.com", "United States", "US", "HOSPITALITY", 2400, 45, "SLOW", "WEB_ECOM", 79, 5000, "FOLLOWUP_2", 3],
  ["Mariam", "Al-Zaabi", "CEO", "Noor Furnishings", "noorfurnishings.ae", "United Arab Emirates", "UAE", "ECOMMERCE_RETAIL", 3300, 25, "SEC", "MANAGED_IT", 82, 6000, "FOLLOWUP_2", 4],
  ["Lucas", "Bianchi", "Founder", "Bianchi Moda", "bianchimoda.it", "Italy", "EUROPE", "ECOMMERCE_RETAIL", 2000, 16, "ADS", "DIGITAL_MARKETING", 78, 3800, "FOLLOWUP_2", 5],
  ["Harriet", "Lowe", "Co-Founder", "Lowe Lending", "lowelending.co.uk", "United Kingdom", "UK", "FINTECH", 4100, 24, "SEC", "MANAGED_IT", 87, 10500, "FOLLOWUP_2", 4],
  // ── STEP 1 SENT (10)
  ["Nathan", "Cole", "CEO", "Cole Freight Tech", "colefreight.com", "United States", "US", "REAL_ESTATE_LOGISTICS", 6200, 48, "DEV", "STAFF_AUG", 89, 13000, "STEP_1_SENT", 1],
  ["Amira", "Saleh", "Founder", "Saleh Skin Co", "salehskin.ae", "United Arab Emirates", "UAE", "ECOMMERCE_RETAIL", 1300, 11, "SLOW", "WEB_ECOM", 80, 3600, "STEP_1_SENT", 1],
  ["Pieter", "De Vries", "CTO", "Grachtpay", "grachtpay.nl", "Netherlands", "EUROPE", "FINTECH", 3400, 21, "SEC", "MANAGED_IT", 84, 8800, "STEP_1_SENT", 2],
  ["Zoe", "Mitchell", "Operations Director", "Mitchell Hospitality Group", "mitchellhg.co.uk", "United Kingdom", "UK", "HOSPITALITY", 4900, 88, "DEV", "STAFF_AUG", 83, 7000, "STEP_1_SENT", 1],
  ["Kevin", "Tran", "Co-Founder", "Brightlane Education", "brightlane.edu.co", "United States", "US", "EDTECH", 1500, 12, "ADS", "DIGITAL_MARKETING", 77, 3400, "STEP_1_SENT", 2],
  ["Elena", "Garcia", "CEO", "Casa Marea Rentals", "casamarea.es", "Spain", "EUROPE", "REAL_ESTATE_LOGISTICS", 2800, 19, "SLOW", "WEB_ECOM", 79, 5200, "STEP_1_SENT", 0],
  ["Yusuf", "Karim", "Founder & CEO", "Falcon Eats", "falconeats.ae", "United Arab Emirates", "UAE", "HOSPITALITY", 2100, 36, "ADS", "DIGITAL_MARKETING", 81, 4600, "STEP_1_SENT", 1],
  ["Imogen", "Ward", "CTO", "Wardrobe Loop", "wardrobeloop.co.uk", "United Kingdom", "UK", "ECOMMERCE_RETAIL", 2500, 17, "SEC", "MANAGED_IT", 82, 5800, "STEP_1_SENT", 0],
  ["Jacob", "Lindgren", "Co-Founder", "Fjord Learn", "fjordlearn.se", "Sweden", "EUROPE", "EDTECH", 1900, 14, "DEV", "STAFF_AUG", 86, 7500, "STEP_1_SENT", 2],
  ["Chloe", "Bennett", "CEO", "Bennett Brew Bars", "bennettbrew.com", "United States", "US", "HOSPITALITY", 1700, 28, "SLOW", "WEB_ECOM", 78, 3900, "STEP_1_SENT", 1],
  // ── VERIFIED / SCRAPED, queued (6)
  ["Samir", "Joshi", "Founder", "Joshi Home Goods", "joshihome.com", "United States", "US", "ECOMMERCE_RETAIL", 2200, 15, "ADS", "DIGITAL_MARKETING", 75, 3500, "VERIFIED", 0],
  ["Anna", "Kowalska", "CEO", "Kowalska Logistics", "kowalska-log.eu", "Poland", "EUROPE", "REAL_ESTATE_LOGISTICS", 3700, 37, "SEC", "MANAGED_IT", 80, 7600, "VERIFIED", 0],
  ["Reem", "Al-Hashimi", "Co-Founder", "Reem Realty", "reemrealty.ae", "United Arab Emirates", "UAE", "REAL_ESTATE_LOGISTICS", 4600, 32, "SLOW", "WEB_ECOM", 84, 9800, "VERIFIED", 0],
  ["Felix", "Hartmann", "CTO", "Hartmann Pay", "hartmannpay.de", "Germany", "EUROPE", "FINTECH", 5100, 28, "DEV", "STAFF_AUG", 88, 14500, "VERIFIED", 0],
  ["Georgia", "Pike", "Founder", "Pike & Co Studios", "pikeandco.co.uk", "United Kingdom", "UK", "HOSPITALITY", 1000, 22, "ADS", "DIGITAL_MARKETING", 72, 2200, "SCRAPED", 0],
  ["Trevor", "Nash", "Operations Director", "Nash Cold Chain", "nashcoldchain.com", "United States", "US", "REAL_ESTATE_LOGISTICS", 8200, 70, "SEC", "MANAGED_IT", 90, 17500, "SCRAPED", 0],
];

// ── deterministic pseudo-random
let seedN = 20260519;
const rnd = () => ((seedN = (seedN * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];

// ── procedural volume: realistic reply rates need many more sent-but-unreplied leads
const NAMES: Record<string, { first: string[]; last: string[]; countries: string[]; tld: string }> = {
  US: { first: ["James", "Olivia", "Ethan", "Ava", "Liam", "Mia", "Noah", "Sofia", "Jack", "Grace", "Wyatt", "Hailey", "Caleb", "Nora", "Miles"], last: ["Parker", "Bennett", "Hayes", "Morgan", "Coleman", "Reed", "Brooks", "Ellis", "Gray", "Sullivan", "Warren", "Hughes", "Dixon", "Boyd", "Fleming"], countries: ["United States"], tld: "com" },
  UK: { first: ["Harry", "Amelia", "George", "Isla", "Arthur", "Poppy", "Freddie", "Ruby", "Alfie", "Evie", "Theo", "Lily", "Oscar", "Daisy", "Rory"], last: ["Thompson", "Walker", "Hughes", "Clarke", "Bailey", "Morris", "Fletcher", "Barnes", "Holt", "Marsh", "Dawson", "Gibbs", "Hardy", "Pratt", "Shaw"], countries: ["United Kingdom"], tld: "co.uk" },
  EUROPE: { first: ["Matteo", "Clara", "Lukas", "Elsa", "Mathis", "Nina", "Pablo", "Freya", "Henrik", "Ingrid", "Tomas", "Marta", "Jan", "Eva", "Andre"], last: ["Rossi", "Keller", "Jansen", "Larsen", "Navarro", "Schmidt", "Dumont", "Lopez", "Berg", "Vogel", "Costa", "Lang", "Moreau", "Fabre", "Haas"], countries: ["Germany", "France", "Netherlands", "Spain", "Italy", "Sweden", "Ireland"], tld: "eu" },
  UAE: { first: ["Khalid", "Aisha", "Hamad", "Mariam", "Saeed", "Layla", "Tariq", "Huda", "Zaid", "Dana", "Rami", "Salma", "Nasser", "Yara", "Adel"], last: ["Al-Marri", "Qasimi", "Nuaimi", "Kaabi", "Shamsi", "Hammadi", "Mazrouei", "Dhaheri", "Ketbi", "Falasi", "Suwaidi", "Hosani", "Remeithi", "Yousef", "Tamimi"], countries: ["United Arab Emirates"], tld: "ae" },
};
const COMPANY_WORDS: Record<string, [string[], string[]]> = {
  ECOMMERCE_RETAIL: [["Harbor", "Willow", "Ember", "Alder", "Pebble", "Northern", "Juniper", "Copper", "Maple", "Saffron"], ["Goods", "Supply", "Threads", "Home", "Market", "Provisions", "Outfitters", "Collective"]],
  FINTECH: [["Ledger", "Pivot", "Clearpath", "Vector", "Meridian", "Tally", "Quanta", "Nimbus", "Apex", "Cobalt"], ["Pay", "Labs", "Capital", "Finance", "Credit", "Wallet", "Bank", "Treasury"]],
  REAL_ESTATE_LOGISTICS: [["Summit", "Keystone", "Atlas", "Cornerstone", "Anchor", "Harbour", "Bridgeway", "Blue Ridge", "Granite", "Skyline"], ["Properties", "Freight", "Logistics", "Realty", "Cargo", "Estates", "Lettings", "Haulage"]],
  EDTECH: [["Bright", "Lumen", "Scholar", "Pathway", "Mentor", "Spark", "Cadence", "Beacon", "Quill", "Orbit"], ["Learn", "Academy", "Classroom", "Tutors", "Campus", "Skills", "Education", "Lab"]],
  HOSPITALITY: [["Olive", "Ember", "Brass", "Velvet", "Sage", "Marigold", "Cinder", "Hearth", "Basil", "Oak"], ["Kitchen", "Cafe", "Eats", "Brew Bar", "Bistro", "Fitness Club", "Roasters", "Table"]],
};
const SERVICE_BY_PAIN: Record<Pain, string> = { SLOW: "WEB_ECOM", ADS: "DIGITAL_MARKETING", SEC: "MANAGED_IT", DEV: "STAFF_AUG" };
const TICKET_BASE: Record<string, number> = { WEB_ECOM: 4200, DIGITAL_MARKETING: 3400, STAFF_AUG: 7200, MANAGED_IT: 5600 };
const EXTRA_ROLES = ["Founder", "Co-Founder", "CEO", "CTO", "Operations Director", "Founder & CEO", "Co-Founder & CTO"];

function extraRows(count: number, taken: Set<string>): Row[] {
  const plan: [string, number][] = [["STEP_1_SENT", 0.28], ["FOLLOWUP_2", 0.27], ["FOLLOWUP_3", 0.2], ["BREAKUP_SENT", 0.12], ["VERIFIED", 0.13]];
  const dayRange: Record<string, [number, number]> = { STEP_1_SENT: [0, 2], FOLLOWUP_2: [3, 5], FOLLOWUP_3: [7, 9], BREAKUP_SENT: [11, 13], VERIFIED: [0, 0] };
  const regions = ["US", "US", "UK", "EUROPE", "EUROPE", "UAE"];
  const inds = ["ECOMMERCE_RETAIL", "ECOMMERCE_RETAIL", "FINTECH", "REAL_ESTATE_LOGISTICS", "EDTECH", "HOSPITALITY", "HOSPITALITY"];
  const pains: Pain[] = ["SLOW", "SLOW", "ADS", "ADS", "SEC", "DEV"];
  const out: Row[] = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 20) {
    const region = pick(regions);
    const n = NAMES[region];
    const first = pick(n.first);
    const last = pick(n.last);
    const industry = pick(inds);
    const [pre, suf] = COMPANY_WORDS[industry];
    const company = `${pick(pre)} ${pick(suf)}`;
    const domain = `${company.toLowerCase().replace(/[^a-z]/g, "")}.${n.tld}`;
    const key = `${first.toLowerCase()}@${domain}`;
    if (taken.has(key) || taken.has(domain)) continue;
    taken.add(key);
    taken.add(domain);
    const pain = pick(pains);
    const service = SERVICE_BY_PAIN[pain];
    const revenueK = Math.round((100 + Math.pow(rnd(), 1.7) * 9800) / 50) * 50;
    const ticket = Math.min(25000, Math.max(1000, Math.round((TICKET_BASE[service] * (0.55 + (revenueK / 10000) * 1.9)) / 100) * 100));
    let r = rnd();
    let stage = plan[0][0];
    for (const [s, w] of plan) {
      if ((r -= w) <= 0) {
        stage = s;
        break;
      }
    }
    const [dlo, dhi] = dayRange[stage];
    out.push([
      first, last, pick(EXTRA_ROLES), company, domain, pick(n.countries), region, industry, revenueK,
      Math.max(4, Math.round(revenueK / 90 + rnd() * 12)), pain, service, Math.floor(70 + rnd() * 25), ticket, stage,
      dlo + Math.floor(rnd() * (dhi - dlo + 1)),
    ]);
  }
  return out;
}

// ── timezone helpers (so meetings land in sensible LOCAL business hours)
function tzParts(d: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short" });
  return Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value])) as Record<string, string>;
}
function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, tz: string) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const p = tzParts(new Date(guess), tz);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return new Date(guess - (asUtc - guess));
}
/** `dayOffset` business days from today (in tz) at local hh:mm. */
function businessSlot(dayOffset: number, hh: number, mm: number, tz: string) {
  const step = dayOffset < 0 ? -1 : 1;
  let remaining = Math.abs(dayOffset);
  let cursor = new Date();
  while (remaining > 0) {
    cursor = new Date(cursor.getTime() + step * 86400000);
    const wd = tzParts(cursor, tz).weekday;
    if (wd !== "Sat" && wd !== "Sun") remaining--;
  }
  let p = tzParts(cursor, tz);
  while (p.weekday === "Sat" || p.weekday === "Sun") {
    cursor = new Date(cursor.getTime() + step * 86400000);
    p = tzParts(cursor, tz);
  }
  return zonedToUtc(+p.year, +p.month, +p.day, hh, mm, tz);
}
const TZ_BY_REGION: Record<string, string> = { US: "America/New_York", UK: "Europe/London", EUROPE: "Europe/Berlin", UAE: "Asia/Dubai" };

const H = 3600_000;
const D = 24 * H;
const now = Date.now();

function audit(pain: Pain, r: Row) {
  const lcp = pain === "SLOW" ? +(4.2 + rnd() * 3.1).toFixed(1) : +(1.8 + rnd() * 1.6).toFixed(1);
  const psi = pain === "SLOW" ? Math.floor(22 + rnd() * 26) : Math.floor(55 + rnd() * 30);
  const stackByService: Record<string, string[]> = {
    WEB_ECOM: ["Shopify (legacy theme)", "jQuery 1.12", "WordPress 5.8"],
    DIGITAL_MARKETING: ["WooCommerce", "Google Analytics UA only", "Mailchimp embed"],
    STAFF_AUG: ["React 16", "Node.js 12 API", "Self-hosted CI"],
    MANAGED_IT: ["PHP 7.2", "cPanel hosting", "Unmanaged VPS"],
  };
  return {
    domain: r[4],
    pageSpeedMobile: psi,
    lcpSeconds: lcp,
    hasMetaPixel: pain === "ADS" ? false : rnd() > 0.35,
    hasGa4: pain === "ADS" ? rnd() > 0.7 : true,
    hasGtm: rnd() > 0.5,
    https: true,
    securityHeaders: { hsts: pain !== "SEC", csp: false, xFrameOptions: pain !== "SEC" },
    techStack: stackByService[r[11]] ?? [],
    metaDescriptionPresent: pain !== "ADS",
    mobileViewport: true,
  };
}

function painTexts(pain: Pain, a: ReturnType<typeof audit>, r: Row) {
  switch (pain) {
    case "SLOW":
      return {
        tag: "Slow website",
        detail: `Mobile Largest Contentful Paint is ${a.lcpSeconds}s (PageSpeed ${a.pageSpeedMobile}/100). Anything over 2.5s measurably hurts conversions on ${r[3]}'s product and booking pages.`,
      };
    case "ADS":
      return {
        tag: "Wasted ad spend",
        detail: `No Meta Pixel and no GA4 conversion events detected on ${r[4]}. Paid traffic can't be optimized or attributed, so ad ROI is effectively unmeasured.`,
      };
    case "SEC":
      return {
        tag: "Security gaps",
        detail: `${r[4]} is missing HSTS and a Content-Security-Policy header and runs an outdated stack (${a.techStack[0] ?? "legacy hosting"}). No visible managed-security posture.`,
      };
    case "DEV":
      return {
        tag: "No reliable dev support",
        detail: `${r[3]} has had engineering roles open for months and the site's last visible release is stale (${a.techStack[0] ?? "legacy stack"}). Roadmap is bottlenecked on hiring.`,
      };
  }
}

const SERVICE_PHRASE: Record<string, { offer: string; proof: string; bottleneck: string }> = {
  WEB_ECOM: {
    offer: "a fixed-scope, fixed-price rebuild/optimization sprint on your storefront",
    proof: "we took a Shopify merchant's mobile LCP from 6.1s to 2.1s in 3 weeks on a fixed price — checkout completion rose by double digits",
    bottleneck: "the render-blocking scripts and unoptimized images that are still on your key pages",
  },
  DIGITAL_MARKETING: {
    offer: "a fixed-price tracking fix plus a 60-day Google & Meta Ads and SEO plan with reporting you can audit",
    proof: "after we fixed pixel/GA4 tracking for a DTC brand and rebuilt its Meta campaigns, cost per acquisition dropped within the first billing cycle",
    bottleneck: "the missing conversion events — every day without them, the ad algorithms optimize blind",
  },
  STAFF_AUG: {
    offer: "pre-vetted dedicated developers and designers who plug into your team within days, not months",
    proof: "we embedded two senior React/Node engineers into a scaling startup in under two weeks, clearing a 5-month backlog",
    bottleneck: "the open engineering roles that keep slipping while your roadmap waits",
  },
  MANAGED_IT: {
    offer: "managed IT with 24/7 helpdesk, cloud hardening and Google Workspace / Microsoft 365 security under one accountable team",
    proof: "we migrated an SMB to a hardened, monitored cloud setup with zero downtime during cutover, on a fixed monthly fee",
    bottleneck: "the unpatched stack and missing security headers that attackers scan for first",
  },
};

function buildEmails(r: Row, pain: { tag: string; detail: string }) {
  const f = r[0];
  const s = SERVICE_PHRASE[r[11]];
  return [
    {
      subject: `${r[3]}: ${pain.tag.toLowerCase()} spotted on ${r[4]}`,
      body: `Hi ${f},\n\nI was looking at ${r[4]} and noticed something specific: ${pain.detail}\n\nFenebris is a single accountable tech partner (web, marketing, staff augmentation and managed IT). For ${r[3]}, I'd suggest ${s.offer}. Fixed scope, fixed price, fast delivery — no surprises.\n\nWorth a 20-minute look together? You can pick any slot here: ${BOOKING}\n\nBest,\nAarav Mehta\nFenebris India Pvt. Ltd.`,
    },
    {
      subject: `Re: ${r[3]}: ${pain.tag.toLowerCase()} spotted on ${r[4]}`,
      body: `Hi ${f},\n\nQuick follow-up with a concrete example: ${s.proof}.\n\nSame model applies to ${r[3]} — fixed price, fixed scope, delivered fast, with zero downtime.\n\nIf useful, grab 20 minutes here and I'll walk through what it would look like for you: ${BOOKING}\n\nAarav`,
    },
    {
      subject: `Still on the radar: ${r[4]}`,
      body: `Hi ${f},\n\nOne reminder on the technical side: ${s.bottleneck}. It's usually a short fix, but it compounds the longer it waits.\n\nHappy to share the exact findings from our audit of ${r[4]} on a quick call: ${BOOKING}\n\nAarav`,
    },
    {
      subject: `Closing the loop, ${f}`,
      body: `Hi ${f},\n\nI don't want to clutter your inbox, so this will be my last note. If ${pain.tag.toLowerCase()} isn't a priority at ${r[3]} right now, no worries at all.\n\nIf it becomes one, the audit is yours any time: ${BOOKING}\n\nAll the best,\nAarav`,
    },
  ];
}

function discoveryQuestions(service: string, r: Row) {
  const q: Record<string, string[]> = {
    WEB_ECOM: [
      `What share of ${r[3]}'s revenue comes through mobile, and what's the current mobile conversion rate?`,
      "Which platform constraints (theme, plugins, hosting) have blocked performance work so far?",
      "What would a fixed-price, 3–4 week sprint need to deliver for it to clearly pay for itself?",
    ],
    DIGITAL_MARKETING: [
      "What's the current monthly ad spend and how do you attribute revenue to each channel today?",
      "Has tracking (Pixel/GA4/server-side) been audited, and who owns it internally?",
      "What CAC or ROAS target would make scaling spend an easy decision?",
    ],
    STAFF_AUG: [
      "Which roles are open, for how long, and what has the hiring pipeline looked like?",
      "What stack and process would a dedicated developer need to be productive in week one?",
      "What does success look like at 30/60/90 days and how is delivery measured?",
    ],
    MANAGED_IT: [
      "Who handles IT and security today, and what happens out-of-hours when something breaks?",
      "Which compliance or customer-security requirements are you being asked about?",
      "What would zero-downtime migration and a fixed monthly fee need to look like?",
    ],
  };
  return q[service];
}

function slotEmail(first: string, slots: string[]) {
  return `Hi ${first},\n\nGreat to hear it. Here are three times that work on our side:\n${slots.map((s) => `• ${s}`).join("\n")}\n\nOr pick any slot that suits you: ${BOOKING}\n\nBest,\nFenebris Team`;
}

// `--demo` adds the fictional data WITHOUT deleting anything and tags every lead source="demo"; `--remove-demo` removes exactly that.
// Plain `seed` still wipes every table first (local use only, never against the live database).
const DEMO = process.argv.includes("--demo");
const REMOVE_DEMO = process.argv.includes("--remove-demo");

async function removeDemo() {
  const reports = await db.weeklyReport.deleteMany({ where: { shareToken: { startsWith: "demo" } } });
  const leads = await db.lead.deleteMany({ where: { source: "demo" } }); // sequences, events and meetings cascade
  console.log(`Removed ${leads.count} demo leads (and their emails, events, meetings) and ${reports.count} demo reports.`);
}

async function main() {
  if (REMOVE_DEMO) return removeDemo();
  if (DEMO && (await db.lead.count({ where: { source: "demo" } })) > 0) {
    console.log("Demo data is already loaded. Run with --remove-demo first to reload.");
    return;
  }
  if (!DEMO) {
    console.log("Resetting tables…");
    await db.weeklyReport.deleteMany();
    await db.meeting.deleteMany();
    await db.emailEvent.deleteMany();
    await db.campaignSequence.deleteMany();
    await db.lead.deleteMany();
  }

  // Meeting plan keyed by lead first name. `soonMin` = minutes from now (to demo live countdown),
  // otherwise `day` business days away at local `hh:mm` in the prospect's timezone.
  type Plan = { soonMin?: number; day?: number; hh?: number; mm?: number; status: string; createdDaysAgo: number };
  const meetingPlan: Record<string, Plan> = {
    Omar: { soonMin: 50, status: "SCHEDULED", createdDaysAgo: 1 },
    Laila: { soonMin: 210, status: "SCHEDULED", createdDaysAgo: 2 },
    Oliver: { day: 1, hh: 14, mm: 0, status: "SCHEDULED", createdDaysAgo: 1 },
    Sophie: { day: 2, hh: 10, mm: 30, status: "SCHEDULED", createdDaysAgo: 3 },
    Marcus: { day: 2, hh: 10, mm: 0, status: "SCHEDULED", createdDaysAgo: 2 },
    Priya: { day: 3, hh: 11, mm: 30, status: "SCHEDULED", createdDaysAgo: 0 },
    Callum: { day: 5, hh: 15, mm: 0, status: "RESCHEDULED", createdDaysAgo: 3 },
    Hannah: { day: -1, hh: 11, mm: 0, status: "COMPLETED_PROPOSAL_SENT", createdDaysAgo: 5 },
    Emily: { day: -2, hh: 10, mm: 0, status: "CLOSED_WON", createdDaysAgo: 7 },
    Jonas: { day: -3, hh: 14, mm: 0, status: "NO_SHOW", createdDaysAgo: 6 },
  };

  const taken = new Set(ROWS.flatMap((r) => [`${r[0].toLowerCase()}@${r[4]}`, r[4]]));
  const ALL_ROWS: Row[] = [...ROWS, ...extraRows(112, taken)];

  for (const [i, r] of ALL_ROWS.entries()) {
    const [first, last, role, company, domain, country, region, industry, revenueK, employees, pain, service, score, ticket, stage, daysAgo] = r;
    const a = audit(pain, r);
    const p = painTexts(pain, a, r)!;
    const emails = buildEmails(r, p);
    const qs = discoveryQuestions(service, r);

    const stageStep: Record<string, number> = {
      SCRAPED: 0, VERIFIED: 0, STEP_1_SENT: 1, FOLLOWUP_2: 2, FOLLOWUP_3: 3, BREAKUP_SENT: 4, REPLIED: 2, BOOKED: 2, NOT_INTERESTED: 2,
    };
    const step = stageStep[stage] ?? 0;
    const started = now - daysAgo * D - rnd() * 4 * H;
    const dayOfStep = [0, 3, 7, 11];
    const verified = stage !== "SCRAPED";

    const sentiment =
      stage === "BOOKED" ? "Positive_Booking_Intent"
      : stage === "NOT_INTERESTED" ? "Not_Interested"
      : stage === "REPLIED" ? (i % 2 === 0 ? "Positive_Booking_Intent" : "Question_Needs_FollowUp")
      : null;
    const repliedAt = sentiment ? new Date(started + (dayOfStep[step - 1] ?? 3) * D + 5 * H) : null;

    const lead = await db.lead.create({
      data: {
        email: `${first.toLowerCase().replace(/[^a-z]/g, "")}@${domain}`,
        emailStatus: verified ? "VALID" : "UNVERIFIED",
        firstName: first,
        lastName: last,
        role,
        linkedinUrl: `https://www.linkedin.com/in/${first.toLowerCase()}-${last.toLowerCase().replace(/[^a-z]/g, "")}`,
        companyName: company,
        companyDomain: domain,
        companyWebsite: `https://${domain}`,
        country,
        region,
        industry,
        employeeCount: employees,
        annualRevenue: revenueK * 1000,
        painPoint: p.tag,
        painPointDetail: p.detail,
        auditFindings: a as unknown as Prisma.InputJsonValue,
        recommendedService: service,
        qualificationScore: score,
        estimatedTicket: ticket,
        dossier: {
          summary: `${company} (${country}) — ${p.detail} Recommended pillar: ${service.replace(/_/g, " ").toLowerCase()}. Est. project ${ticket.toLocaleString("en-US")}+ USD.`,
          discoveryQuestions: qs,
          talkingPoints: [
            "Lead with the audited finding, then the fixed-price / fixed-scope model.",
            "Single accountable tech backbone: web, marketing, staff augmentation and managed IT under one team.",
            "Zero-downtime delivery and fast cycles — anchor on a 3–4 week first milestone.",
          ],
        } as unknown as Prisma.InputJsonValue,
        stage,
        currentStep: step,
        sequencePaused: false,
        replySentiment: sentiment,
        needsHuman: stage === "REPLIED" && sentiment === "Question_Needs_FollowUp",
        repliedAt,
        outreachLeadId: verified ? `${DEMO ? "demo" : "inst"}_${1000 + i}` : null,
        campaignId: "camp_fenebris_icp_q4",
        ...(DEMO ? { source: "demo" } : {}),
        createdAt: new Date(started - 6 * H),
      },
    });

    // sequences
    for (let s = 1; s <= 4; s++) {
      const sentThis = s <= step;
      const scheduledAt = new Date((verified ? started : now + D) + dayOfStep[s - 1] * D);
      const replied = !!sentiment && s === step;
      await db.campaignSequence.create({
        data: {
          leadId: lead.id,
          step: s,
          subject: emails[s - 1].subject,
          body: emails[s - 1].body,
          scheduledAt,
          sentAt: sentThis ? scheduledAt : null,
          status: sentThis ? "SENT" : "SCHEDULED",
          opens: sentThis ? (rnd() > 0.38 ? 1 + Math.floor(rnd() * 3) : 0) + (replied ? 1 : 0) : 0,
          clicks: sentThis && (rnd() > 0.82 || replied) ? 1 : 0,
          replied,
        },
      });
      if (sentThis) {
        await db.emailEvent.create({
          data: {
            leadId: lead.id, type: "EMAIL_SENT", step: s, subject: emails[s - 1].subject, body: emails[s - 1].body,
            externalId: `msg_${i}_${s}`, occurredAt: scheduledAt,
          },
        });
      }
    }

    // reply thread + AI response
    if (sentiment) {
      const when = repliedAt!;
      const replyText =
        sentiment === "Positive_Booking_Intent"
          ? pick([
              `Hi, this is timely — our ${pain === "SLOW" ? "site speed" : pain === "ADS" ? "ad tracking" : pain === "SEC" ? "security setup" : "dev capacity"} has been a headache. Can we talk this week?`,
              "Interesting. Send me times, happy to take a look at the audit together.",
              "Yes, please. Let's set up a call — what does your calendar look like?",
            ])
          : sentiment === "Question_Needs_FollowUp"
            ? "Thanks for reaching out. Before I commit time: do you work on fixed price for Magento-to-Shopify migrations, and could you share a recent example with numbers?"
            : "Thanks, but we're locked into an agency contract through next year. Please remove me from your list.";
      await db.emailEvent.create({
        data: {
          leadId: lead.id, type: "REPLY_RECEIVED", step, subject: `Re: ${emails[step - 1].subject}`, body: replyText,
          externalId: `reply_${i}`, sentiment, needsHuman: stage === "REPLIED" && sentiment === "Question_Needs_FollowUp", occurredAt: when,
        },
      });
      if (sentiment === "Positive_Booking_Intent") {
        const slots = ["Tue 10:30", "Wed 15:00", "Thu 11:00"].map((t) => `${t} (your local time)`);
        await db.emailEvent.create({
          data: {
            leadId: lead.id, type: "AI_REPLY_SENT", step, subject: `Re: ${emails[step - 1].subject}`,
            body: slotEmail(first, slots), aiReply: slotEmail(first, slots), aiReplySent: true, sentiment,
            occurredAt: new Date(when.getTime() + 4 * 60000),
          },
        });
      }
      if (stage === "REPLIED" && sentiment === "Question_Needs_FollowUp") {
        await db.emailEvent.create({
          data: {
            leadId: lead.id, type: "AI_REPLY_SENT", step, subject: `Re: ${emails[step - 1].subject}`,
            aiReply: `Hi ${first},\n\nYes — we quote fixed price after a scoping call, including platform migrations. I can share a recent anonymised example with before/after numbers on a 20-minute call: ${BOOKING}`,
            aiReplySent: false, needsHuman: true, sentiment, occurredAt: new Date(when.getTime() + 2 * 60000),
          },
        });
      }
    }

    // meetings
    if (stage === "BOOKED") {
      const plan = meetingPlan[first];
      const tz = TZ_BY_REGION[region];
      const start =
        plan.soonMin !== undefined
          ? new Date(Math.ceil((now + plan.soonMin * 60000) / (15 * 60000)) * 15 * 60000)
          : businessSlot(plan.day!, plan.hh!, plan.mm!, tz);
      const end = new Date(start.getTime() + 30 * 60000);
      const code = (n: number) => Math.abs(Math.sin(i * 12.9898 + n) * 43758).toString(36).replace(".", "").slice(0, 3).padEnd(3, "x");
      await db.meeting.create({
        data: {
          leadId: lead.id,
          calBookingUid: `seed_booking_${i}`,
          startTime: start,
          endTime: end,
          prospectTimezone: tz,
          meetLink: `https://meet.google.com/${code(1)}-${code(2)}x-${code(3)}`,
          calendarEventId: `seed_evt_${i}`,
          calendarEventUrl: `https://calendar.google.com/calendar/u/0/r/day/${start.getUTCFullYear()}/${start.getUTCMonth() + 1}/${start.getUTCDate()}`,
          status: plan.status,
          estimatedTicket: ticket,
          notes:
            plan.status === "CLOSED_WON"
              ? "Agreed scope + fixed price on call. Contract signed same day."
              : plan.status === "COMPLETED_PROPOSAL_SENT"
                ? "Strong fit. Proposal (fixed price, 4-week milestone) sent post-call."
                : plan.status === "NO_SHOW"
                  ? "No show — AI follow-up email with new booking link queued."
                  : "",
          createdAt: new Date(now - plan.createdDaysAgo * D - 2 * H),
        },
      });
    }
  }

  // Weekly reports (last full week + current week-to-date)
  const mondayOf = (d: Date) => {
    const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - day); return x;
  };
  const thisMon = mondayOf(new Date());
  const lastMon = new Date(thisMon.getTime() - 7 * D);
  const lastSun = new Date(thisMon.getTime() - 1);
  for (const [s, e] of [[lastMon, lastSun], [thisMon, new Date()]] as const) {
    const metrics = await computeReportMetrics(s, e);
    await db.weeklyReport.create({
      data: {
        weekStart: s, weekEnd: e, metrics: metrics as unknown as Prisma.InputJsonValue,
        shareToken: (DEMO ? "demo" : "") + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10),
      },
    });
  }

  const [l, m, s, ev] = await Promise.all([db.lead.count(), db.meeting.count(), db.campaignSequence.count(), db.emailEvent.count()]);
  console.log(`Seeded ${l} leads, ${s} sequence emails, ${ev} events, ${m} meetings.`);
}

main().finally(() => db.$disconnect());
