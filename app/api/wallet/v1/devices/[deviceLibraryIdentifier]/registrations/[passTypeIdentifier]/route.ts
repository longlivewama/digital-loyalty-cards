import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

// iOS demande la liste des cartes de cet appareil modifiées depuis `passesUpdatedSince`.
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ deviceLibraryIdentifier: string }> }
) {
  const { deviceLibraryIdentifier } = await ctx.params;
  // iOS envoie passesUpdatedSince avec un offset TZ "+00:00". Dans une query string,
  // "+" est décodé en ESPACE par URLSearchParams → timestamp corrompu → comparaison
  // cassée → 0 serial renvoyé → "spurious push" et la carte ne se met JAMAIS à jour.
  // On restaure le "+" (un timestamp ISO ne contient jamais d'espace réelle).
  const since = req.nextUrl.searchParams.get("passesUpdatedSince")?.replace(/ /g, "+");

  const db = supabaseAdmin();
  let q = db
    .from("members")
    .select("serial,updated_at")
    .eq("device_lib_id", deviceLibraryIdentifier);
  if (since) q = q.gt("updated_at", since);

  const { data } = await q;
  const rows = data ?? [];
  if (rows.length === 0) {
    return new NextResponse(null, { status: 204 });
  }

  const lastUpdated = rows
    .map((r) => r.updated_at)
    .sort()
    .at(-1)!;

  return NextResponse.json({
    lastUpdated,
    serialNumbers: rows.map((r) => r.serial),
  });
}
