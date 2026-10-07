import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyCardKey } from "@/lib/linkSign";

export const runtime = "nodejs";

// The /added page polls this endpoint: registered=true as soon as the card has
// been added to Apple Wallet (the device registered itself).
export async function GET(req: NextRequest, ctx: { params: Promise<{ serial: string }> }) {
  const { serial } = await ctx.params;
  if (!(await verifyCardKey(serial, req.nextUrl.searchParams.get("k")))) {
    return NextResponse.json({ error: "Invalid link." }, { status: 403 });
  }
  const db = supabaseAdmin();
  const { data } = await db
    .from("members")
    .select("registered_at")
    .eq("serial", serial)
    .single();

  return NextResponse.json(
    { registered: !!data?.registered_at },
    { headers: { "Cache-Control": "no-store" } }
  );
}
