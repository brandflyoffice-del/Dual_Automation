import { NextResponse } from "next/server";
import { config, n8nWebhooks } from "@/lib/config";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type N8nState = "not_configured" | "unreachable" | "workflow_inactive" | "live";

/**
 * Honest connectivity probe:
 *  - /healthz tells us n8n itself is up
 *  - an UNSIGNED POST to the control webhook tells us whether the Fenebris workflow is imported + active
 *    (active workflow answers 401 because the secret is missing; inactive/missing answers 404)
 */
export async function GET() {
  let n8n: N8nState = "not_configured";
  let detail = "Set N8N_BASE_URL in .env";

  if (config.n8nBase) {
    try {
      const health = await fetch(`${config.n8nBase}/healthz`, { signal: AbortSignal.timeout(4000), cache: "no-store" });
      if (!health.ok) {
        n8n = "unreachable";
        detail = `n8n /healthz returned ${health.status}`;
      } else {
        const probe = await fetch(`${config.n8nBase}${n8nWebhooks.leadControl}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
          signal: AbortSignal.timeout(6000),
          cache: "no-store",
        });
        if (probe.status === 404) {
          n8n = "workflow_inactive";
          detail = "n8n is up but the BrandFly workflow is not active";
        } else {
          n8n = "live";
          detail = "BrandFly workflow is active";
        }
      }
    } catch (e) {
      n8n = "unreachable";
      detail = `Could not reach n8n: ${(e as Error).message}`;
    }
  }

  let lastEventAt: string | null = null;
  let dbOk = true;
  try {
    const last = await db.emailEvent.findFirst({ orderBy: { occurredAt: "desc" }, select: { occurredAt: true } });
    lastEventAt = last?.occurredAt.toISOString() ?? null;
  } catch {
    dbOk = false;
  }

  return NextResponse.json({ n8n, detail, db: dbOk, lastEventAt });
}
