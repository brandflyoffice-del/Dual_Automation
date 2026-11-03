import { NextResponse } from "next/server";
import { getThread } from "@/lib/inbox";

export const dynamic = "force-dynamic";

// The whole conversation with one prospect in one campaign: Smartlead's history merged with our own events.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const campaignId = url.searchParams.get("campaignId") ?? "";
  const email = (url.searchParams.get("email") ?? "").trim().toLowerCase();
  if (!/^\d+$/.test(campaignId) || !email.includes("@")) return NextResponse.json({ error: "campaignId and email are required" }, { status: 400 });
  try {
    const { leadId, dbLeadId, messages, reply } = await getThread(campaignId, email);
    if (!leadId && !dbLeadId) return NextResponse.json({ error: "This prospect is no longer in Smartlead", messages: [] }, { status: 404 });
    return NextResponse.json({ messages, canReply: !!reply });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, messages: [] }, { status: 502 });
  }
}
