import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** The logo uploaded in Settings, or the built-in BrandFly logo. */
export async function GET() {
  const { value } = await getSetting("brand");
  const m = value.logo?.match(/^data:(image\/(?:png|jpeg|webp|svg\+xml));base64,(.+)$/);
  // Relative Location: behind Caddy, req.url is the container's own address (https://localhost:3400), not the public host.
  if (!m) return new NextResponse(null, { status: 307, headers: { location: "/brand/brandfly.png", "cache-control": "no-cache" } });
  return new NextResponse(Buffer.from(m[2], "base64"), {
    headers: {
      "content-type": m[1],
      "cache-control": "no-cache",
      // An uploaded SVG must never run script if someone opens this URL directly.
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
      "x-content-type-options": "nosniff",
    },
  });
}
