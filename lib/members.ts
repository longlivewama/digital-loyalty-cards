import { supabaseAdmin } from "./supabase";
import { pushPassUpdate } from "./apns";
import { getSettings } from "./settings";
import { logEvent } from "./events";

const now = () => new Date().toISOString();

// Pousse la MAJ de la carte vers l'iPhone du client.
// À lancer EN ARRIÈRE-PLAN (after()) : pas besoin de faire attendre le commerçant
// la réponse d'Apple. La MAJ `updated_at` est déjà faite dans la mutation.
export async function pushUpdate(id: string) {
  const db = supabaseAdmin();
  const { data } = await db.from("members").select("push_token").eq("id", id).single();
  if (!data?.push_token) return;
  const timeout = new Promise<number>((r) => setTimeout(() => r(-9), 5000));
  const status = await Promise.race([pushPassUpdate(data.push_token), timeout]);
  // 410 = Unregistered, 400 = BadDeviceToken → token mort : on le purge.
  if (status === 410 || status === 400) {
    await db
      .from("members")
      .update({ push_token: null, registered_at: null, device_lib_id: null })
      .eq("id", id);
  }
}

// Les mutations écrivent en base (incl. updated_at) et renvoient le nouveau total
// de points (pour l'affichage instantané côté commerçant). Elles ne poussent PAS :
// la notif part après, via pushUpdate() dans le after() de la route.

// Repli non-atomique (utilisé seulement si la fonction SQL change_points n'existe
// pas encore — avant la migration). Read-modify-write : peut perdre un tampon en
// cas de double-scan simultané, mais garde l'app fonctionnelle.
async function legacyChange(id: string, dPoints: number, dEarned: number): Promise<number | null> {
  const db = supabaseAdmin();
  const { data: m } = await db.from("members").select("points,total_earned").eq("id", id).single();
  if (!m) return null;
  const points = Math.max(0, (m.points ?? 0) + dPoints);
  await db
    .from("members")
    .update({ points, total_earned: Math.max(0, (m.total_earned ?? 0) + dEarned), updated_at: now() })
    .eq("id", id);
  return points;
}

// Ajout/retrait ATOMIQUE côté base (fonction change_points) : deux scans
// simultanés ne peuvent plus s'écraser l'un l'autre. Repli si fonction absente.
async function changePoints(id: string, dPoints: number, dEarned: number): Promise<number | null> {
  const db = supabaseAdmin();
  const { data, error } = await db.rpc("change_points", {
    p_id: id,
    p_delta: dPoints,
    p_earned: dEarned,
  });
  if (!error && data != null) return data as number;
  return legacyChange(id, dPoints, dEarned);
}

export async function addPoints(id: string, n: number): Promise<number | null> {
  const add = Math.max(1, Math.min(100, Math.floor(n || 1)));
  const points = await changePoints(id, add, add);
  if (points == null) return null;
  await logEvent(id, "add", add);
  return points;
}

export async function removePoint(id: string): Promise<number | null> {
  const points = await changePoints(id, -1, -1);
  if (points == null) return null;
  await logEvent(id, "remove", -1);
  return points;
}

export async function claimReward(id: string): Promise<number | null> {
  const { goal } = await getSettings();
  const db = supabaseAdmin();
  // Réclamation ATOMIQUE : la fonction ne soustrait le palier QUE si le solde
  // suffit (empêche la double-réclamation d'une même récompense).
  const { data, error } = await db.rpc("claim_reward", { p_id: id, p_goal: goal });
  if (!error && data != null) {
    await logEvent(id, "claim", -goal);
    return data as number;
  }
  if (!error && data == null) return null; // fonction OK mais solde insuffisant

  // Repli (fonction absente) : ancienne vérification non-atomique.
  const { data: m } = await db.from("members").select("points").eq("id", id).single();
  if (!m || (m.points ?? 0) < goal) return null;
  const points = (m.points ?? 0) - goal;
  await db.from("members").update({ points, updated_at: now() }).eq("id", id);
  await logEvent(id, "claim", -goal);
  return points;
}

export async function setNote(id: string, note: string) {
  try {
    const db = supabaseAdmin();
    await db.from("members").update({ note: note.slice(0, 500) }).eq("id", id);
  } catch {
    /* colonne note absente avant migration */
  }
}
