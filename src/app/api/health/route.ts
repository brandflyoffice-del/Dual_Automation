import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Container health check (Dockerfile HEALTHCHECK). Public on purpose and returns nothing about the system.
export function GET() {
  return NextResponse.json({ ok: true });
}
