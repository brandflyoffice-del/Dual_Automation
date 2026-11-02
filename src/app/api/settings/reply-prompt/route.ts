import { NextResponse } from "next/server";
import { z } from "zod";
import { DEFAULT_REPLY_PROMPT, getSetting, resetSetting, setSetting } from "@/lib/settings";
import { PRICE_RE, REQUIRED_OUTPUT_KEYS } from "@/lib/settings-shared";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSetting("reply_prompt");
  return NextResponse.json({ ...s.value, custom: s.custom, updatedAt: s.updatedAt, defaults: DEFAULT_REPLY_PROMPT });
}

const body = z.union([
  z.object({ reset: z.literal(true) }),
  z.object({ prompt: z.string().min(800).max(40_000), startingPrice: z.string().trim() }),
]);

export async function PUT(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "The prompt is too short or the request is malformed" }, { status: 400 });
  if ("reset" in parsed.data) {
    await resetSetting("reply_prompt");
    return NextResponse.json({ ...DEFAULT_REPLY_PROMPT, custom: false, updatedAt: null, defaults: DEFAULT_REPLY_PROMPT });
  }
  const { prompt, startingPrice } = parsed.data;
  if (!PRICE_RE.test(startingPrice)) return NextResponse.json({ error: "Starting price must look like $100 or $1,500" }, { status: 400 });
  // The workflow parses the AI answer as JSON with these keys; without them every reply would be held for a human.
  const missing = REQUIRED_OUTPUT_KEYS.filter((k) => !prompt.includes(`"${k}"`));
  if (missing.length) return NextResponse.json({ error: `The OUTPUT section must still list: ${missing.join(", ")}` }, { status: 400 });
  const row = await setSetting("reply_prompt", { prompt: prompt.replace(/\r\n/g, "\n"), startingPrice });
  return NextResponse.json({ prompt, startingPrice, custom: true, updatedAt: row.updatedAt, defaults: DEFAULT_REPLY_PROMPT });
}
