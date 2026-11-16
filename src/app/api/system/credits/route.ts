import { NextResponse } from "next/server";
import { serviceHealth } from "@/lib/service-health";

export const dynamic = "force-dynamic";

/** Credit and key status of the paid services (OpenAI, Apify, Smartlead, Cal.com). ?refresh=1 checks now. */
export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  return NextResponse.json(await serviceHealth(force));
}
