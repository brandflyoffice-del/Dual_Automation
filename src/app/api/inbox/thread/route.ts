import { NextResponse } from "next/server";
import { getThread } from "@/lib/inbox";

export const dynamic = "force-dynamic";

// The whole email thread for one prospect in one campaign, straight from Smartlead's message history.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const campaignId = url.searchParams.get("campaignId") ?? "";
  const email = (url.searchParams.get("email") ?? "").trim().toLowerCase();
  if (!/^\d+$/.test(campaignId) || !email.includes("@")) return NextResponse.json({ error: "campaignId and email are required" }, { status: 400 });
  try {
    const { leadId, messages } = await getThread(campaignId, email);
    if (!leadId) return NextResponse.json({ error: "This prospect is no longer in Smartlead", messages: [] }, { status: 404 });
    return NextResponse.json({ messages, canReply: messages.some((m) => m.type === "REPLY") });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, messages: [] }, { status: 502 });
  }
}
