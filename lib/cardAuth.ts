import { supabaseAdmin } from "./supabase";
import type { Member } from "./supabase";

// Ancien jeton Wallet : serial complété de zéros. DEVINABLE car le serial est
// public (QR, dashboard, CSV). On le garde accepté UNIQUEMENT tant que la carte
// n'a pas basculé sur son jeton secret (token_rotated) — pour ne casser aucune
// carte déjà installée. Une fois basculée, l'ancien jeton est refusé => trou fermé.
export function legacyToken(serial: string): string {
  return serial.padEnd(16, "0");
}

function bearer(authHeader: string | null): string {
  return (authHeader || "").replace(/^ApplePass\s+/i, "").trim();
}

// Charge le membre par serial et valide le jeton "ApplePass <token>".
// Retourne le membre si autorisé, sinon null. Gère la rotation douce vers le
// jeton secret et reste compatible avant migration (colonne auth_token absente).
export async function authorizeCard(
  serial: string,
  authHeader: string | null
): Promise<Member | null> {
  const provided = bearer(authHeader);
  if (!provided) return null;

  const db = supabaseAdmin();
  const { data: member } = await db.from("members").select("*").eq("serial", serial).single();
  if (!member) return null;

  const secret = member.auth_token;
  const rotated = member.token_rotated;

  // 1) jeton secret correct -> OK. On verrouille la rotation : dès lors l'ancien
  //    jeton n'est plus accepté pour cette carte.
  if (secret && provided === secret) {
    if (!rotated) {
      const { error } = await db
        .from("members")
        .update({ token_rotated: true })
        .eq("serial", serial);
      if (error) {
        /* colonne token_rotated absente (avant migration) — non bloquant */
      }
    }
    return member as Member;
  }

  // 2) ancien jeton accepté tant que la carte n'a pas basculé (transition), OU
  //    si la colonne auth_token n'existe pas encore (secret absent avant migration).
  if (!rotated && provided === legacyToken(serial)) {
    return member as Member;
  }

  return null;
}
