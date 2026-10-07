import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { generatePkpass, missingAppleWalletEnv } from "@/lib/pass";
import { verifyCardKey } from "@/lib/linkSign";
import { baseUrl } from "@/lib/url";

export const runtime = "nodejs";

// Generates and serves the member's signed .pkpass (opens in Apple Wallet).
// Requires the signed key from the signup page (?k=…): the pass embeds the
// card's Wallet authentication token, so a serial alone must not be enough.
export async function GET(req: NextRequest, ctx: { params: Promise<{ serial: string }> }) {
  const { serial } = await ctx.params;
  if (!(await verifyCardKey(serial, req.nextUrl.searchParams.get("k")))) {
    return NextResponse.json({ error: "Invalid or expired link." }, { status: 403 });
  }

  const missing = missingAppleWalletEnv();
  if (missing.length) {
    console.error("[APPLE-WALLET] not configured, missing:", missing.join(", "));
    return NextResponse.json(
      { error: "Apple Wallet is not available yet. Please ask the staff." },
      { status: 503 }
    );
  }

  const db = supabaseAdmin();
  const { data: member, error } = await db
    .from("members")
    .select("*")
    .eq("serial", serial)
    .single();

  if (error || !member) {
    return NextResponse.json({ error: "Loyalty card not found." }, { status: 404 });
  }

  try {
    const base = await baseUrl();
    const buffer = await generatePkpass(member, base);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="coffee-loyalty-${serial}.pkpass"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[APPLE-WALLET] pass generation failed", serial, err);
    return NextResponse.json(
      { error: "Sorry, we couldn't create your Apple Wallet pass. Please try again." },
      { status: 500 }
    );
  }
}
