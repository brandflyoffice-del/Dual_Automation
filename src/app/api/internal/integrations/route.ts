import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { integrationValues } from "@/lib/integrations";

export const dynamic = "force-dynamic";

// Internal: the n8n workflow loads the active API keys here at the start of each run ("Keys: ..." nodes), over the
// Docker network (http://dashboard:3400). Caddy answers 404 for /api/internal/* from the internet, and the header
// x-fenebris-secret must match WEBHOOK_SECRET.
function authorized(req: Request) {
  if (!config.webhookSecret) return false;
  const got = Buffer.from(req.headers.get("x-fenebris-secret") ?? "");
  const want = Buffer.from(config.webhookSecret);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await integrationValues(), { headers: { "cache-control": "no-store" } });
}
