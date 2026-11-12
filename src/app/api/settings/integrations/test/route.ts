import { NextResponse } from "next/server";
import { z } from "zod";
import { testIntegration } from "@/lib/integrations";
import { INTEGRATION_KEYS, type IntegrationKey } from "@/lib/integrations-shared";

export const dynamic = "force-dynamic";

const body = z.object({ key: z.string(), value: z.string().max(400).optional() });

/** Checks the active key (or a pasted one) against its service with a free read-only call. */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !INTEGRATION_KEYS.includes(parsed.data.key as IntegrationKey)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  return NextResponse.json(await testIntegration(parsed.data.key as IntegrationKey, parsed.data.value || undefined));
}
