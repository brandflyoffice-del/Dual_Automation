import { NextResponse } from "next/server";
import { z } from "zod";
import { getSetting, setSetting } from "@/lib/settings";
import { EMAIL_RE } from "@/lib/settings-shared";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSetting("meeting_alerts");
  return NextResponse.json({ ...s.value, updatedAt: s.updatedAt });
}

const body = z.object({ emails: z.array(z.string().trim().toLowerCase().max(120)).max(10) });

export async function PUT(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Up to 10 email addresses" }, { status: 400 });
  const emails = [...new Set(parsed.data.emails.filter(Boolean))];
  const bad = emails.filter((e) => !EMAIL_RE.test(e));
  if (bad.length) return NextResponse.json({ error: `Not a valid email: ${bad.join(", ")}` }, { status: 400 });
  const row = await setSetting("meeting_alerts", { emails });
  return NextResponse.json({ emails, updatedAt: row.updatedAt });
}
