import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

// Le front (page /added) poll cet endpoint : registered=true dès que la carte
// a été ajoutée au Wallet (l'appareil s'est enregistré).
export async function GET(_req: Request, ctx: { params: Promise<{ serial: string }> }) {
  const { serial } = await ctx.params;
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
