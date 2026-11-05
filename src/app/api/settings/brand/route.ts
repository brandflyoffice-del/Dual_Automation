import { NextResponse } from "next/server";
import { z } from "zod";
import { getSetting, resetSetting, setSetting } from "@/lib/settings";
import { DEFAULT_BRAND } from "@/lib/settings-shared";

export const dynamic = "force-dynamic";

const MAX_LOGO_CHARS = 700_000; // ~500 KB image as a data URL

export async function GET() {
  const s = await getSetting("brand");
  return NextResponse.json({ ...s.value, custom: s.custom, updatedAt: s.updatedAt });
}

const body = z.union([
  z.object({ reset: z.literal(true) }),
  z.object({
    name: z.string().trim().min(2).max(40),
    logo: z
      .string()
      .max(MAX_LOGO_CHARS)
      .regex(/^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/)
      .nullable(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  }),
]);

export async function PUT(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Use a PNG, JPG, WebP or SVG under 500 KB, and a name of 2–40 characters" }, { status: 400 });
  if ("reset" in parsed.data) {
    await resetSetting("brand");
    return NextResponse.json({ ...DEFAULT_BRAND, custom: false, updatedAt: null });
  }
  const row = await setSetting("brand", parsed.data);
  return NextResponse.json({ ...parsed.data, custom: true, updatedAt: row.updatedAt });
}
