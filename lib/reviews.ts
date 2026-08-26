import { supabaseAdmin } from "./supabase";
import { pushPassUpdate } from "./apns";
import { getSettings, DEFAULT_REVIEW_TEXT } from "./settings";

// Fenêtre de rattrapage : on regarde les scans entre (délai) et (délai+GRACE)
// minutes dans le passé. GRACE large = si le planificateur a sauté des tics
// (Supabase down, etc.), on rattrape quand même. Les garde-fous par client
// (reviewed_at / review_nudges / cooldown) empêchent toute double relance.
const GRACE_MIN = 180; // 3 h
const COOLDOWN_DAYS = 14; // ne pas re-relancer un même client avant 14 j
const MAX_PER_RUN = 300; // plafond de sécurité par exécution

type Candidate = {
  id: string;
  push_token: string | null;
  reviewed_at: string | null;
  review_prompted_at: string | null;
  review_nudges: number | null;
};

// Cœur de la feature : trouve les clients scannés il y a ~review_delay_min,
// pas encore relancés (ou relançables), et leur pousse la notif "laisse un avis".
// Best-effort, ne throw jamais : renvoie un petit rapport.
export async function sendReviewNudges(): Promise<{
  sent: number;
  candidates: number;
  skipped: string;
}> {
  const s = await getSettings();
  if (!s.review_enabled || !s.review_url) {
    return { sent: 0, candidates: 0, skipped: "feature désactivée ou lien d'avis manquant" };
  }

  const db = supabaseAdmin();
  const delay = Math.max(0, s.review_delay_min || 17);
  const maxNudges = Math.max(1, s.review_max_nudges || 1);
  const nudgeText = (s.review_nudge_text?.trim() || DEFAULT_REVIEW_TEXT).slice(0, 120);

  const now = Date.now();
  const floor = new Date(now - (delay + GRACE_MIN) * 60_000).toISOString();
  const ceil = new Date(now - delay * 60_000).toISOString();
  const cooldownCut = now - COOLDOWN_DAYS * 24 * 3600 * 1000;

  // 1) qui a été scanné (+1) dans la fenêtre [delay+GRACE ; delay] min ?
  const { data: evs } = await db
    .from("events")
    .select("member_id")
    .eq("type", "add")
    .gte("created_at", floor)
    .lte("created_at", ceil);
  const ids = [...new Set((evs ?? []).map((e) => e.member_id))].filter(Boolean) as string[];
  if (!ids.length) return { sent: 0, candidates: 0, skipped: "aucun scan dans la fenêtre" };

  // 2) charge ces membres + leur état avis
  const { data: members } = await db
    .from("members")
    .select("id,push_token,reviewed_at,review_prompted_at,review_nudges")
    .in("id", ids);

  // 3) filtre : carte active, jamais cliqué, sous le plafond, hors cooldown
  const due = ((members ?? []) as Candidate[])
    .filter((m) => {
      if (!m.push_token) return false; // pas de carte joignable
      if (m.reviewed_at) return false; // a déjà cliqué → on ne relance plus jamais
      if ((m.review_nudges ?? 0) >= maxNudges) return false; // plafond atteint
      if (m.review_prompted_at && new Date(m.review_prompted_at).getTime() > cooldownCut)
        return false; // relancé trop récemment
      return true;
    })
    .slice(0, MAX_PER_RUN);

  if (!due.length) return { sent: 0, candidates: ids.length, skipped: "tous filtrés" };

  // 4) relance : on écrit le message (déclenche la notif lock-screen via le
  // champ avant "news") + push APNs, puis on horodate.
  const nowIso = new Date(now).toISOString();
  const deadIds: string[] = [];
  let sent = 0;

  for (const m of due) {
    // 1) écrit le message (porte la notif lock-screen via le champ avant) + bump
    //    updated_at. On NE consomme PAS encore la relance.
    await db
      .from("members")
      .update({ push_msg: nudgeText, push_msg_at: nowIso, updated_at: nowIso })
      .eq("id", m.id);

    // 2) push. On ne marque la relance comme "faite" (horodatage + compteur) que
    //    si elle est RÉELLEMENT livrée (200) : un push raté sera re-tenté au tic
    //    suivant au lieu de brûler l'unique relance du client.
    const status = await pushPassUpdate(m.push_token!);
    if (status === 200) {
      await db
        .from("members")
        .update({
          review_prompted_at: nowIso,
          review_nudges: (m.review_nudges ?? 0) + 1,
        })
        .eq("id", m.id);
      sent++;
    } else if (status === 410 || status === 400) {
      deadIds.push(m.id);
    }
  }

  // 5) purge des tokens morts (carte supprimée / appareil effacé)
  if (deadIds.length) {
    await db
      .from("members")
      .update({ push_token: null, registered_at: null, device_lib_id: null })
      .in("id", deadIds);
  }

  console.log(`[REVIEW-NUDGE] candidats=${ids.length} relancés=${sent} morts=${deadIds.length}`);
  return { sent, candidates: ids.length, skipped: "" };
}

// Le client a cliqué le lien d'avis (depuis la notif ou le dos de la carte).
// On l'horodate une seule fois → plus aucune relance ne lui sera envoyée.
export async function markReviewed(id: string): Promise<void> {
  try {
    const db = supabaseAdmin();
    await db
      .from("members")
      .update({ reviewed_at: new Date().toISOString() })
      .eq("id", id)
      .is("reviewed_at", null);
  } catch {
    /* colonne absente avant migration — non bloquant */
  }
}
