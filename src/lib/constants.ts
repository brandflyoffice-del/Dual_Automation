// Single source of truth for Fenebris business rules (mirrored in the n8n AI prompts).

/** Launch-campaign source. Same filters either way; only the people search changes. */
export const LEAD_PROVIDERS = [
  {
    id: "ai-ark",
    label: "AI Ark",
    detail: "BounceBan checks the mailbox. About 1.5 credits per person.",
  },
  {
    id: "apify",
    label: "Apify",
    detail: "Actor b2bsearch/b2b-leads-finder. Same filters, live email at the current company, about $1.50 per 1,000. Use one country, or cities inside that country.",
  },
] as const;

export type LeadProvider = (typeof LEAD_PROVIDERS)[number]["id"];

/** Smartlead drafts. The launch form shows the name and sends the id. */
export const OUTREACH_CAMPAIGNS = [
  { id: "4238486", name: "Website & Ecommerce", hint: "Websites, online shops, conversion" },
  { id: "4238487", name: "SEO & Social", hint: "SEO, ads, social, digital marketing" },
  { id: "4238488", name: "Custom Software & Apps", hint: "Apps, SaaS, custom software" },
  { id: "4238489", name: "Systems & Automation", hint: "CRM, ERP, automation, cloud" },
  { id: "4238491", name: "RFID & IoT", hint: "RFID, sensors, stock tracking" },
] as const;

export function pickCampaign(input: { offering?: string; service?: string; sentence?: string; industry?: string }) {
  const blob = [input.offering, input.sentence, input.industry, input.service].filter(Boolean).join(" ").toLowerCase();
  if (/rfid|\biot\b|sensor/.test(blob)) return "4238491";
  if (/\berp\b|\bcrm\b|\bsap\b|automat|cloud/.test(blob) || input.service === "MANAGED_IT") return "4238489";
  if (/software|mobile app|\bsaas\b|\bapp\b/.test(blob) || input.service === "STAFF_AUG") return "4238488";
  if (/seo|social|ads|marketing/.test(blob) || input.service === "DIGITAL_MARKETING") return "4238487";
  return "4238486";
}

export const ICP = {
  regions: ["US", "UK", "EUROPE", "UAE"] as const,
  roles: ["Founder", "Co-Founder", "CEO", "CTO", "Operations Director"],
  industries: ["ECOMMERCE_RETAIL", "FINTECH", "REAL_ESTATE_LOGISTICS", "EDTECH", "HOSPITALITY"] as const,
  revenueMin: 100_000,
  revenueMax: 10_000_000,
  minTicket: 100, // dashboard floor/ceiling for an opportunity value (pricing here starts at $100 per user per month; the n8n ticket gate is off)
  maxTicketModel: 200,
} as const;

export type Region = (typeof ICP.regions)[number];
export type Industry = (typeof ICP.industries)[number];

export const REGION_META: Record<Region, { label: string; flag: string; tz: string; color: string }> = {
  US: { label: "United States", flag: "🇺🇸", tz: "America/New_York", color: "#6366f1" },
  UK: { label: "United Kingdom", flag: "🇬🇧", tz: "Europe/London", color: "#10b981" },
  EUROPE: { label: "Europe", flag: "🇪🇺", tz: "Europe/Berlin", color: "#f59e0b" },
  UAE: { label: "UAE", flag: "🇦🇪", tz: "Asia/Dubai", color: "#ec4899" },
};

export const INDUSTRY_LABEL: Record<Industry, string> = {
  ECOMMERCE_RETAIL: "E-commerce & Retail",
  FINTECH: "FinTech",
  REAL_ESTATE_LOGISTICS: "Real Estate & Logistics",
  EDTECH: "EdTech",
  HOSPITALITY: "Hospitality",
};

export const SERVICES = ["WEB_ECOM", "DIGITAL_MARKETING", "STAFF_AUG", "MANAGED_IT"] as const;
export type Service = (typeof SERVICES)[number];

export const SERVICE_META: Record<Service, { label: string; short: string; color: string; stack: string }> = {
  WEB_ECOM: {
    label: "Web & E-commerce Development",
    short: "Web / E-com",
    color: "#6366f1",
    stack: "React, Next.js, Node.js, Python, PHP, Laravel, Shopify, WooCommerce, Magento, Flutter, React Native",
  },
  DIGITAL_MARKETING: {
    label: "Digital Marketing Services",
    short: "Digital Marketing",
    color: "#10b981",
    stack: "SEO, Google & Meta Ads, Social Media Marketing, Content Creation",
  },
  STAFF_AUG: {
    label: "Staff Augmentation",
    short: "Staff Aug",
    color: "#f59e0b",
    stack: "Dedicated developers and designers to scale in-house teams quickly",
  },
  MANAGED_IT: {
    label: "Managed IT Services",
    short: "Managed IT",
    color: "#ec4899",
    stack: "IT infrastructure, cloud management, Google Workspace, Microsoft 365, network security, 24/7 helpdesk",
  },
};

export const LEAD_STAGES = [
  "SCRAPED",
  "VERIFIED",
  "STEP_1_SENT",
  "FOLLOWUP_2",
  "FOLLOWUP_3",
  "BREAKUP_SENT",
  "REPLIED",
  "BOOKED",
  "NOT_INTERESTED",
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const STAGE_LABEL: Record<string, string> = {
  SCRAPED: "Scraped",
  VERIFIED: "Verified",
  STEP_1_SENT: "Step 1 Sent",
  FOLLOWUP_2: "Follow-up 2 Scheduled",
  FOLLOWUP_3: "Follow-up 3 Scheduled",
  BREAKUP_SENT: "Breakup Sent",
  REPLIED: "Replied",
  BOOKED: "Booked",
  NOT_INTERESTED: "Not Interested",
};

export const SENT_STAGES = ["STEP_1_SENT", "FOLLOWUP_2", "FOLLOWUP_3", "BREAKUP_SENT", "REPLIED", "BOOKED", "NOT_INTERESTED"];
export const ACTIVE_STAGES = ["STEP_1_SENT", "FOLLOWUP_2", "FOLLOWUP_3"];

export const SENTIMENTS = [
  "Positive_Booking_Intent",
  "Question_Needs_FollowUp",
  "Not_Interested",
  "Out_Of_Office",
] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

export const SENTIMENT_LABEL: Record<Sentiment, string> = {
  Positive_Booking_Intent: "Wants to book",
  Question_Needs_FollowUp: "Has a question",
  Not_Interested: "Not interested",
  Out_Of_Office: "Out of office",
};

export const MEETING_STATUSES = [
  "SCHEDULED",
  "COMPLETED_PROPOSAL_SENT",
  "CLOSED_WON",
  "NO_SHOW",
  "RESCHEDULED",
  "CANCELLED",
] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export const MEETING_STATUS_LABEL: Record<MeetingStatus, string> = {
  SCHEDULED: "Scheduled",
  COMPLETED_PROPOSAL_SENT: "Completed - Proposal Sent",
  CLOSED_WON: "Closed Won",
  NO_SHOW: "No Show",
  RESCHEDULED: "Rescheduled",
  CANCELLED: "Cancelled",
};

export const SEQUENCE_STEPS = [
  { step: 1, day: 0, name: "Pain-point hook + booking CTA" },
  { step: 2, day: 3, name: "Fixed-price / ROI case study" },
  { step: 3, day: 7, name: "Technical bottleneck reminder" },
  { step: 4, day: 11, name: "Breakup email" },
] as const;

export const EMAIL_EVENT_TYPES = [
  "EMAIL_SENT",
  "EMAIL_OPENED",
  "LINK_CLICKED",
  "REPLY_RECEIVED",
  "EMAIL_BOUNCED",
  "AI_REPLY_SENT",
] as const;

/** Company-size buckets the lead search is allowed to use. Default = all of them. */
export const EUROPE_COUNTRIES = [
  { code: "de", label: "Germany" },
  { code: "fr", label: "France" },
  { code: "nl", label: "Netherlands" },
  { code: "es", label: "Spain" },
  { code: "it", label: "Italy" },
  { code: "se", label: "Sweden" },
  { code: "ie", label: "Ireland" },
  { code: "dk", label: "Denmark" },
  { code: "be", label: "Belgium" },
  { code: "ch", label: "Switzerland" },
  { code: "at", label: "Austria" },
  { code: "pl", label: "Poland" },
  { code: "pt", label: "Portugal" },
  { code: "fi", label: "Finland" },
  { code: "no", label: "Norway" },
] as const;

export const EMPLOYEE_RANGES = [
  { id: "1,10", label: "1–10" },
  { id: "11,20", label: "11–20" },
  { id: "21,50", label: "21–50" },
  { id: "51,100", label: "51–100" },
  { id: "101,200", label: "101–200" },
] as const;
export type EmployeeRange = (typeof EMPLOYEE_RANGES)[number]["id"];

export const IST_TZ = "Asia/Kolkata";
