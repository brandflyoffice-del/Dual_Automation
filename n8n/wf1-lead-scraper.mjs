import { Workflow, webhook, respond, ifNode, http, code, postgres, noop, sticky, dashboardNotify, smartleadUrl } from "./lib.mjs";
import { QUALIFY_AND_SEQUENCE_SYSTEM } from "./prompts.mjs";

export function buildWorkflow1() {
  const w = new Workflow("Fenebris_01_Lead_Scraper_And_AI_Enrichment");

  sticky(
    w,
    "## Fenebris_01 — Lead Scraper & AI Enrichment\n**Email-only.** Dashboard chooses AI Ark or Apify. Same ICP filter, dedupe, site/PageSpeed audit, LLM qualification ($1,000+ gate) and Smartlead push either way.\n\nAI Ark: people search → BounceBan verified email (export/single). Apify: actor b2bsearch/b2b-leads-finder (live email at the current company; phones off). Abstract runs only if a lead is not pre-verified.\n\nTrigger: dashboard **Launch campaign** only. No daily auto-launch.\n\nEnv: AI_ARK_API_KEY, APIFY_TOKEN, EMAIL_VALIDATION_API_KEY, PAGESPEED_API_KEY, OPENAI_API_KEY, OPENAI_MODEL, SMARTLEAD_API_KEY, SMARTLEAD_CAMPAIGN_ID, BOOKING_LINK, SENDER_NAME, CASE_STUDIES, DASHBOARD_URL, DASHBOARD_WEBHOOK_SECRET.",
    [0, -2],
    [760, 190],
  );

  /* ── triggers ── */
  webhook(w, "Webhook: Scraper Batch (Dashboard)", [0, 0], "fenebris-scraper-batch");
  ifNode(w, "Authorized?", [1, 0], "={{ $json.headers['x-fenebris-secret'] === $env.DASHBOARD_WEBHOOK_SECRET && !!$env.DASHBOARD_WEBHOOK_SECRET }}");
  respond(w, "Respond 202 Accepted", [2, -0.5], 202, '{"accepted": true, "workflow": "Fenebris_01_Lead_Scraper_And_AI_Enrichment"}');
  respond(w, "Respond 401 Unauthorized", [2, 0.6], 401, '{"error": "unauthorized"}');
  w.connect("Webhook: Scraper Batch (Dashboard)", "Authorized?");
  w.connect("Authorized?", "Respond 202 Accepted", 0);
  w.connect("Authorized?", "Respond 401 Unauthorized", 1);

  /* ── 1. ICP query ── */
  code(
    w,
    "Build ICP Query",
    [3, 0],
    String.raw`
// Strict ICP: US / UK / Europe / UAE · Founder, Co-Founder, CEO, CTO, Operations Director · $100k–$10M revenue.
const input = $input.first().json;
const body = input.body || {};
const REGION_COUNTRIES = {
  US: ['United States'],
  UK: ['United Kingdom'],
  EUROPE: ['Germany','France','Netherlands','Spain','Italy','Sweden','Ireland','Denmark','Belgium','Switzerland','Austria','Poland','Portugal','Finland','Norway'],
  UAE: ['United Arab Emirates'],
};
const INDUSTRY_KEYWORDS = {
  ECOMMERCE_RETAIL: ['e-commerce','ecommerce','online retail','retail','shopify','direct to consumer'],
  FINTECH: ['fintech','payments','financial technology','digital lending','neobank'],
  REAL_ESTATE_LOGISTICS: ['real estate','proptech','logistics','freight','supply chain','warehousing'],
  EDTECH: ['edtech','online education','e-learning','online courses'],
  HOSPITALITY: ['restaurants','cafe','coffee shop','hospitality','fitness center','gym'],
};
const REGIONS = Object.keys(REGION_COUNTRIES);
const INDUSTRIES = Object.keys(INDUSTRY_KEYWORDS);
const ROLE_TITLES = {
  Founder: ['Founder'], 'Co-Founder': ['Co-Founder'], CEO: ['CEO', 'Chief Executive Officer'],
  CTO: ['CTO', 'Chief Technology Officer'], 'Operations Director': ['Operations Director', 'Director of Operations'],
};
const ALL_ROLES = Object.keys(ROLE_TITLES);
const ALL_EMP = ['1,10', '11,20', '21,50', '51,100', '101,200'];
const pick = (list, allowed, allToken) => {
  if (Array.isArray(list) && list.length) {
    const hit = list.filter(x => allowed.includes(x));
    if (!hit.length) throw new Error('Selection outside ICP');
    return hit;
  }
  if (!list || list === 'ALL' || list === allToken) return allowed.slice();
  if (!allowed.includes(list)) throw new Error('Selection outside ICP: ' + list);
  return [list];
};
const regionsSel = pick(body.regions || body.region, REGIONS);
const industriesSel = pick(body.industries || body.industry, INDUSTRIES);
const roles = pick(body.roles, ALL_ROLES);
const employees = pick(body.employees, ALL_EMP);
const limit = Math.min(200, Math.max(5, parseInt(body.limit || $env.DAILY_LEAD_LIMIT || 40, 10)));
const keyword = String(body.keyword || '').replace(/[^\w\s&+-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
const tags = industriesSel.flatMap(i => INDUSTRY_KEYWORDS[i]);
if (keyword) tags.push(keyword);

const bounds = employees.map(e => e.split(',').map(n => parseInt(n, 10)));
const sizeMin = Math.min(...bounds.map(b => b[0]));
const sizeMax = Math.max(...bounds.map(b => b[1]));
const EUROPE_NAME = {
  de: 'Germany', fr: 'France', nl: 'Netherlands', es: 'Spain', it: 'Italy', se: 'Sweden', ie: 'Ireland',
  dk: 'Denmark', be: 'Belgium', ch: 'Switzerland', at: 'Austria', pl: 'Poland', pt: 'Portugal', fi: 'Finland', no: 'Norway',
};
const EUROPE = Object.keys(EUROPE_NAME);
const europePick = Array.isArray(body.europeCountries) && body.europeCountries.length
  ? body.europeCountries.map(c => String(c).toLowerCase()).filter(c => EUROPE.includes(c))
  : EUROPE;
const locations = [];
const placeList = Array.isArray(body.places) ? body.places.map(p => String(p).trim()).filter(Boolean) : [];
if (placeList.length) locations.push(...placeList);
else {
  if (regionsSel.includes('US')) locations.push('United States');
  if (regionsSel.includes('UK')) locations.push('United Kingdom');
  if (regionsSel.includes('UAE')) locations.push('United Arab Emirates');
  if (regionsSel.includes('EUROPE')) europePick.forEach(c => locations.push(EUROPE_NAME[c]));
}
const industryNames = {
  ECOMMERCE_RETAIL: 'retail', FINTECH: 'financial services', REAL_ESTATE_LOGISTICS: 'logistics and supply chain',
  EDTECH: 'e-learning', HOSPITALITY: 'hospitality',
};
const industryTerms = industriesSel.map(i => industryNames[i]);
if (body.industryQuery) industryTerms.push(String(body.industryQuery).trim());
const titles = [...new Set(roles.flatMap(r => ROLE_TITLES[r]).concat(String(body.extraTitles || '').split(/[,;\n]/).map(s => s.trim()).filter(Boolean)))].slice(0, 40);
const excludeTitles = String(body.excludeNote || '').split(/[,;\n]/).map(s => s.trim()).filter(Boolean).slice(0, 20);
const titleInclude = { mode: 'WORD', content: titles };
const titleFilter = { any: { include: titleInclude } };
if (excludeTitles.length) titleFilter.any.exclude = { mode: 'WORD', content: excludeTitles };
const provider = body.provider === 'apify' ? 'apify' : 'ai-ark';
const COUNTRY_CODE = {
  'united states': 'us', usa: 'us', us: 'us', america: 'us',
  'united kingdom': 'gb', uk: 'gb', britain: 'gb', england: 'gb', scotland: 'gb',
  'united arab emirates': 'ae', uae: 'ae', emirates: 'ae',
  germany: 'de', france: 'fr', netherlands: 'nl', holland: 'nl', spain: 'es', italy: 'it',
  sweden: 'se', ireland: 'ie', denmark: 'dk', belgium: 'be', switzerland: 'ch', austria: 'at',
  poland: 'pl', portugal: 'pt', finland: 'fi', norway: 'no',
};
const countries = [];
const cities = [];
if (placeList.length) {
  placeList.forEach(p => {
    const code = COUNTRY_CODE[String(p).toLowerCase()];
    if (code) countries.push(code);
    else if (p.length >= 3 && p.length <= 64) cities.push(p);
  });
} else {
  if (regionsSel.includes('US')) countries.push('us');
  if (regionsSel.includes('UK')) countries.push('gb');
  if (regionsSel.includes('UAE')) countries.push('ae');
  if (regionsSel.includes('EUROPE')) europePick.forEach(c => countries.push(c));
}
const APIFY_INDUSTRY = {
  ECOMMERCE_RETAIL: ['Retail', 'Consumer Goods'],
  FINTECH: ['Financial Services'],
  REAL_ESTATE_LOGISTICS: ['Logistics and Supply Chain', 'Real Estate'],
  EDTECH: ['E-Learning'],
  HOSPITALITY: ['Hospitality', 'Restaurants'],
};
const apifyIndustries = [...new Set(industriesSel.flatMap(i => APIFY_INDUSTRY[i] || []))];
if (body.industryQuery && String(body.industryQuery).trim().length >= 3) apifyIndustries.push(String(body.industryQuery).trim().slice(0, 64));
const apifyKeywords = [];
if (keyword && keyword.length >= 3) apifyKeywords.push(keyword.slice(0, 64));
const maxPerCompany = Math.min(5, Math.max(1, parseInt(body.maxPerCompany || 2, 10)));
const apifyInput = {
  jobTitles: titles.filter(t => t.length >= 3 && t.length <= 64).slice(0, 10),
  titleMatch: 'word',
  emailType: body.emailType === 'any' ? 'any' : 'work',
  includePhones: false,
  companySizeMin: sizeMin,
  companySizeMax: sizeMax,
  maxResults: limit,
  maxPerCompany,
};
if (countries.length) apifyInput.countries = [...new Set(countries)].slice(0, 60);
if (cities.length) apifyInput.cities = cities.slice(0, 10);
if (apifyIndustries.length) apifyInput.industries = apifyIndustries.slice(0, 20);
if (apifyKeywords.length) apifyInput.keywords = apifyKeywords.slice(0, 10);
const apifyExclude = excludeTitles.filter(t => t.length >= 3 && t.length <= 64).slice(0, 10);
if (apifyExclude.length) apifyInput.excludeJobTitles = apifyExclude;
const aiArkSearch = {
  contact: {
    experience: { latest: { title: titleFilter } },
    seniority: { any: { include: ['founder', 'owner', 'c_suite', 'vp', 'director', 'head'] } },
    location: { any: { include: locations } },
  },
  account: {
    industries: { any: { include: { mode: 'SMART', content: industryTerms.concat(keyword ? [keyword] : []).slice(0, 12) } } },
    employeeSize: { type: 'RANGE', range: employees.map(e => { const [start, end] = e.split(',').map(n => parseInt(n, 10)); return { start, end }; }) },
  },
  page: 0,
  size: Math.min(limit, 100),
};
return [{ json: { aiArkSearch, apifyInput, ctx: {
  region: regionsSel.join(','), industry: industriesSel.join(','), service: body.service || null, keyword, limit,
  source: 'dashboard', provider, regionsSel, industriesSel, roles, sizeMin, sizeMax, maxPerCompany,
  emailType: body.emailType === 'any' ? 'any' : 'work',
  extraTitles: String(body.extraTitles || '').split(/[,;\n]/).map(s => s.trim()).filter(Boolean).slice(0, 8),
  name: String(body.name || '').slice(0, 80),
  offering: String(body.offering || '').slice(0, 80),
  places: placeList,
  campaignId: ['4238486','4238487','4238488','4238489','4238491'].includes(String(body.campaignId || '')) ? String(body.campaignId) : '4238486',
} } }];
`,
  );
  w.connect("Respond 202 Accepted", "Build ICP Query");

  http(w, "AI Ark: People Search", [4, 0], {
    url: "https://api.ai-ark.com/api/developer-portal/v1/people",
    headers: { "X-TOKEN": "={{ $env.AI_ARK_API_KEY }}", "content-type": "application/json" },
    json: "={{ JSON.stringify($json.aiArkSearch) }}",
    timeout: 60000,
    onError: "stopWorkflow",
  });
  code(
    w,
    "Split AI Ark People",
    [5, 0],
    String.raw`
const ctx = $('Build ICP Query').first().json.ctx;
const people = ($input.first().json.content || []).filter(p => p && p.id).slice(0, ctx.limit);
return people.map(p => ({ json: { personId: p.id } }));
`,
  );
  http(w, "AI Ark: Export Verified Email", [6, 0], {
    url: "https://api.ai-ark.com/api/developer-portal/v1/people/export/single",
    headers: { "X-TOKEN": "={{ $env.AI_ARK_API_KEY }}", "content-type": "application/json" },
    json: "={{ JSON.stringify({ id: $json.personId }) }}",
    timeout: 60000,
    batching: [2, 400],
  });

  ifNode(w, "Use Apify?", [3.5, 1.2], "={{ $json.ctx.provider === 'apify' }}");
  http(w, "Apify: Run Leads Finder", [4.5, 2.2], {
    url: "=https://api.apify.com/v2/acts/{{ $env.APIFY_ACTOR_ID }}/run-sync-get-dataset-items?token={{ $env.APIFY_TOKEN }}&timeout=300",
    json: "={{ JSON.stringify($json.apifyInput) }}",
    timeout: 300000,
    onError: "stopWorkflow",
  });
  code(
    w,
    "Split Apify Leads",
    [5.5, 2.2],
    String.raw`
const ctx = $('Build ICP Query').first().json.ctx;
const rows = [];
for (const it of $input.all()) {
  const j = it.json;
  if (Array.isArray(j)) rows.push(...j);
  else if (j && Array.isArray(j.data)) rows.push(...j.data);
  else if (j) rows.push(j);
}
const leads = rows.filter(r => r && r.email && (!r._status || r._status === 'found') && !r.error); // actor marks good rows _status "found", bad ones "skipped_*"
return leads.slice(0, ctx.limit).map(r => ({ json: { apify: r } }));
`,
  );

  code(
    w,
    "Normalize + ICP Hard Filter",
    [7, 0],
    String.raw`
const ctx = $('Build ICP Query').first().json.ctx;
const NAME_TO_REGION = {
  'united states': 'US', 'united kingdom': 'UK', 'united arab emirates': 'UAE',
  germany: 'EUROPE', france: 'EUROPE', netherlands: 'EUROPE', spain: 'EUROPE', italy: 'EUROPE', sweden: 'EUROPE',
  ireland: 'EUROPE', denmark: 'EUROPE', belgium: 'EUROPE', switzerland: 'EUROPE', austria: 'EUROPE', poland: 'EUROPE',
  portugal: 'EUROPE', finland: 'EUROPE', norway: 'EUROPE',
};
const INDUSTRY_RX = {
  ECOMMERCE_RETAIL: /e-?commerce|retail|consumer goods|apparel|shopify|marketplace|direct to consumer|software/i,
  FINTECH: /fintech|financial|payment|banking|lending|insurtech/i,
  REAL_ESTATE_LOGISTICS: /real estate|proptech|logistics|freight|supply chain|warehous|transport/i,
  EDTECH: /edtech|education|e-?learning|online course|training/i,
  HOSPITALITY: /restaurant|cafe|coffee|hospitality|food|fitness|gym|wellness|hotel/i,
};
const out = [], seen = new Set();
const roleOk = (title) => {
  const roleHit = (ctx.roles || []).some(r => {
    if (r === 'Co-Founder') return /co-?founder/i.test(title);
    if (r === 'Founder') return /\bfounder\b/i.test(title) && !/co-?founder/i.test(title);
    if (r === 'CEO') return /chief executive|\bceo\b/i.test(title);
    if (r === 'CTO') return /chief technology|\bcto\b/i.test(title);
    return /operations director|director of operations|head of operations/i.test(title);
  });
  const extraHit = (ctx.extraTitles || []).some(t => String(title).toLowerCase().includes(String(t).toLowerCase()));
  return roleHit || extraHit;
};
const pushLead = (lead) => {
  const email = String(lead.email || '').toLowerCase().trim();
  if (!email || seen.has(email)) return;
  const region = NAME_TO_REGION[String(lead.country || '').toLowerCase()] || null;
  const namedPlace = Array.isArray(ctx.places) && ctx.places.length > 0;
  if (!namedPlace && (!region || !ctx.regionsSel.includes(region))) return;
  if (!roleOk(lead.role || '')) return;
  const employees = Number(lead.employeeCount || 0);
  if (employees && (employees < ctx.sizeMin || employees > ctx.sizeMax)) return;
  const annual = Number(lead.annualRevenue || 0);
  if (annual && (annual < 100000 || annual > 10000000)) return;
  const industry = ctx.industriesSel.find(k => INDUSTRY_RX[k].test(lead.hay || '')) || (ctx.industriesSel.length === 1 ? ctx.industriesSel[0] : null);
  if (!industry) return;
  const domain = String(lead.domain || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  if (!domain) return;
  seen.add(email);
  out.push({ json: {
    email, firstName: lead.firstName || '', lastName: lead.lastName || '', role: lead.role || '',
    linkedinUrl: lead.linkedinUrl || null,
    companyName: lead.companyName || domain, companyDomain: domain, companyWebsite: 'https://' + domain,
    country: lead.country, region, industry,
    employeeCount: employees || null, annualRevenue: annual || null, sourceId: lead.sourceId || null,
    leadSource: ctx.provider || 'ai-ark',
    preverified: true, emailStatus: 'VALID',
  } });
};
const CODE_TO_COUNTRY = {
  us: 'United States', gb: 'United Kingdom', ae: 'United Arab Emirates',
  de: 'Germany', fr: 'France', nl: 'Netherlands', es: 'Spain', it: 'Italy', se: 'Sweden',
  ie: 'Ireland', dk: 'Denmark', be: 'Belgium', ch: 'Switzerland', at: 'Austria', pl: 'Poland',
  pt: 'Portugal', fi: 'Finland', no: 'Norway',
};
const staffCount = (v) => {
  if (typeof v === 'number') return v;
  const nums = String(v || '').match(/\d+/g);
  return nums ? parseInt(nums[0], 10) : 0;
};
for (const it of $input.all()) {
  const m = it.json || {};
  if (m.error) continue;
  if (m.apify) {
    const a = m.apify;
    const email = String(a.email || a.workEmail || '').toLowerCase().trim();
    const personal = a.emailType === 'personal' || /@(gmail|googlemail|yahoo|hotmail|outlook|live|icloud|aol)\./i.test(email);
    if (ctx.emailType !== 'any' && personal) continue;
    const country = CODE_TO_COUNTRY[String(a.countryCode || '').toLowerCase()] || '';
    pushLead({
      email, firstName: a.firstName || '', lastName: a.lastName || '', role: a.jobTitle || a.primaryTitle || '',
      linkedinUrl: a.linkedinUrl || null, companyName: a.companyName || '', domain: a.companyDomain || '',
      country, employeeCount: staffCount(a.companySize), annualRevenue: 0, sourceId: a.personId || null,
      hay: [a.companyIndustry, a.headline, a.companyName, a.jobTitle].join(' '),
    });
    continue;
  }
  const emails = (m.email && m.email.output) || [];
  const hit = emails.find(e => e && e.found && e.status === 'VALID' && e.address && !e.generic && (ctx.emailType === 'any' || !e.free));
  if (!hit) continue;
  const profile = m.profile || {};
  const company = m.company || {};
  const summary = company.summary || {};
  const loc = m.location || {};
  const hq = (company.location && company.location.headquarter) || {};
  const staff = summary.staff || {};
  const revObj = company.financial && company.financial.revenue && company.financial.revenue.annual;
  pushLead({
    email: hit.address, firstName: profile.first_name || '', lastName: profile.last_name || '', role: profile.title || '',
    linkedinUrl: (m.link && m.link.linkedin) || null, companyName: summary.name || '',
    domain: (company.link && (company.link.domain || company.link.website)) || '',
    country: loc.country || hq.country || '',
    employeeCount: Number(staff.total || (staff.range && staff.range.start) || 0),
    annualRevenue: revObj ? Number(revObj.amount || revObj.start || 0) : 0,
    sourceId: m.id || null,
    hay: [summary.industry, (company.industries || []).join(' '), (company.keywords || []).join(' '), summary.name, profile.headline].join(' '),
  });
}
const cap = ctx.maxPerCompany || 2;
const perCo = new Map();
return out.filter(row => {
  const key = String(row.json.companyDomain || '').toLowerCase();
  const n = perCo.get(key) || 0;
  if (n >= cap) return false;
  perCo.set(key, n + 1);
  return true;
});
`,
  );

  /* ── dedupe vs DB ── */
  postgres(
    w,
    "DB: Existing Leads Check",
    [8, 0],
    "SELECT email FROM leads WHERE email IN (SELECT jsonb_array_elements_text($1::jsonb));",
    "={{ [JSON.stringify($input.all().map(i => i.json.email))] }}",
    { alwaysOutput: true, once: true },
  );
  code(
    w,
    "Drop Existing Leads",
    [9, 0],
    String.raw`
const existing = new Set($input.all().map(i => i.json.email).filter(Boolean));
const ctx = $('Build ICP Query').first().json.ctx;
return $('Normalize + ICP Hard Filter').all().filter(i => !existing.has(i.json.email)).slice(0, ctx.limit);
`,
  );

  /* ── 2. email verification ── */
  http(w, "Abstract: Validate Email", [10, 0], {
    method: "GET",
    url: "https://emailvalidation.abstractapi.com/v1/",
    query: { api_key: "={{ $env.EMAIL_VALIDATION_API_KEY }}", email: "={{ $json.email }}" },
    timeout: 30000,
    batching: [3, 1100],
  });
  code(
    w,
    "Pass Only Valid Emails",
    [11, 0],
    String.raw`
const src = $('Drop Existing Leads').all();
const out = [];
$input.all().forEach((it, i) => {
  const deliverable = String(it.json.deliverability || '').toUpperCase() === 'DELIVERABLE';
  const disposable = !!(it.json.is_disposable_email && it.json.is_disposable_email.value);
  if (deliverable && !disposable) {
    out.push({ json: { ...src[i].json, emailStatus: 'VALID', validationScore: it.json.quality_score || null } });
  }
});
return out;
`,
  );

  /* ── 3. live website + pain-point audit ── */
  http(w, "Fetch Website Home Page", [12, 0], {
    method: "GET",
    url: "={{ $json.companyWebsite }}",
    headers: { "User-Agent": "Mozilla/5.0 (compatible; FenebrisAuditBot/1.0; +https://fenebris.com)", Accept: "text/html" },
    timeout: 20000,
    text: true,
    batching: [5, 500],
  });
  http(w, "PageSpeed: Mobile Performance", [13, 0], {
    method: "GET",
    url: "https://www.googleapis.com/pagespeedonline/v5/runPagespeed",
    query: {
      url: "={{ $('Verified Emails').all()[$itemIndex].json.companyWebsite }}",
      strategy: "mobile",
      category: "performance",
      key: "={{ $env.PAGESPEED_API_KEY }}",
    },
    timeout: 90000,
    batching: [3, 1500],
  });
  code(
    w,
    "Site Audit Extract",
    [14, 0],
    String.raw`
// Builds ONLY verifiable facts. The LLM is forbidden from claiming anything not listed in verifiedHooks.
const leads = $('Verified Emails').all();
const sites = $('Fetch Website Home Page').all();
const out = [];
$input.all().forEach((it, i) => {
  const lead = leads[i].json;
  const site = sites[i] ? sites[i].json : {};
  const html = typeof site.data === 'string' ? site.data : '';
  const hdr = {};
  Object.entries(site.headers || {}).forEach(([k, v]) => { hdr[k.toLowerCase()] = v; });
  const reachable = !!html && (site.statusCode || 200) < 400;

  // PageSpeed
  const lh = (it.json && it.json.lighthouseResult) || null;
  const perf = lh && lh.categories && lh.categories.performance ? Math.round(lh.categories.performance.score * 100) : null;
  const lcp = lh && lh.audits && lh.audits['largest-contentful-paint'] ? +(lh.audits['largest-contentful-paint'].numericValue / 1000).toFixed(1) : null;
  const tbt = lh && lh.audits && lh.audits['total-blocking-time'] ? Math.round(lh.audits['total-blocking-time'].numericValue) : null;

  // Tech stack + tracking
  const stack = [];
  if (/cdn\.shopify\.com|Shopify\.theme/i.test(html)) stack.push('Shopify');
  if (/woocommerce/i.test(html)) stack.push('WooCommerce');
  if (/Magento_|mage\/|\/static\/version/i.test(html)) stack.push('Magento');
  if (/wp-content|wp-includes/i.test(html)) stack.push('WordPress');
  if (/wixstatic\.com/i.test(html)) stack.push('Wix');
  if (/squarespace/i.test(html)) stack.push('Squarespace');
  if (/__NEXT_DATA__|\/_next\//i.test(html)) stack.push('Next.js');
  else if (/data-reactroot|react(\.production)?\.min\.js/i.test(html)) stack.push('React');
  const jq = html.match(/jquery[-.\/]?v?(\d+)\.(\d+)(?:\.(\d+))?/i);
  const jqVersion = jq ? jq[1] + '.' + jq[2] + (jq[3] ? '.' + jq[3] : '') : null;
  if (jqVersion) stack.push('jQuery ' + jqVersion);
  const poweredBy = hdr['x-powered-by'] || null;
  if (poweredBy) stack.push(String(poweredBy));

  const hasMetaPixel = /fbq\(|connect\.facebook\.net\/[a-z_A-Z]+\/fbevents\.js/i.test(html);
  const hasGa4 = /gtag\(|googletagmanager\.com\/gtag\/js\?id=G-/i.test(html);
  const hasGtm = /googletagmanager\.com\/gtm\.js/i.test(html);
  const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || '';
  const metaDesc = /<meta[^>]+name=["']description["'][^>]+content=["'][^"']{20,}/i.test(html);
  const viewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  const security = {
    hsts: !!hdr['strict-transport-security'],
    csp: !!hdr['content-security-policy'],
    xFrameOptions: !!hdr['x-frame-options'] || /frame-ancestors/i.test(String(hdr['content-security-policy'] || '')),
  };

  // Verified hooks in priority order
  const hooks = [];
  if ((lcp !== null && lcp > 4) || (perf !== null && perf < 50)) {
    hooks.push({ type: 'SLOW', service: 'WEB_ECOM', evidence: 'Mobile PageSpeed performance score ' + perf + '/100 with Largest Contentful Paint of ' + lcp + 's on the home page (good is <= 2.5s).' });
  }
  if (reachable && !hasMetaPixel && !hasGtm) {
    hooks.push({ type: 'ADS', service: 'DIGITAL_MARKETING', evidence: 'No Meta Pixel' + (hasGa4 ? '' : ' and no GA4/Google Tag Manager') + ' detected on the home page, so paid campaigns cannot be tracked or optimised.' });
  } else if (reachable && !hasGa4 && !hasGtm) {
    hooks.push({ type: 'ADS', service: 'DIGITAL_MARKETING', evidence: 'No GA4 / Google Tag Manager detected on the home page; conversions cannot be attributed.' });
  }
  if (reachable && !security.hsts && !security.csp) {
    hooks.push({ type: 'SEC', service: 'MANAGED_IT', evidence: 'The site is served without HSTS and without a Content-Security-Policy header.' });
  }
  if (jq && Number(jq[1]) < 3) {
    hooks.push({ type: 'DEV', service: 'STAFF_AUG', evidence: 'The home page still loads jQuery ' + jqVersion + ', an end-of-life major version, which points to a stale front-end stack.' });
  }

  out.push({ json: { ...lead, auditFindings: {
    domain: lead.companyDomain, reachable, pageSpeedMobile: perf, lcpSeconds: lcp, totalBlockingTimeMs: tbt,
    hasMetaPixel, hasGa4, hasGtm, https: /^https:/i.test(lead.companyWebsite), securityHeaders: security,
    techStack: stack, metaDescriptionPresent: metaDesc, mobileViewport: viewport, title: title.trim().slice(0, 120),
    verifiedHooks: hooks, auditedAt: new Date().toISOString(),
  } } });
});
return out;
`,
  );

  /* ── 4. AI qualification + sequence ── */
  code(
    w,
    "Build LLM Request",
    [15, 0],
    "const SYSTEM = " + JSON.stringify(QUALIFY_AND_SEQUENCE_SYSTEM) + ";\n" + String.raw`
const ctx = $('Build ICP Query').first().json.ctx;
const booking = $env.BOOKING_LINK;
const sender = $env.SENDER_NAME || 'Aarav Mehta';
if (!booking) throw new Error('BOOKING_LINK env var is required');
return $input.all().map(it => {
  const l = it.json;
  const user =
    '<prospect>' + JSON.stringify({ first_name: l.firstName, role: l.role, company: l.companyName, website: l.companyWebsite, country: l.country, region: l.region,
      industry: l.industry, employees: l.employeeCount, annual_revenue_usd: l.annualRevenue }) + '</prospect>\n' +
    '<audit>' + JSON.stringify({ verified_hooks: l.auditFindings.verifiedHooks, site_reachable: l.auditFindings.reachable,
      mobile_pagespeed: l.auditFindings.pageSpeedMobile, lcp_seconds: l.auditFindings.lcpSeconds, tech_stack: l.auditFindings.techStack }) + '</audit>\n' +
    '<case_studies>' + (($env.CASE_STUDIES) || '') + '</case_studies>\n' +
    '<booking_link>' + booking + '</booking_link>\n<sender_name>' + sender + ', BrandFly</sender_name>\n' +
    '<offering>' + (ctx.offering || ctx.service || 'none') + '</offering>\n' +
    '<preferred_service_tiebreaker>' + (ctx.service || 'none') + '</preferred_service_tiebreaker>\n' +
    '<ticket_gate>' + ($env.TICKET_GATE === 'off' ? 'off' : 'on') + '</ticket_gate>';
  return { json: { ...l, llmRequest: { model: $env.OPENAI_MODEL || 'gpt-4o', temperature: 0.4, response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }] } } };
});
`,
  );
  http(w, "AI: Qualify + Generate 4-Step Sequence", [16, 0], {
    url: "https://api.openai.com/v1/chat/completions",
    headers: { Authorization: "=Bearer {{ $env.OPENAI_API_KEY }}", "content-type": "application/json" },
    json: "={{ JSON.stringify($json.llmRequest) }}",
    timeout: 120000,
    batching: [3, 1500],
  });
  code(
    w,
    "Parse AI + Qualification Gate",
    [17, 0],
    String.raw`
const src = $('Build LLM Request').all();
const ctx = $('Build ICP Query').first().json.ctx;
const booking = $env.BOOKING_LINK;
const SERVICES = ['WEB_ECOM', 'DIGITAL_MARKETING', 'STAFF_AUG', 'MANAGED_IT'];
const DAYS = [0, 3, 7, 11];
const toHtml = s => String(s).replace(/\r?\n/g, '<br>');
const out = [];
$input.all().forEach((it, i) => {
  const lead = src[i].json;
  let ai;
  try { ai = JSON.parse(it.json.choices[0].message.content); } catch (e) { return; } // unparsable => skipped, never half-synced
  const emails = Array.isArray(ai.emails) ? ai.emails : [];
  const emailsOk = emails.length === 4 && emails.every((e, k) => e && e.step === k + 1 && e.subject && e.body && !/\{\{|\}\}|\[(name|company|first)/i.test(e.subject + e.body));
  const ticket = Number.isInteger(ai.estimated_ticket_usd) ? ai.estimated_ticket_usd : 0;
  // HARD GATE: ICP + $1,000+ ticket + valid service + valid sequence. TICKET_GATE=off (config) drops the ticket test only.
  const gateOn = $env.TICKET_GATE !== 'off';
  const serviceName = String(ai.recommended_service || ctx.offering || '').trim();
  const qualified = ai.fits_ticket_threshold === true && (!gateOn || ticket >= 1000) && serviceName.length > 1 && emailsOk;
  let reason = qualified ? null : (ai.disqualify_reason || (gateOn && ticket < 1000 ? 'Estimated ticket below $1,000' : !emailsOk ? 'Invalid email sequence from LLM' : 'Did not fit ICP'));
  if (!qualified) { out.push({ json: { qualified: false, email: lead.email, company: lead.companyName, reason } }); return; }

  const bodies = emails.map(e => e.body.includes(booking) ? e.body : e.body + '\n\nBook a time here: ' + booking); // guarantee CTA
  const now = Date.now();
  const sequences = emails.map((e, k) => ({ step: k + 1, subject: e.subject, body: bodies[k], scheduled_at: new Date(now + DAYS[k] * 86400000).toISOString() }));
  const cv = { pain_point: ai.pain_point_tag, pain_point_detail: ai.pain_point_detail, recommended_service: serviceName,
    ticket_size: String(ticket), booking_link: booking };
  emails.forEach((e, k) => { cv['subject_' + (k + 1)] = e.subject; cv['email_' + (k + 1)] = toHtml(bodies[k]); });

  out.push({ json: {
    qualified: true, email: lead.email, company: lead.companyName,
    smartleadPayload: { lead_list: [{ email: lead.email, first_name: lead.firstName, last_name: lead.lastName,
      company_name: lead.companyName, website: lead.companyWebsite, linkedin_profile: lead.linkedinUrl, location: lead.country,
      custom_fields: { ...cv, job_title: lead.role } }],
      settings: { ignore_global_block_list: false, ignore_unsubscribe_list: false, ignore_duplicate_leads_in_other_campaign: true } },
    record: {
      email: lead.email, emailStatus: 'VALID', firstName: lead.firstName, lastName: lead.lastName, role: lead.role, linkedinUrl: lead.linkedinUrl,
      companyName: lead.companyName, companyDomain: lead.companyDomain, companyWebsite: lead.companyWebsite, country: lead.country, region: lead.region,
      industry: lead.industry, employeeCount: lead.employeeCount, annualRevenue: lead.annualRevenue, painPoint: ai.pain_point_tag, painPointDetail: ai.pain_point_detail,
      auditFindings: lead.auditFindings, recommendedService: serviceName, qualificationScore: Math.max(0, Math.min(100, Math.round(ai.qualification_score || 0))),
      estimatedTicket: ticket, dossier: { summary: ai.dossier_summary, opportunity: ai.opportunity_reason || ai.pain_point_detail, discoveryQuestions: ai.discovery_questions, talkingPoints: ai.talking_points },
      campaignId: ctx.campaignId, leadSource: lead.leadSource || ctx.provider || 'ai-ark', sequences,
    },
  } });
});
return out;
`,
  );
  ifNode(w, "Qualified? (Ticket >= $1,000)", [18, 0], "={{ $json.qualified === true }}");
  noop(w, "Disqualified (not synced)", [19, 1.4]);

  /* ── 5. outreach push + DB sync ── */
  http(w, "Smartlead: Add Lead", [19, 0], {
    url: smartleadUrl("/campaigns/{{ $('Build ICP Query').first().json.ctx.campaignId }}/leads"),
    json: "={{ JSON.stringify($json.smartleadPayload) }}",
    timeout: 30000,
    batching: [2, 800],
  });
  code(
    w,
    "Prepare DB Record",
    [20, 0],
    String.raw`
const src = $('Qualified? (Ticket >= $1,000)').all();
return $input.all().map((it, i) => ({ json: { record: { ...src[i].json.record, outreachLeadId: it.json.id || null } } }));
`,
  );
  postgres(
    w,
    "DB: Upsert Lead + 4 Sequence Emails",
    [21, 0],
    `WITH r AS (SELECT $1::jsonb AS d),
l AS (
  INSERT INTO leads (email, email_status, first_name, last_name, role, linkedin_url, company_name, company_domain, company_website,
    country, region, industry, employee_count, annual_revenue, pain_point, pain_point_detail, audit_findings, recommended_service,
    qualification_score, estimated_ticket, dossier, stage, current_step, outreach_lead_id, campaign_id, source, updated_at)
  SELECT lower(d->>'email'), d->>'emailStatus', d->>'firstName', coalesce(d->>'lastName',''), d->>'role', d->>'linkedinUrl',
    d->>'companyName', d->>'companyDomain', d->>'companyWebsite', d->>'country', d->>'region', d->>'industry',
    nullif(d->>'employeeCount','')::int, COALESCE(NULLIF(d->>'annualRevenue','')::int, 0), d->>'painPoint', d->>'painPointDetail', d->'auditFindings',
    d->>'recommendedService', (d->>'qualificationScore')::int, (d->>'estimatedTicket')::int, d->'dossier', 'VERIFIED', 0,
    d->>'outreachLeadId', d->>'campaignId', coalesce(d->>'leadSource','ai-ark'), now()
  FROM r
  ON CONFLICT (email) DO UPDATE SET
    pain_point = EXCLUDED.pain_point, pain_point_detail = EXCLUDED.pain_point_detail, audit_findings = EXCLUDED.audit_findings,
    recommended_service = EXCLUDED.recommended_service, qualification_score = EXCLUDED.qualification_score,
    estimated_ticket = EXCLUDED.estimated_ticket, dossier = EXCLUDED.dossier,
    outreach_lead_id = coalesce(EXCLUDED.outreach_lead_id, leads.outreach_lead_id), updated_at = now()
  RETURNING id
),
seq AS (
  INSERT INTO campaign_sequences (lead_id, step, subject, body, scheduled_at, status, updated_at)
  SELECT l.id, s.step, s.subject, s.body, s.scheduled_at, 'SCHEDULED', now()
  FROM l, r, jsonb_to_recordset(r.d->'sequences') AS s(step int, subject text, body text, scheduled_at timestamptz)
  ON CONFLICT (lead_id, step) DO UPDATE SET subject = EXCLUDED.subject, body = EXCLUDED.body,
    scheduled_at = EXCLUDED.scheduled_at, updated_at = now()
    WHERE campaign_sequences.status <> 'SENT'
  RETURNING lead_id
)
SELECT id AS lead_id, (SELECT count(*) FROM seq) AS sequence_rows FROM l;`,
    "={{ [JSON.stringify($json.record)] }}",
  );

  dashboardNotify(
    w,
    "Dashboard: Lead Synced",
    [22, 0],
    "={{ JSON.stringify({ event: 'lead_synced', ingest: false, data: { lead: { companyName: $('Prepare DB Record').all()[$itemIndex].json.record.companyName, email: $('Prepare DB Record').all()[$itemIndex].json.record.email } } }) }}",
  );
  code(
    w,
    "Batch Summary",
    [23, 0],
    String.raw`
const ctx = $('Build ICP Query').first().json.ctx;
const sourced = $('Normalize + ICP Hard Filter').all().length;
const fresh = $('Drop Existing Leads').all().length;
const valid = $('Verified Emails').all().length;
const qualified = $('Prepare DB Record').all().length;
return [{ json: { event: 'batch_finished', ingest: false, data: { source: ctx.source, provider: ctx.provider || 'ai-ark', region: ctx.region, industry: ctx.industry,
  sourced, new_leads: fresh, valid_emails: valid, qualified, rejected: sourced - qualified } } }];
`,
  );
  dashboardNotify(w, "Dashboard: Batch Finished", [24, 0], "={{ JSON.stringify($json) }}");

  ifNode(w, "AI Ark Already Verified?", [10.5, 0], "={{ $json.preverified === true }}");
  code(w, "Keep Preverified Email", [11.5, -1], "return $input.all().map(i => ({ json: i.json }));");
  w.add("Verified Emails", "n8n-nodes-base.merge", 3, [12.5, 0], { mode: "append" });

  /* ── wiring ── */
  w.connect("Build ICP Query", "Use Apify?");
  w.connect("Use Apify?", "Apify: Run Leads Finder", 0);
  w.connect("Use Apify?", "AI Ark: People Search", 1);
  w.connect("Apify: Run Leads Finder", "Split Apify Leads");
  w.connect("Split Apify Leads", "Normalize + ICP Hard Filter");
  w.chain(
    "AI Ark: People Search",
    "Split AI Ark People",
    "AI Ark: Export Verified Email",
    "Normalize + ICP Hard Filter",
    "DB: Existing Leads Check",
    "Drop Existing Leads",
  );
  w.connect("Drop Existing Leads", "AI Ark Already Verified?");
  w.connect("AI Ark Already Verified?", "Keep Preverified Email", 0);
  w.connect("AI Ark Already Verified?", "Abstract: Validate Email", 1);
  w.connect("Abstract: Validate Email", "Pass Only Valid Emails");
  w.connect("Keep Preverified Email", "Verified Emails", 0, 0);
  w.connect("Pass Only Valid Emails", "Verified Emails", 0, 1);
  w.chain(
    "Verified Emails",
    "Fetch Website Home Page",
    "PageSpeed: Mobile Performance",
    "Site Audit Extract",
    "Build LLM Request",
    "AI: Qualify + Generate 4-Step Sequence",
    "Parse AI + Qualification Gate",
    "Qualified? (Ticket >= $1,000)",
  );
  w.connect("Qualified? (Ticket >= $1,000)", "Smartlead: Add Lead", 0);
  w.connect("Qualified? (Ticket >= $1,000)", "Disqualified (not synced)", 1);
  w.chain(
    "Smartlead: Add Lead",
    "Prepare DB Record",
    "DB: Upsert Lead + 4 Sequence Emails",
    "Dashboard: Lead Synced",
    "Batch Summary",
    "Dashboard: Batch Finished",
  );

  return w;
}
