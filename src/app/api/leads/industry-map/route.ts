import { NextResponse } from "next/server";
import { z } from "zod";
import { mapIndustries } from "@/lib/industry-map";

export const dynamic = "force-dynamic";

const schema = z.object({ industries: z.array(z.string().trim().min(2).max(60)).min(1).max(20) });

/**
 * Launch form: an industry the person typed that the built-in rules do not know ("Pest Control", "Barber Shops"…) is
 * matched to a LinkedIn industry by AI (from a checked list), so the search understands any industry that is typed.
 */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Send the industries as a list of words" }, { status: 400 });
  return NextResponse.json(await mapIndustries(parsed.data.industries));
}
