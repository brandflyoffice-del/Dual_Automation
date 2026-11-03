import { NextResponse } from "next/server";
import { z } from "zod";
import { authConfigured, checkCredentials, createSession, SESSION_COOKIE, SESSION_HOURS } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({ user: z.string().trim().min(1).max(120), password: z.string().min(1).max(200), remember: z.boolean().optional() });

// Simple brute-force brake per client address: 8 failed tries per 15 minutes.
const WINDOW = 15 * 60_000;
const MAX_FAILS = 8;
const fails = new Map<string, number[]>();

function clientKey(req: Request) {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

export async function POST(req: Request) {
  if (!authConfigured()) return NextResponse.json({ error: "Login is not configured on this server." }, { status: 503 });
  const key = clientKey(req);
  const now = Date.now();
  const recent = (fails.get(key) || []).filter((t) => now - t < WINDOW);
  if (recent.length >= MAX_FAILS) {
    const wait = Math.ceil((WINDOW - (now - recent[0])) / 60_000);
    return NextResponse.json({ error: `Too many attempts. Try again in ${wait} minute${wait === 1 ? "" : "s"}.` }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !(await checkCredentials(parsed.data.user, parsed.data.password))) {
    fails.set(key, [...recent, now]);
    return NextResponse.json({ error: "Wrong username or password." }, { status: 401 });
  }
  fails.delete(key);
  const hours = parsed.data.remember ? SESSION_HOURS.long : SESSION_HOURS.short;
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSession(parsed.data.user.toLowerCase(), hours), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: hours * 3600,
  });
  return res;
}
