// Shared lead-targeting lists. Used by the dashboard Launch form (src/lib/constants.ts, src/lib/places.ts)
// and baked into the n8n lead lane (wf1) and reply lane (wf2) so both sides always agree.

/**
 * Decision-maker roles. `titles` go to the people search (Apify uses the first title of each role, it allows 10),
 * `rx` (+ optional `not`) re-checks the title that comes back. `preset: true` = selected by default.
 */
export const ROLE_CATALOG = [
  { id: "Founder", group: "Owners & leadership", titles: ["Founder"], rx: "\\bfounder\\b", not: "co-?founder", preset: true },
  { id: "Co-Founder", group: "Owners & leadership", titles: ["Co-Founder", "Cofounder"], rx: "co-?founder", preset: true },
  { id: "Owner", group: "Owners & leadership", titles: ["Owner", "Business Owner"], rx: "\\bowner\\b", preset: true },
  { id: "CEO", group: "Owners & leadership", titles: ["CEO", "Chief Executive Officer"], rx: "chief executive|\\bceo\\b", preset: true },
  { id: "Managing Director", group: "Owners & leadership", titles: ["Managing Director"], rx: "managing director|\\bmd\\b", preset: true },
  { id: "President", group: "Owners & leadership", titles: ["President"], rx: "\\bpresident\\b", not: "vice", preset: true },
  { id: "Partner", group: "Owners & leadership", titles: ["Managing Partner", "Partner"], rx: "\\bpartner\\b", not: "partnership", preset: false },
  { id: "CTO", group: "Technology", titles: ["CTO", "Chief Technology Officer"], rx: "chief technology|\\bcto\\b", preset: true },
  { id: "CIO", group: "Technology", titles: ["CIO", "Chief Information Officer"], rx: "chief information|\\bcio\\b", preset: false },
  { id: "VP Engineering", group: "Technology", titles: ["VP Engineering", "VP of Engineering", "VP Technology"], rx: "(\\bvp\\b|vice president).{0,12}(engineering|technology)", preset: false },
  { id: "Head of Technology", group: "Technology", titles: ["Head of Technology", "Head of Engineering", "IT Director", "Head of IT", "Director of Technology"], rx: "head of (technology|engineering|it\\b)|(it|technology|engineering) director|director of (technology|engineering|it\\b)", preset: false },
  { id: "COO", group: "Operations", titles: ["COO", "Chief Operating Officer"], rx: "chief operating|\\bcoo\\b", preset: true },
  { id: "Operations Director", group: "Operations", titles: ["Operations Director", "Director of Operations", "Head of Operations"], rx: "operations director|director of operations|head of operations", preset: true },
  { id: "General Manager", group: "Operations", titles: ["General Manager"], rx: "general manager", preset: false },
  { id: "CMO", group: "Marketing & growth", titles: ["CMO", "Chief Marketing Officer"], rx: "chief marketing|\\bcmo\\b", preset: false },
  { id: "Marketing Director", group: "Marketing & growth", titles: ["Marketing Director", "Director of Marketing", "Head of Marketing", "VP Marketing"], rx: "marketing director|director of marketing|head of marketing|(\\bvp\\b|vice president).{0,12}marketing", preset: false },
  { id: "Head of E-commerce", group: "Marketing & growth", titles: ["Head of Ecommerce", "Ecommerce Director", "Head of Digital", "Digital Director"], rx: "head of (e-?commerce|digital)|(e-?commerce|digital) director|director of (e-?commerce|digital)", preset: false },
];

/** Company-size buckets (employees). The first five are the default. */
export const EMPLOYEE_BUCKETS = [
  { id: "1,10", label: "1–10", preset: true },
  { id: "11,20", label: "11–20", preset: true },
  { id: "21,50", label: "21–50", preset: true },
  { id: "51,100", label: "51–100", preset: true },
  { id: "101,200", label: "101–200", preset: true },
  { id: "201,500", label: "201–500", preset: false },
  { id: "501,1000", label: "501–1,000", preset: false },
  { id: "1001,5000", label: "1,001–5,000", preset: false },
];

/**
 * Countries the Launch form offers: ISO code, name, main time zone, and dashboard region
 * (US / UK / EUROPE / UAE are the original ICP regions, everything else is OTHER).
 */
export const COUNTRIES = [
  ["us", "United States", "America/New_York", "US"],
  ["gb", "United Kingdom", "Europe/London", "UK"],
  ["ae", "United Arab Emirates", "Asia/Dubai", "UAE"],
  ["de", "Germany", "Europe/Berlin", "EUROPE"],
  ["fr", "France", "Europe/Paris", "EUROPE"],
  ["nl", "Netherlands", "Europe/Amsterdam", "EUROPE"],
  ["es", "Spain", "Europe/Madrid", "EUROPE"],
  ["it", "Italy", "Europe/Rome", "EUROPE"],
  ["se", "Sweden", "Europe/Stockholm", "EUROPE"],
  ["ie", "Ireland", "Europe/Dublin", "EUROPE"],
  ["dk", "Denmark", "Europe/Copenhagen", "EUROPE"],
  ["be", "Belgium", "Europe/Brussels", "EUROPE"],
  ["ch", "Switzerland", "Europe/Zurich", "EUROPE"],
  ["at", "Austria", "Europe/Vienna", "EUROPE"],
  ["pl", "Poland", "Europe/Warsaw", "EUROPE"],
  ["pt", "Portugal", "Europe/Lisbon", "EUROPE"],
  ["fi", "Finland", "Europe/Helsinki", "EUROPE"],
  ["no", "Norway", "Europe/Oslo", "EUROPE"],
  ["lu", "Luxembourg", "Europe/Luxembourg", "EUROPE"],
  ["cz", "Czechia", "Europe/Prague", "EUROPE"],
  ["gr", "Greece", "Europe/Athens", "EUROPE"],
  ["hu", "Hungary", "Europe/Budapest", "EUROPE"],
  ["ro", "Romania", "Europe/Bucharest", "EUROPE"],
  ["ee", "Estonia", "Europe/Tallinn", "EUROPE"],
  ["lv", "Latvia", "Europe/Riga", "EUROPE"],
  ["lt", "Lithuania", "Europe/Vilnius", "EUROPE"],
  ["ca", "Canada", "America/Toronto", "OTHER"],
  ["au", "Australia", "Australia/Sydney", "OTHER"],
  ["nz", "New Zealand", "Pacific/Auckland", "OTHER"],
  ["in", "India", "Asia/Kolkata", "OTHER"],
  ["sg", "Singapore", "Asia/Singapore", "OTHER"],
  ["hk", "Hong Kong", "Asia/Hong_Kong", "OTHER"],
  ["jp", "Japan", "Asia/Tokyo", "OTHER"],
  ["kr", "South Korea", "Asia/Seoul", "OTHER"],
  ["my", "Malaysia", "Asia/Kuala_Lumpur", "OTHER"],
  ["id", "Indonesia", "Asia/Jakarta", "OTHER"],
  ["th", "Thailand", "Asia/Bangkok", "OTHER"],
  ["ph", "Philippines", "Asia/Manila", "OTHER"],
  ["vn", "Vietnam", "Asia/Ho_Chi_Minh", "OTHER"],
  ["pk", "Pakistan", "Asia/Karachi", "OTHER"],
  ["bd", "Bangladesh", "Asia/Dhaka", "OTHER"],
  ["lk", "Sri Lanka", "Asia/Colombo", "OTHER"],
  ["np", "Nepal", "Asia/Kathmandu", "OTHER"],
  ["sa", "Saudi Arabia", "Asia/Riyadh", "OTHER"],
  ["qa", "Qatar", "Asia/Qatar", "OTHER"],
  ["kw", "Kuwait", "Asia/Kuwait", "OTHER"],
  ["om", "Oman", "Asia/Muscat", "OTHER"],
  ["bh", "Bahrain", "Asia/Bahrain", "OTHER"],
  ["il", "Israel", "Asia/Jerusalem", "OTHER"],
  ["tr", "Turkey", "Europe/Istanbul", "OTHER"],
  ["eg", "Egypt", "Africa/Cairo", "OTHER"],
  ["za", "South Africa", "Africa/Johannesburg", "OTHER"],
  ["ng", "Nigeria", "Africa/Lagos", "OTHER"],
  ["ke", "Kenya", "Africa/Nairobi", "OTHER"],
  ["br", "Brazil", "America/Sao_Paulo", "OTHER"],
  ["mx", "Mexico", "America/Mexico_City", "OTHER"],
  ["ar", "Argentina", "America/Argentina/Buenos_Aires", "OTHER"],
  ["co", "Colombia", "America/Bogota", "OTHER"],
  ["cl", "Chile", "America/Santiago", "OTHER"],
].map(([code, name, tz, region]) => ({ code, name, tz, region }));

/** The 15 European countries the "Europe" region chip stands for (unchanged from the original ICP). */
export const EUROPE_CORE = ["de", "fr", "nl", "es", "it", "se", "ie", "dk", "be", "ch", "at", "pl", "pt", "fi", "no"];

// Time zone inside big countries, from the lead's location text ("Austin, Texas, United States"). Used so time buttons
// show the prospect's own local time; the country default (COUNTRIES[].tz) applies when no state or province is named.
export const SUBREGION_TZ = [
  ["America/Los_Angeles", ["california", "nevada", "oregon", "washington state", ", washington,", "seattle", "san francisco", "los angeles", "san diego", "las vegas", "portland"]],
  ["America/Denver", ["colorado", "idaho", "montana", "new mexico", "utah", "wyoming", "denver", "salt lake"]],
  ["America/Phoenix", ["arizona", "phoenix"]],
  ["America/Chicago", ["texas", "illinois", "alabama", "arkansas", "iowa", "kansas", "louisiana", "minnesota", "mississippi", "missouri", "nebraska", "north dakota", "oklahoma", "south dakota", "tennessee", "wisconsin", "chicago", "dallas", "houston", "austin"]],
  ["America/Anchorage", ["alaska"]],
  ["Pacific/Honolulu", ["hawaii"]],
  ["America/Vancouver", ["british columbia", "vancouver"]],
  ["America/Edmonton", ["alberta", "calgary", "edmonton"]],
  ["America/Regina", ["saskatchewan"]],
  ["America/Winnipeg", ["manitoba"]],
  ["America/Halifax", ["nova scotia", "new brunswick", "prince edward island"]],
  ["America/St_Johns", ["newfoundland"]],
  ["Australia/Perth", ["western australia", "perth"]],
  ["Australia/Adelaide", ["south australia", "adelaide"]],
  ["Australia/Darwin", ["northern territory", "darwin"]],
  ["Australia/Brisbane", ["queensland", "brisbane"]],
  ["Australia/Melbourne", ["victoria, australia", "melbourne"]],
  ["Australia/Hobart", ["tasmania", "hobart"]],
];

/** Code-node helper: tzFor(location, country) -> IANA zone or "" (inject into n8n Code nodes as a string). */
export const TZ_FROM_LOCATION_JS =
  "const SUBREGION_TZ = " + JSON.stringify(SUBREGION_TZ) + ";\n" +
  "const COUNTRY_TZ_BY_NAME = " + JSON.stringify(Object.fromEntries(COUNTRIES.map((c) => [c.name.toLowerCase(), c.tz]))) + ";\n" +
  "function tzFor(location, country) {\n" +
  "  const loc = ', ' + String(location || '').toLowerCase() + ',';\n" +
  "  const big = /united states|usa|canada|australia/.test(loc + ' ' + String(country || '').toLowerCase());\n" +
  "  if (big) for (const [tz, keys] of SUBREGION_TZ) if (keys.some(k => loc.includes(k))) return tz;\n" +
  "  return COUNTRY_TZ_BY_NAME[String(country || '').toLowerCase()] || '';\n" +
  "}\n";
