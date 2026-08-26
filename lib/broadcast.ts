import { supabaseAdmin } from "./supabase";
import { pushPassUpdate } from "./apns";
import { getSettings } from "./settings";
import { cycle, rewardsAvailable } from "./loyalty";

export type Segment = "all" | "inactive" | "reward" | "near";

export const SEGMENT_LABELS: Record<Segment, string> = {
  all: "Tous les clients actifs",
  inactive: "Inactifs depuis 30 jours",
  reward: "Récompense disponible",
  near: "Proches du palier (≤2)",
};

type Row = { id: string; push_token: string | null; points: number | null; created_at: string };

// Sélectionne les membres cibles d'un segment (uniquement ceux avec une carte active).
export async function targets(segment: Segment): Promise<Row[]> {
  const db = supabaseAdmin();
  const { goal } = await getSettings();
  const { data } = await db
    .from("members")
    .select("id,push_token,points,created_at,registered_at")
    .not("push_token", "is", null);
  let rows = (data ?? []).filter((m) => m.registered_at) as Row[];

  if (segment === "reward") {
    rows = rows.filter((m) => rewardsAvailable(m.points ?? 0, goal) > 0);
  } else if (segment === "near") {
    rows = rows.filter((m) => {
      const c = cycle(m.points ?? 0, goal);
      return c >= goal - 2 && c !== 0;
    });
  } else if (segment === "inactive") {
    rows = await filterInactive(rows);
  }
  return rows;
}

// "Inactif" = aucune vraie visite (tampon 'add') depuis 30 jours ET inscrit
// depuis plus de 30 jours. On se base sur les événements de VISITE, jamais sur
// updated_at (qui bouge à chaque notif/sync de carte et fausserait tout : un
// broadcast remettrait tout le monde "actif" pendant 30 jours).
async function filterInactive(rows: Row[]): Promise<Row[]> {
  const ids = rows.map((r) => r.id);
  if (!ids.length) return [];
  const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const db = supabaseAdmin();
  const { data: recent, error } = await db
    .from("events")
    .select("member_id")
    .eq("type", "add")
    .gte("created_at", cutoff.toISOString())
    .in("member_id", ids);
  // En cas d'erreur (table events absente / souci réseau) on ne relance
  // personne : mieux vaut 0 que spammer tout le monde par erreur.
  if (error) return [];
  const activeIds = new Set((recent ?? []).map((e) => e.member_id));
  return rows.filter((r) => !activeIds.has(r.id) && new Date(r.created_at) < cutoff);
}

// Compte une cible sans envoyer (pour l'aperçu UI).
export async function countTargets(segment: Segment): Promise<number> {
  return (await targets(segment)).length;
}

// Envoie une notif ciblée à un segment.
// Le message est écrit SUR CHAQUE carte ciblée (member.push_msg) — le champ
// "Offre du moment" existe en permanence sur la carte, donc ce changement de
// valeur déclenche une notif lock-screen FIABLE. Seuls les clients ciblés sont
// touchés (aucune fuite vers les autres).
export async function broadcast(message: string, segment: Segment): Promise<number> {
  const db = supabaseAdmin();
  const msg = message.trim().slice(0, 120);
  if (!msg) return 0;

  // 1) cibles selon le filtre
  const rows = await targets(segment);
  const ids = rows.map((r) => r.id);
  const now = new Date().toISOString();

  // 2) écrit le message par client + bump updated_at (sinon If-Modified-Since → 304)
  if (ids.length) {
    const { error } = await db
      .from("members")
      .update({ push_msg: msg, push_msg_at: now, updated_at: now })
      .in("id", ids);
    if (error) {
      // colonne push_msg absente (migration non lancée) — fallback : bump seul
      await db.from("members").update({ updated_at: now }).in("id", ids);
    }
  }

  // 3) push APNs (par lots pour limiter la charge)
  let sent = 0;
  const deadIds: string[] = []; // tokens morts (carte supprimée / appareil effacé)
  const BATCH = 10;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const res = await Promise.all(
      slice.map((r) => (r.push_token ? pushPassUpdate(r.push_token) : Promise.resolve(0)))
    );
    res.forEach((s, j) => {
      if (s === 200) sent++;
      // 410 = Unregistered, 400 = BadDeviceToken → token définitivement invalide
      else if (s === 410 || s === 400) deadIds.push(slice[j].id);
    });
  }

  // 3b) nettoie les tokens morts : la carte n'existe plus sur l'appareil.
  // Garde le compteur "Cartes actives" et la portée des notifs honnêtes.
  if (deadIds.length) {
    await db
      .from("members")
      .update({ push_token: null, registered_at: null, device_lib_id: null })
      .in("id", deadIds);
    console.log(`[BROADCAST] ${deadIds.length} token(s) mort(s) nettoyé(s)`);
  }

  // 4) historique campagne (best-effort)
  try {
    await db.from("campaigns").insert({ message: msg, segment, sent_count: sent });
  } catch {
    /* table absente avant migration */
  }
  return sent;
}

// Rafraîchit SILENCIEUSEMENT toutes les cartes actives après un changement de
// réglages (adresse, horaires, lien d'avis…). On bump updated_at — sinon la
// carte renvoie 304 "rien de neuf" — puis push APNs pour que l'iPhone
// re-télécharge. Aucun push_msg modifié => pas de notif lock-screen (discret).
export async function refreshActiveCards(): Promise<number> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("members")
    .select("id,push_token,registered_at")
    .not("push_token", "is", null);
  const rows = (data ?? []).filter((m) => m.registered_at) as { id: string; push_token: string }[];
  if (!rows.length) return 0;

  const now = new Date().toISOString();
  await db.from("members").update({ updated_at: now }).in("id", rows.map((r) => r.id));

  let sent = 0;
  const deadIds: string[] = [];
  const BATCH = 10;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const res = await Promise.all(slice.map((r) => pushPassUpdate(r.push_token)));
    res.forEach((st, j) => {
      if (st === 200) sent++;
      else if (st === 410 || st === 400) deadIds.push(slice[j].id);
    });
  }
  if (deadIds.length) {
    await db
      .from("members")
      .update({ push_token: null, registered_at: null, device_lib_id: null })
      .in("id", deadIds);
  }
  console.log(`[REFRESH-CARDS] rafraîchies=${sent} mortes=${deadIds.length}`);
  return sent;
}

export async function campaignHistory(limit = 20) {
  try {
    const db = supabaseAdmin();
    const { data } = await db
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    return data ?? [];
  } catch {
    return [];
  }
}
