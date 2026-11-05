// Settings shapes and defaults that both the browser and the server use. Server reads/writes live in settings.ts.
import { DEFAULT_SERVICE_LINES as SHARED_SERVICE_LINES } from "../../n8n/services.mjs";

/** deliver = what we actually do, in plain words (the email-writing AI pitches it). */
export type SubService = { name: string; signals: string; deliver?: string };
/** A service line = one thing the client sells, mapped to the Smartlead campaign that emails it. */
export type ServiceLine = { id: string; name: string; campaignId: string; hint: string; items: SubService[] };
/** color = the brand accent (buttons, links, highlights); taken from the logo, editable in Settings. */
export type BrandSettings = { name: string; logo: string | null; color?: string | null };
export type ReplyPromptSettings = { prompt: string; startingPrice: string };
export type MeetingAlerts = { emails: string[] };

/** BrandFly blue, measured from the built-in logo. */
export const DEFAULT_BRAND_COLOR = "#0B5A94";
export const DEFAULT_BRAND: BrandSettings = { name: "BrandFly", logo: null, color: DEFAULT_BRAND_COLOR };
export const HEX_RE = /^#[0-9a-f]{6}$/i;

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
/**
 * The accent the dashboard uses for a brand colour: the colour itself, darkened step by step until white text on it
 * is readable (contrast 3.5:1 or better), so a light logo colour (yellow, sky blue) still gives usable buttons.
 */
export function brandAccent(hex: string | null | undefined): string {
  let h = hex && HEX_RE.test(hex) ? hex.toLowerCase() : DEFAULT_BRAND_COLOR.toLowerCase();
  for (let i = 0; i < 20 && 1.05 / (lum(h) + 0.05) < 3.5; i++) {
    h = "#" + [1, 3, 5].map((k) => Math.round(parseInt(h.slice(k, k + 2), 16) * 0.9).toString(16).padStart(2, "0")).join("");
  }
  return h;
}
export const DEFAULT_MEETING_ALERTS: MeetingAlerts = { emails: [] };

export const PRICE_RE = /^\$\d{1,3}(,?\d{3})*(\.\d{2})?$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** The reply prompt must keep these output keys or the workflow cannot read the AI answer. */
export const REQUIRED_OUTPUT_KEYS = ["subject", "body", "safe_to_send", "accepted_slot_iso", "include_booking_button", "flag", "detected_intent"];

export const DEFAULT_SERVICE_LINES: ServiceLine[] = SHARED_SERVICE_LINES;

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
