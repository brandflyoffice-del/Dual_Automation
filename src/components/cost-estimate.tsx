import { Calculator } from "lucide-react";
import { COST_RATES } from "@/lib/settings-shared";
import type { LeadProvider } from "@/lib/constants";

const usd = (n: number) => (n < 0.01 && n > 0 ? "< $0.01" : `$${n.toFixed(n < 10 ? 2 : 0)}`);

/** Rough spend for one launch. Upper bound: GPT only runs on people who pass the ICP filter, and Apify only charges for people with a live email. */
export function estimateCost(provider: LeadProvider, leads: number) {
  const r = COST_RATES;
  const search = provider === "apify" ? leads * r.apifyPerLead : 0;
  const credits = provider === "ai-ark" ? leads * r.aiArkCreditsPerLead : 0;
  const ai = leads * r.gptQualifyPerLead;
  const replies = Math.max(1, Math.round(leads * r.expectedReplyRate));
  const replyCost = replies * r.gptPerReply;
  return { search, credits, ai, replies, replyCost, total: search + ai + replyCost };
}

/** One line for the Launch button bar. */
export function costLabel(provider: LeadProvider, leads: number) {
  const { total, credits } = estimateCost(provider, leads);
  return `~${usd(total)}${credits ? ` + ${credits.toLocaleString()} credits` : ""}`;
}

export function CostEstimate({ provider, leads }: { provider: LeadProvider; leads: number }) {
  const r = COST_RATES;
  const { search, credits, ai, replies, replyCost, total } = estimateCost(provider, leads);
  const per1000 = (provider === "apify" ? r.apifyPerLead : 0) * 1000 + r.gptQualifyPerLead * 1000 + r.expectedReplyRate * 1000 * r.gptPerReply;

  const rows: [string, string, string][] = [
    [
      provider === "apify" ? "Finding people (Apify)" : "Finding people (AI Ark)",
      provider === "apify" ? `${leads} × $${r.apifyPerLead.toFixed(4)}` : `${leads} × ${r.aiArkCreditsPerLead} credits`,
      provider === "apify" ? usd(search) : `${credits.toLocaleString()} credits`,
    ],
    ["AI check, site audit and 4 emails (GPT-4o)", `up to ${leads} × $${r.gptQualifyPerLead.toFixed(3)}`, usd(ai)],
    ["AI answers to replies", `~${replies} ${replies === 1 ? "reply" : "replies"} × $${r.gptPerReply.toFixed(2)}`, usd(replyCost)],
  ];

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
        <span className="flex items-center gap-2 text-[13px] font-medium">
          <Calculator className="size-4 text-emerald" /> Estimated cost for this launch
        </span>
        <span className="font-metric text-sm font-semibold text-emerald">
          ~{usd(total)}
          {credits ? ` + ${credits.toLocaleString()} credits` : ""}
        </span>
      </div>
      <table className="w-full text-[12px]">
        <tbody>
          {rows.map(([what, how, cost]) => (
            <tr key={what} className="border-b border-border/60 last:border-0">
              <td className="px-3 py-1.5 text-foreground">{what}</td>
              <td className="hidden px-3 py-1.5 text-muted-foreground sm:table-cell">{how}</td>
              <td className="font-metric px-3 py-1.5 text-right">{cost}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
        About {usd(per1000)} per 1,000 leads{provider === "ai-ark" ? ` plus ${(r.aiArkCreditsPerLead * 1000).toLocaleString()} AI Ark credits` : ""}. This is the most it
        should cost: people who fail the filters are not sent to the AI, and Apify does not charge for people without a live email. Sending the emails costs nothing
        extra; Smartlead and the mailboxes are fixed monthly plans.
      </p>
    </div>
  );
}
