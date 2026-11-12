// The API keys the client can manage in Settings > Integrations (safe to import from client components: no secrets here).
// n8n reads the same keys at run time from the dashboard (/api/internal/integrations), so a new key works on the next
// launch or reply without a rebuild or deploy. A key left empty here falls back to the one set on the server.

export type IntegrationKey =
  | "APIFY_TOKEN"
  | "APIFY_ACTOR_ID"
  | "SMARTLEAD_API_KEY"
  | "OPENAI_API_KEY"
  | "OPENAI_MODEL"
  | "AI_ARK_API_KEY"
  | "CAL_API_KEY"
  | "PAGESPEED_API_KEY"
  | "EMAIL_VALIDATION_API_KEY";

export type IntegrationField = {
  key: IntegrationKey;
  service: string;
  label: string;
  /** What it is used for, in plain words. */
  use: string;
  /** Where to copy it from. */
  where: string;
  link: string;
  secret: boolean;
  /** A "Test" button that checks the key against the service (free calls only). */
  testable: boolean;
  optional?: boolean;
};

export const INTEGRATION_FIELDS: IntegrationField[] = [
  {
    key: "APIFY_TOKEN",
    service: "Apify",
    label: "Apify API token",
    use: "Finds new decision makers when you launch a campaign with Apify.",
    where: "Apify Console > Settings > API & Integrations > Personal API tokens",
    link: "https://console.apify.com/settings/integrations",
    secret: true,
    testable: true,
  },
  {
    key: "SMARTLEAD_API_KEY",
    service: "Smartlead",
    label: "Smartlead API key",
    use: "Adds leads to campaigns, sends follow-ups, inbox, email analytics, mailboxes.",
    where: "Smartlead > Settings > API key (top of the page)",
    link: "https://app.smartlead.ai/app/settings/profile",
    secret: true,
    testable: true,
  },
  {
    key: "OPENAI_API_KEY",
    service: "OpenAI",
    label: "OpenAI API key",
    use: "Writes the outreach emails, reads replies and drafts the answers.",
    where: "platform.openai.com > API keys > Create new secret key",
    link: "https://platform.openai.com/api-keys",
    secret: true,
    testable: true,
  },
  {
    key: "CAL_API_KEY",
    service: "Cal.com",
    label: "Cal.com API key",
    use: "Finds free meeting times and books the meeting when a prospect picks one.",
    where: "Cal.com > Settings > Developer > API keys",
    link: "https://app.cal.com/settings/developer/api-keys",
    secret: true,
    testable: true,
  },
  {
    key: "AI_ARK_API_KEY",
    service: "AI Ark",
    label: "AI Ark API key",
    use: "Finds leads when you launch a campaign with AI Ark instead of Apify.",
    where: "AI Ark > Developer portal > API key",
    link: "https://ai-ark.com",
    secret: true,
    testable: false,
    optional: true,
  },
  {
    key: "PAGESPEED_API_KEY",
    service: "Google PageSpeed",
    label: "PageSpeed API key",
    use: "Measures how fast each lead's website loads on phones (optional).",
    where: "Google Cloud Console > APIs & Services > Credentials > API key (PageSpeed Insights API enabled)",
    link: "https://developers.google.com/speed/docs/insights/v5/get-started",
    secret: true,
    testable: false,
    optional: true,
  },
  {
    key: "EMAIL_VALIDATION_API_KEY",
    service: "Abstract",
    label: "Abstract email validation key",
    use: "Double-checks emails that the lead source did not verify (optional).",
    where: "app.abstractapi.com > Email Validation > API key",
    link: "https://app.abstractapi.com/api/email-validation/tester",
    secret: true,
    testable: false,
    optional: true,
  },
  {
    key: "OPENAI_MODEL",
    service: "OpenAI",
    label: "OpenAI model",
    use: "The model that writes and answers emails. Leave as it is unless told otherwise.",
    where: "For example gpt-4o",
    link: "https://platform.openai.com/docs/models",
    secret: false,
    testable: false,
    optional: true,
  },
  {
    key: "APIFY_ACTOR_ID",
    service: "Apify",
    label: "Apify lead finder (actor)",
    use: "Which Apify tool searches for leads. Leave as it is unless told otherwise.",
    where: "For example b2bsearch~b2b-leads-finder",
    link: "https://console.apify.com/actors",
    secret: false,
    testable: false,
    optional: true,
  },
];

export const INTEGRATION_KEYS = INTEGRATION_FIELDS.map((f) => f.key);

export type IntegrationStatus = {
  key: IntegrationKey;
  /** Where the active value comes from: saved here, set on the server, or missing. */
  source: "dashboard" | "server" | "none";
  /** Last 4 characters of a secret, or the full value of a non-secret setting. */
  hint: string;
  updatedAt: string | null;
};
