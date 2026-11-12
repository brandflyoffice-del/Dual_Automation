import { NextResponse } from "next/server";
import { z } from "zod";
import { integrationStatus, saveIntegrations, testIntegration } from "@/lib/integrations";
import { INTEGRATION_FIELDS, INTEGRATION_KEYS, type IntegrationKey } from "@/lib/integrations-shared";

export const dynamic = "force-dynamic";

/** Settings > Integrations: where each key comes from and its last 4 characters (never the key itself). */
export async function GET() {
  return NextResponse.json({ integrations: await integrationStatus() });
}

const body = z.object({
  values: z.record(z.string(), z.string().max(400).nullable()),
});

/** Saves keys. A secret key is tested first (when the service has a free check) and refused if the service rejects it. */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const patch: Partial<Record<IntegrationKey, string | null>> = {};
  for (const [k, v] of Object.entries(parsed.data.values)) {
    if (!INTEGRATION_KEYS.includes(k as IntegrationKey)) continue;
    const key = k as IntegrationKey;
    const val = v?.trim() ?? "";
    if (val && /\s/.test(val)) return NextResponse.json({ error: `${label(key)}: a key has no spaces. Copy it again.` }, { status: 400 });
    if (val && INTEGRATION_FIELDS.find((f) => f.key === key)?.testable) {
      const t = await testIntegration(key, val);
      if (!t.ok) return NextResponse.json({ error: `${label(key)} not saved: ${t.detail}.` }, { status: 400 });
    }
    patch[key] = val || null;
  }
  await saveIntegrations(patch);
  return NextResponse.json({ ok: true, integrations: await integrationStatus() });
}

const label = (k: IntegrationKey) => INTEGRATION_FIELDS.find((f) => f.key === k)?.label ?? k;
