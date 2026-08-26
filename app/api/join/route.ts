import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { logEvent } from "@/lib/events";

export const runtime = "nodejs";

// Inscription : crée un membre puis renvoie vers le téléchargement de sa carte.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const name = (form.get("name") as string | null)?.trim() || "Client";
  const lastName = (form.get("last_name") as string | null)?.trim() || null;
  const birthday = (form.get("birthday") as string | null)?.trim() || null; // "YYYY-MM-DD"
  const phone = (form.get("phone") as string | null)?.trim() || null;

  const serial = crypto.randomUUID().split("-")[0].toUpperCase(); // ex: 3FA2C9B1
  const authToken = crypto.randomUUID(); // jeton secret de la carte (non devinable)

  const db = supabaseAdmin();
  const base = { name, serial, points: 0, total_earned: 0, phone };

  // Essai complet (avec nom + date de naissance + jeton secret) ; fallback si
  // colonnes absentes (migrations non lancées) — non bloquant.
  // token_rotated=true : la carte naît avec le jeton secret, l'ancien jeton
  // (serial padé) n'a jamais à être accepté pour elle.
  let { data, error } = await db
    .from("members")
    .insert({ ...base, last_name: lastName, birthday, auth_token: authToken, token_rotated: true })
    .select()
    .single();
  if (error) {
    ({ data, error } = await db.from("members").insert(base).select().single());
  }

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "insert failed" }, { status: 500 });
  }

  await logEvent(data.id, "signup", 0);

  // 303 -> page de confirmation (qui déclenche le téléchargement)
  return NextResponse.redirect(new URL(`/added/${data.serial}`, req.url), 303);
}
