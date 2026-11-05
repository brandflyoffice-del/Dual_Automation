import { NextResponse } from "next/server";
import { syncFromSmartlead } from "@/lib/mailboxes";
import { dropMailboxCache } from "@/lib/mailer";
import { refreshMailboxWatch } from "@/lib/mailbox-watch";
import { smartleadConfigured } from "@/lib/smartlead";

export const dynamic = "force-dynamic";

/** Imports every SMTP/IMAP mailbox connected in Smartlead, so it is used for answers and watched for replies. */
export async function POST() {
  if (!smartleadConfigured()) return NextResponse.json({ error: "Smartlead is not connected" }, { status: 503 });
  try {
    const r = await syncFromSmartlead();
    dropMailboxCache();
    refreshMailboxWatch();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
