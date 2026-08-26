import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { generatePkpass } from "@/lib/pass";
import { baseUrl } from "@/lib/url";

export const runtime = "nodejs";

// Génère et sert le .pkpass signé pour un membre (ouvre dans Apple Wallet).
export async function GET(req: NextRequest, ctx: { params: Promise<{ serial: string }> }) {
  const { serial } = await ctx.params;

  const db = supabaseAdmin();
  const { data: member, error } = await db
    .from("members")
    .select("*")
    .eq("serial", serial)
    .single();

  if (error || !member) {
    return NextResponse.json({ error: "membre introuvable" }, { status: 404 });
  }

  const base = await baseUrl();
  const buffer = await generatePkpass(member, base);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.apple.pkpass",
      "Content-Disposition": `attachment; filename="esempio-${serial}.pkpass"`,
      "Cache-Control": "no-store",
    },
  });
}
