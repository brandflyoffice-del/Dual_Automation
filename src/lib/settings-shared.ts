// Settings shapes and defaults that both the browser and the server use. Server reads/writes live in settings.ts.
import { DEFAULT_SERVICE_LINES as SHARED_SERVICE_LINES } from "../../n8n/services.mjs";

/** deliver = what we actually do, in plain words (the email-writing AI pitches it). */
export type SubService = { name: string; signals: string; deliver?: string };
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
