import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, type Member } from "@/lib/supabase";
import { missingGoogleWalletEnv, prepareSave } from "@/lib/googleWallet";
import { verifyCardKey } from "@/lib/linkSign";
import { baseUrl } from "@/lib/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// "Add to Google Wallet": same member, same QR code and same stamp balance as
// the Apple card. Records the Google object id on the member, writes the
// current state to Google (best-effort), then redirects to a freshly signed
// save link — generated at click time so the card never starts out stale.
export async function GET(req: NextRequest, ctx: { params: Promise<{ serial: string }> }) {
  const { serial } = await ctx.params;
  if (!(await verifyCardKey(serial, req.nextUrl.searchParams.get("k")))) {
    return NextResponse.json({ error: "Invalid or expired link." }, { status: 403 });
  }

  const missing = missingGoogleWalletEnv();
  if (missing.length) {
    console.error("[GOOGLE-WALLET] not configured, missing:", missing.join(", "));
    return NextResponse.json(
      { error: "Google Wallet is not available yet. Please ask the staff." },
      { status: 503 }
    );
  }

  const db = supabaseAdmin();
  const { data: member } = await db.from("members").select("*").eq("serial", serial).single();
  if (!member) {
    return NextResponse.json({ error: "Loyalty card not found." }, { status: 404 });
  }

  try {
    const base = await baseUrl();
    const { url, objectId } = await prepareSave(member as Member, base);
    if (member.google_object_id !== objectId) {
      // From now on every stamp change is mirrored to this Google object.
      await db.from("members").update({ google_object_id: objectId }).eq("id", member.id);
    }
    return NextResponse.redirect(url, 302);
  } catch (err) {
    console.error("[GOOGLE-WALLET] save link failed", serial, err);
    return NextResponse.json(
      { error: "Sorry, we couldn't create your Google Wallet pass. Please try again." },
      { status: 500 }
    );
  }
}
