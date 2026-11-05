// The client's service catalogue: one service line per Smartlead campaign, each with sub-services.
// Shared by the dashboard (Services page, Launch) and the lead lane, which gives it to the email-writing AI so every
// email pitches ONE concrete thing we deliver. The dashboard copy (app_settings.service_lines) wins; this is the default.
//   signals = what on a prospect's site or profile suggests they need it
//   deliver = what we actually do, in plain words a business owner understands (used in the email)

export const DEFAULT_SERVICE_LINES = [
  {
    id: "web",
    name: "Website & E-commerce",
    campaignId: "4238486",
    hint: "Websites, online shops, conversion",
    items: [
      { name: "Website design & development", signals: "No website, outdated site, slow mobile page", deliver: "a fast, mobile-first website with a clear enquiry or booking path, built at a fixed price" },
      { name: "Ecommerce store", signals: "Sells products but has no shop, or a weak shop", deliver: "a complete online store with catalogue, checkout, payments and shipping, ready to sell" },
      { name: "Shopify development", signals: "Runs or wants a Shopify store", deliver: "Shopify store set-up, theme, apps and speed fixes" },
      { name: "WooCommerce / WordPress", signals: "WordPress site, WooCommerce shop", deliver: "a WordPress / WooCommerce rebuild or clean-up that loads fast and converts" },
      { name: "Magento", signals: "Large catalogue on Magento or Adobe Commerce", deliver: "Magento speed and checkout fixes, upgrades, or a move to Shopify" },
    ],
  },
  {
    id: "marketing",
    name: "SEO & Digital Marketing",
    campaignId: "4238487",
    hint: "SEO, ads, social, content",
    items: [
      { name: "SEO", signals: "Website exists but weak search visibility, missing meta description", deliver: "SEO: page titles, content and technical fixes so the site shows up for the searches their buyers make" },
      { name: "PSEO", signals: "Many locations or products and almost no landing pages", deliver: "a landing page for every location or product so each one can rank on Google" },
      { name: "Google & Meta Ads", signals: "No Meta Pixel, no GA4, wasted ad spend", deliver: "tracking set-up so they can see which ads and visits turn into sales or enquiries, then managed Google and Meta ad campaigns" },
      { name: "Social media management", signals: "Weak or inactive social presence", deliver: "regular social posts, creatives and community management" },
      { name: "Content marketing", signals: "No blog or thin content", deliver: "a blog and content plan that brings search traffic and enquiries" },
    ],
  },
  {
    id: "software",
    name: "Custom Software & Apps",
    campaignId: "4238488",
    hint: "Apps, SaaS, custom software, dedicated developers",
    items: [
      { name: "Custom software", signals: "Manual process, old stack, spreadsheet operations", deliver: "custom software that replaces spreadsheets and manual steps" },
      { name: "Web app", signals: "Internal tool or customer portal they run by hand", deliver: "a customer portal or internal web app" },
      { name: "SaaS development", signals: "Product idea or internal tool they want as software", deliver: "design and build of their SaaS product, from first version to launch" },
      { name: "Mobile apps", signals: "Mobile experience is a slow website, or they mention an app", deliver: "iOS and Android apps built once for both platforms" },
      { name: "Staff augmentation", signals: "Hiring developers or designers, small in-house tech team", deliver: "dedicated developers or designers who join their team within days" },
    ],
  },
  {
    id: "systems",
    name: "Systems, Automation & Managed IT",
    campaignId: "4238489",
    hint: "CRM, ERP, automation, cloud, IT support",
    items: [
      { name: "CRM", signals: "Sales team with no CRM mentioned", deliver: "a CRM set-up so every lead and follow-up is tracked in one place" },
      { name: "ERP", signals: "Manufacturer, distributor, or multi-site firm with no modern ERP signal", deliver: "an ERP that connects stock, orders and finance" },
      { name: "SAP", signals: "Enterprise manufacturer or logistics firm", deliver: "SAP implementation and support" },
      { name: "AI / workflow automation", signals: "Repetitive ops, support load, manual follow-up", deliver: "automations that take repetitive admin and follow-ups off the team" },
      { name: "Cloud", signals: "On-prem or aging hosting signals", deliver: "a move to secure cloud hosting with backups and monitoring" },
      { name: "Managed IT & helpdesk", signals: "No IT team, Google Workspace or Microsoft 365 users, security gaps", deliver: "managed IT, security hardening and a 24/7 helpdesk" },
    ],
  },
  {
    id: "rfid",
    name: "RFID & IoT",
    campaignId: "4238491",
    hint: "RFID, sensors, stock and asset tracking",
    items: [
      { name: "RFID", signals: "Warehouse, retail chain, manufacturing, asset tracking", deliver: "RFID stock and asset tracking" },
      { name: "IoT", signals: "Physical operations that could use sensors or connected devices", deliver: "connected sensors and live dashboards for their operations" },
    ],
  },
];

/** Default "what we deliver" by sub-service name, for catalogues saved before the field existed. */
export const DEFAULT_DELIVER = Object.fromEntries(DEFAULT_SERVICE_LINES.flatMap((l) => l.items.map((i) => [i.name.toLowerCase(), i.deliver])));

/** Facts the emails may use for credibility, per brand (nothing else may be claimed). */
export const BRAND_FACTS = {
  TapadiaTech: "Building websites, shops and software since 2001; clients in 60+ countries; 25+ years of web, 17+ years of mobile apps and 15+ years of SEO experience.",
  "Expert in SEO": "15+ years of SEO experience.",
};
