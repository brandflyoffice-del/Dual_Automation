import { NextResponse } from "next/server";
import { getConversations } from "@/lib/inbox";
import { smartleadConfigured } from "@/lib/smartlead";

export const dynamic = "force-dynamic";

// Every prospect Smartlead has emailed, newest activity first, joined with our AI intent and stage.
export async function GET() {
  if (!smartleadConfigured()) return NextResponse.json({ error: "Smartlead API key is not configured", conversations: [] }, { status: 503 });
  try {
    return NextResponse.json({ conversations: await getConversations() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, conversations: [] }, { status: 502 });
  }
}
