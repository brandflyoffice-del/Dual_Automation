import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Changes on every deploy (the dashboard container restarts), so an open tab can tell it is running old code.
const STARTED = String(Date.now());

export async function GET() {
  return NextResponse.json({ version: STARTED }, { headers: { "cache-control": "no-store" } });
}
