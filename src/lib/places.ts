// Searchable places and industries for the Launch form. Countries come from n8n/targeting.mjs (shared with the workflow).
import { COUNTRIES, EUROPE_CORE } from "../../n8n/targeting.mjs";

export type Country = { code: string; name: string; tz: string; region: string };
export const COUNTRY_LIST = COUNTRIES as Country[];
export const COUNTRY_BY_CODE = Object.fromEntries(COUNTRY_LIST.map((c) => [c.code, c])) as Record<string, Country>;
export const EUROPE_CODES = EUROPE_CORE as string[];

/** One selected place. Regions are the four original target markets; custom = typed text we have no entry for. */
export type PlacePick =
  | { kind: "region"; id: "US" | "UK" | "EUROPE" | "UAE" }
  | { kind: "country"; code: string }
  | { kind: "city"; name: string; code: string; area?: string }
  | { kind: "custom"; name: string };

export const REGION_PICKS: { id: "US" | "UK" | "EUROPE" | "UAE"; label: string; detail: string }[] = [
  { id: "US", label: "United States", detail: "Whole country" },
  { id: "UK", label: "United Kingdom", detail: "Whole country" },
  { id: "EUROPE", label: "Europe", detail: "15 countries (DE, FR, NL, ES, IT, Nordics…)" },
  { id: "UAE", label: "UAE", detail: "Whole country" },
];
export const DEFAULT_PLACES: PlacePick[] = REGION_PICKS.map((r) => ({ kind: "region", id: r.id }));

// [city, country code, state/area]
const CITY_ROWS: [string, string, string?][] = [
  // India
  ["Mumbai", "in", "Maharashtra"], ["Delhi", "in", "Delhi NCR"], ["New Delhi", "in", "Delhi NCR"], ["Bengaluru", "in", "Karnataka"],
  ["Hyderabad", "in", "Telangana"], ["Chennai", "in", "Tamil Nadu"], ["Kolkata", "in", "West Bengal"], ["Pune", "in", "Maharashtra"],
  ["Ahmedabad", "in", "Gujarat"], ["Surat", "in", "Gujarat"], ["Jaipur", "in", "Rajasthan"], ["Lucknow", "in", "Uttar Pradesh"],
  ["Gurugram", "in", "Haryana"], ["Noida", "in", "Uttar Pradesh"], ["Thane", "in", "Maharashtra"], ["Navi Mumbai", "in", "Maharashtra"],
  ["Nagpur", "in", "Maharashtra"], ["Nashik", "in", "Maharashtra"], ["Indore", "in", "Madhya Pradesh"], ["Bhopal", "in", "Madhya Pradesh"],
  ["Chandigarh", "in", "Chandigarh"], ["Ludhiana", "in", "Punjab"], ["Amritsar", "in", "Punjab"], ["Kochi", "in", "Kerala"],
  ["Thiruvananthapuram", "in", "Kerala"], ["Coimbatore", "in", "Tamil Nadu"], ["Madurai", "in", "Tamil Nadu"], ["Visakhapatnam", "in", "Andhra Pradesh"],
  ["Vijayawada", "in", "Andhra Pradesh"], ["Vadodara", "in", "Gujarat"], ["Rajkot", "in", "Gujarat"], ["Kanpur", "in", "Uttar Pradesh"],
  ["Agra", "in", "Uttar Pradesh"], ["Varanasi", "in", "Uttar Pradesh"], ["Patna", "in", "Bihar"], ["Bhubaneswar", "in", "Odisha"],
  ["Guwahati", "in", "Assam"], ["Mysuru", "in", "Karnataka"], ["Mangaluru", "in", "Karnataka"], ["Dehradun", "in", "Uttarakhand"],
  ["Raipur", "in", "Chhattisgarh"], ["Ranchi", "in", "Jharkhand"], ["Goa", "in", "Goa"], ["Udaipur", "in", "Rajasthan"],
  ["Jodhpur", "in", "Rajasthan"], ["Aurangabad", "in", "Maharashtra"],
  // United States (cities and states)
  ["New York", "us", "New York"], ["Los Angeles", "us", "California"], ["Chicago", "us", "Illinois"], ["Houston", "us", "Texas"],
  ["Dallas", "us", "Texas"], ["Austin", "us", "Texas"], ["San Antonio", "us", "Texas"], ["Phoenix", "us", "Arizona"],
  ["Philadelphia", "us", "Pennsylvania"], ["Pittsburgh", "us", "Pennsylvania"], ["San Diego", "us", "California"], ["San Francisco", "us", "California"],
  ["San Jose", "us", "California"], ["Sacramento", "us", "California"], ["Seattle", "us", "Washington"], ["Portland", "us", "Oregon"],
  ["Denver", "us", "Colorado"], ["Boston", "us", "Massachusetts"], ["Miami", "us", "Florida"], ["Orlando", "us", "Florida"],
  ["Tampa", "us", "Florida"], ["Atlanta", "us", "Georgia"], ["Washington", "us", "District of Columbia"], ["Baltimore", "us", "Maryland"],
  ["Las Vegas", "us", "Nevada"], ["Nashville", "us", "Tennessee"], ["Charlotte", "us", "North Carolina"], ["Raleigh", "us", "North Carolina"],
  ["Minneapolis", "us", "Minnesota"], ["Detroit", "us", "Michigan"], ["Columbus", "us", "Ohio"], ["Cleveland", "us", "Ohio"],
  ["Indianapolis", "us", "Indiana"], ["Kansas City", "us", "Missouri"], ["St. Louis", "us", "Missouri"], ["Salt Lake City", "us", "Utah"],
  ["New Jersey", "us", "State"], ["California", "us", "State"], ["Texas", "us", "State"], ["Florida", "us", "State"], ["Illinois", "us", "State"],
  // United Kingdom
  ["London", "gb", "England"], ["Manchester", "gb", "England"], ["Birmingham", "gb", "England"], ["Leeds", "gb", "England"],
  ["Liverpool", "gb", "England"], ["Bristol", "gb", "England"], ["Sheffield", "gb", "England"], ["Newcastle", "gb", "England"],
  ["Nottingham", "gb", "England"], ["Leicester", "gb", "England"], ["Brighton", "gb", "England"], ["Cambridge", "gb", "England"],
  ["Oxford", "gb", "England"], ["Reading", "gb", "England"], ["Southampton", "gb", "England"], ["Milton Keynes", "gb", "England"],
  ["Glasgow", "gb", "Scotland"], ["Edinburgh", "gb", "Scotland"], ["Aberdeen", "gb", "Scotland"], ["Cardiff", "gb", "Wales"], ["Belfast", "gb", "Northern Ireland"],
  // UAE
  ["Dubai", "ae"], ["Abu Dhabi", "ae"], ["Sharjah", "ae"], ["Ajman", "ae"], ["Ras Al Khaimah", "ae"],
  // Europe
  ["Berlin", "de"], ["Munich", "de"], ["Hamburg", "de"], ["Frankfurt", "de"], ["Cologne", "de"], ["Stuttgart", "de"], ["Düsseldorf", "de"],
  ["Paris", "fr"], ["Lyon", "fr"], ["Marseille", "fr"], ["Toulouse", "fr"], ["Nice", "fr"],
  ["Amsterdam", "nl"], ["Rotterdam", "nl"], ["The Hague", "nl"], ["Utrecht", "nl"], ["Eindhoven", "nl"],
  ["Madrid", "es"], ["Barcelona", "es"], ["Valencia", "es"], ["Seville", "es"], ["Málaga", "es"],
  ["Milan", "it"], ["Rome", "it"], ["Turin", "it"], ["Florence", "it"], ["Naples", "it"],
  ["Stockholm", "se"], ["Gothenburg", "se"], ["Malmö", "se"], ["Dublin", "ie"], ["Cork", "ie"], ["Galway", "ie"],
  ["Copenhagen", "dk"], ["Aarhus", "dk"], ["Brussels", "be"], ["Antwerp", "be"], ["Ghent", "be"],
  ["Zurich", "ch"], ["Geneva", "ch"], ["Basel", "ch"], ["Lausanne", "ch"], ["Vienna", "at"], ["Graz", "at"], ["Salzburg", "at"],
  ["Warsaw", "pl"], ["Kraków", "pl"], ["Wrocław", "pl"], ["Gdańsk", "pl"], ["Lisbon", "pt"], ["Porto", "pt"],
  ["Helsinki", "fi"], ["Oslo", "no"], ["Bergen", "no"], ["Luxembourg", "lu"], ["Prague", "cz"], ["Athens", "gr"],
  ["Budapest", "hu"], ["Bucharest", "ro"], ["Tallinn", "ee"], ["Riga", "lv"], ["Vilnius", "lt"],
  // Rest of the world
  ["Toronto", "ca", "Ontario"], ["Vancouver", "ca", "British Columbia"], ["Montreal", "ca", "Quebec"], ["Calgary", "ca", "Alberta"], ["Ottawa", "ca", "Ontario"],
  ["Sydney", "au", "New South Wales"], ["Melbourne", "au", "Victoria"], ["Brisbane", "au", "Queensland"], ["Perth", "au", "Western Australia"],
  ["Auckland", "nz"], ["Wellington", "nz"], ["Singapore", "sg"], ["Hong Kong", "hk"], ["Tokyo", "jp"], ["Seoul", "kr"],
  ["Kuala Lumpur", "my"], ["Jakarta", "id"], ["Bangkok", "th"], ["Manila", "ph"], ["Ho Chi Minh City", "vn"],
  ["Karachi", "pk"], ["Lahore", "pk"], ["Dhaka", "bd"], ["Colombo", "lk"], ["Kathmandu", "np"],
  ["Riyadh", "sa"], ["Jeddah", "sa"], ["Doha", "qa"], ["Kuwait City", "kw"], ["Muscat", "om"], ["Manama", "bh"],
  ["Tel Aviv", "il"], ["Istanbul", "tr"], ["Cairo", "eg"], ["Johannesburg", "za"], ["Cape Town", "za"], ["Lagos", "ng"], ["Nairobi", "ke"],
  ["São Paulo", "br"], ["Mexico City", "mx"], ["Buenos Aires", "ar"], ["Bogotá", "co"], ["Santiago", "cl"],
];

export type City = { name: string; code: string; area?: string };
export const CITY_LIST: City[] = CITY_ROWS.map(([name, code, area]) => ({ name, code, area }));

export function placeKey(p: PlacePick) {
  return p.kind === "region" ? `r:${p.id}` : p.kind === "country" ? `c:${p.code}` : p.kind === "city" ? `t:${p.code}:${p.name}` : `x:${p.name.toLowerCase()}`;
}

export function placeLabel(p: PlacePick) {
  if (p.kind === "region") return REGION_PICKS.find((r) => r.id === p.id)?.label ?? p.id;
  if (p.kind === "country") return COUNTRY_BY_CODE[p.code]?.name ?? p.code.toUpperCase();
  if (p.kind === "city") return `${p.name}, ${COUNTRY_BY_CODE[p.code]?.name ?? p.code.toUpperCase()}`;
  return p.name;
}

const ICP_COUNTRY_REGION: Record<string, "US" | "UK" | "UAE" | "EUROPE"> = { us: "US", gb: "UK", ae: "UAE" };
EUROPE_CODES.forEach((c) => (ICP_COUNTRY_REGION[c] = "EUROPE"));
const REGION_COUNTRIES: Record<string, string[]> = { US: ["us"], UK: ["gb"], UAE: ["ae"], EUROPE: EUROPE_CODES };

/**
 * Turns the place picks into what /api/leads/scrape expects.
 * Only the four regions or whole countries inside them → the original region filters (regions + europeCountries).
 * Anything else (a city, India, a typed place) → named places: `places` for AI Ark, `placeCountries`/`placeCities` for Apify.
 */
export function placesPayload(picks: PlacePick[]) {
  const regionOnly = picks.every((p) => p.kind === "region" || (p.kind === "country" && ICP_COUNTRY_REGION[p.code]));
  if (regionOnly) {
    const regions = new Set<string>();
    const europe = new Set<string>();
    for (const p of picks) {
      if (p.kind === "region") {
        regions.add(p.id);
        if (p.id === "EUROPE") EUROPE_CODES.forEach((c) => europe.add(c));
      } else if (p.kind === "country") {
        const r = ICP_COUNTRY_REGION[p.code];
        regions.add(r);
        if (r === "EUROPE") europe.add(p.code);
      }
    }
    return { mode: "regions" as const, regions: [...regions], europeCountries: [...europe], places: [], placeCountries: [], placeCities: [] };
  }
  const places: string[] = [];
  const codes = new Set<string>();
  const cities: string[] = [];
  for (const p of picks) {
    if (p.kind === "region") {
      REGION_COUNTRIES[p.id].forEach((c) => {
        codes.add(c);
        places.push(COUNTRY_BY_CODE[c].name);
      });
    } else if (p.kind === "country") {
      codes.add(p.code);
      places.push(COUNTRY_BY_CODE[p.code]?.name ?? p.code);
    } else if (p.kind === "city") {
      codes.add(p.code);
      cities.push(p.name);
      places.push(p.name);
    } else {
      cities.push(p.name);
      places.push(p.name);
    }
  }
  return { mode: "places" as const, regions: ["US", "UK", "EUROPE", "UAE"], europeCountries: [], places: places.slice(0, 20), placeCountries: [...codes].slice(0, 60), placeCities: cities.slice(0, 10) };
}

/**
 * Industries people can add next to the five core ones. `apify` is the LinkedIn industry name Apify filters on;
 * without one the word is searched in the profile headline instead.
 */
export const INDUSTRY_SUGGESTIONS: { label: string; apify?: string }[] = [
  { label: "Jewelry", apify: "Retail Luxury Goods and Jewelry" },
  { label: "Fashion & Apparel", apify: "Retail Apparel and Fashion" },
  { label: "Beauty & Cosmetics", apify: "Personal Care Product Manufacturing" },
  { label: "Furniture & Home Decor", apify: "Furniture and Home Furnishings Manufacturing" },
  { label: "Food & Beverage", apify: "Food and Beverage Services" },
  { label: "Restaurants", apify: "Restaurants" },
  { label: "Hotels & Travel", apify: "Travel Arrangements" },
  { label: "Healthcare & Clinics", apify: "Hospitals and Health Care" },
  { label: "Dental", apify: "Medical Practices" },
  { label: "Pharmaceuticals", apify: "Pharmaceutical Manufacturing" },
  { label: "Fitness & Wellness", apify: "Wellness and Fitness Services" },
  { label: "Education & Schools", apify: "Education" },
  { label: "Real Estate", apify: "Real Estate" },
  { label: "Construction", apify: "Construction" },
  { label: "Architecture & Interior Design", apify: "Architecture and Planning" },
  { label: "Manufacturing", apify: "Manufacturing" },
  { label: "Automotive", apify: "Motor Vehicle Manufacturing" },
  { label: "Logistics & Shipping", apify: "Transportation, Logistics, Supply Chain and Storage" },
  { label: "Wholesale & Distribution", apify: "Wholesale" },
  { label: "Textiles", apify: "Textile Manufacturing" },
  { label: "Agriculture", apify: "Farming" },
  { label: "Financial Services", apify: "Financial Services" },
  { label: "Insurance", apify: "Insurance" },
  { label: "Accounting", apify: "Accounting" },
  { label: "Legal / Law Firms", apify: "Law Practice" },
  { label: "Consulting", apify: "Business Consulting and Services" },
  { label: "Marketing & Advertising Agencies", apify: "Advertising Services" },
  { label: "Software & SaaS", apify: "Software Development" },
  { label: "IT Services", apify: "IT Services and IT Consulting" },
  { label: "Media & Entertainment", apify: "Entertainment Providers" },
  { label: "Events & Weddings", apify: "Events Services" },
  { label: "Non-profit", apify: "Non-profit Organizations" },
  { label: "Recruitment & Staffing", apify: "Staffing and Recruiting" },
  { label: "Security & Surveillance", apify: "Security and Investigations" },
  { label: "Energy & Solar", apify: "Renewable Energy Power Generation" },
  { label: "Printing & Packaging", apify: "Packaging and Containers Manufacturing" },
];

export function apifyIndustryFor(label: string) {
  return INDUSTRY_SUGGESTIONS.find((s) => s.label.toLowerCase() === label.trim().toLowerCase())?.apify;
}
