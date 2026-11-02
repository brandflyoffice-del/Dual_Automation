// Settings shapes and defaults that both the browser and the server use. Server reads/writes live in settings.ts.

export type SubService = { name: string; signals: string };
/** A service line = one thing the client sells, mapped to the Smartlead campaign that emails it. */
export type ServiceLine = { id: string; name: string; campaignId: string; hint: string; items: SubService[] };
export type BrandSettings = { name: string; logo: string | null };
export type ReplyPromptSettings = { prompt: string; startingPrice: string };
export type MeetingAlerts = { emails: string[] };

export const DEFAULT_BRAND: BrandSettings = { name: "BrandFly", logo: null };
export const DEFAULT_MEETING_ALERTS: MeetingAlerts = { emails: [] };

export const PRICE_RE = /^\$\d{1,3}(,?\d{3})*(\.\d{2})?$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** The reply prompt must keep these output keys or the workflow cannot read the AI answer. */
export const REQUIRED_OUTPUT_KEYS = ["subject", "body", "safe_to_send", "accepted_slot_iso", "include_booking_button", "flag", "detected_intent"];

export const DEFAULT_SERVICE_LINES: ServiceLine[] = [
  {
    id: "web",
    name: "Website & E-commerce",
    campaignId: "4238486",
    hint: "Websites, online shops, conversion",
    items: [
      { name: "Website design & development", signals: "No website, outdated site, slow mobile page" },
      { name: "Ecommerce store", signals: "Sells products but has no shop, or a weak shop" },
      { name: "Shopify development", signals: "Runs or wants a Shopify store" },
      { name: "WooCommerce / WordPress", signals: "WordPress site, WooCommerce shop" },
      { name: "Magento", signals: "Large catalogue on Magento or Adobe Commerce" },
    ],
  },
  {
    id: "marketing",
    name: "SEO & Digital Marketing",
    campaignId: "4238487",
    hint: "SEO, ads, social, content",
    items: [
      { name: "SEO", signals: "Website exists but weak search visibility, missing meta description" },
      { name: "PSEO", signals: "Many locations or products and almost no landing pages" },
      { name: "Google & Meta Ads", signals: "No Meta Pixel, no GA4, wasted ad spend" },
      { name: "Social media management", signals: "Weak or inactive social presence" },
      { name: "Content marketing", signals: "No blog or thin content" },
    ],
  },
  {
    id: "software",
    name: "Custom Software & Apps",
    campaignId: "4238488",
    hint: "Apps, SaaS, custom software, dedicated developers",
    items: [
      { name: "Custom software", signals: "Manual process, old stack, spreadsheet operations" },
      { name: "Web app", signals: "Internal tool or customer portal they run by hand" },
      { name: "SaaS development", signals: "Product idea or internal tool they want as software" },
      { name: "Mobile apps", signals: "Mobile experience is a slow website, or they mention an app" },
      { name: "Staff augmentation", signals: "Hiring developers or designers, small in-house tech team" },
    ],
  },
  {
    id: "systems",
    name: "Systems, Automation & Managed IT",
    campaignId: "4238489",
    hint: "CRM, ERP, automation, cloud, IT support",
    items: [
      { name: "CRM", signals: "Sales team with no CRM mentioned" },
      { name: "ERP", signals: "Manufacturer, distributor, or multi-site firm with no modern ERP signal" },
      { name: "SAP", signals: "Enterprise manufacturer or logistics firm" },
      { name: "AI / workflow automation", signals: "Repetitive ops, support load, manual follow-up" },
      { name: "Cloud", signals: "On-prem or aging hosting signals" },
      { name: "Managed IT & helpdesk", signals: "No IT team, Google Workspace or Microsoft 365 users, security gaps" },
    ],
  },
  {
    id: "rfid",
    name: "RFID & IoT",
    campaignId: "4238491",
    hint: "RFID, sensors, stock and asset tracking",
    items: [
      { name: "RFID", signals: "Warehouse, retail chain, manufacturing, asset tracking" },
      { name: "IoT", signals: "Physical operations that could use sensors or connected devices" },
    ],
  },
];

/**
 * Cost estimate rates for the Launch form. These are list prices checked on 2026-11-02, not bills; change them here when a plan changes.
 * Per-lead costs are an upper bound: GPT runs only on people who pass the ICP filter.
 */
export const COST_RATES = {
  apifyPerLead: 0.0025, // b2bsearch/b2b-leads-finder on the Apify Starter plan: $2.50 per 1,000 people with a live email (others free)
  aiArkCreditsPerLead: 1.5, // search + export with BounceBan verification
  gptQualifyPerLead: 0.025, // gpt-4o: site audit read, score, dossier and 4 emails (~5k tokens in, ~1.3k out)
  gptPerReply: 0.02, // classify + drafted answer for one prospect reply
  expectedReplyRate: 0.05, // used only to show the reply-handling cost
};
