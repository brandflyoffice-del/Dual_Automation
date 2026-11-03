import { NextResponse, type NextRequest } from "next/server";
import { authRequired, SESSION_COOKIE, verifySession } from "@/lib/auth";

// Pages and APIs that work without a dashboard login.
const PUBLIC = [/^\/login$/, /^\/api\/auth\//, /^\/r\//, /^\/privacy$/, /^\/terms$/, /^\/api\/brand\/logo$/, /^\/brand\//, /^\/api\/webhooks\/n8n$/, /^\/api\/mail\/send$/, /^\/api\/health$/];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (!authRequired() || PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Static files never need a session.
  matcher: ["/((?!_next/static|_next/image|icon.png|apple-icon.png|favicon.ico).*)"],
};
