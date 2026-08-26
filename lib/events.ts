import { supabaseAdmin } from "./supabase";

export type EventType = "signup" | "add" | "remove" | "claim";

export type LoyaltyEvent = {
  id: number;
  member_id: string;
  type: EventType;
  delta: number;
  created_at: string;
};

// Enregistre une opération. Best-effort : si la table n'existe pas encore, on ignore.
export async function logEvent(memberId: string, type: EventType, delta = 0) {
  try {
    const db = supabaseAdmin();
    await db.from("events").insert({ member_id: memberId, type, delta });
  } catch {
    /* table absente avant migration — non bloquant */
  }
}

// Historique d'un client.
export async function memberHistory(memberId: string, limit = 20): Promise<LoyaltyEvent[]> {
  try {
    const db = supabaseAdmin();
    const { data } = await db
      .from("events")
      .select("*")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(limit);
    return data ?? [];
  } catch {
    return [];
  }
}

// Activité récente globale (avec nom du membre).
export async function recentActivity(limit = 12): Promise<(LoyaltyEvent & { name?: string })[]> {
  try {
    const db = supabaseAdmin();
    const { data } = await db
      .from("events")
      .select("*, members(name)")
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data ?? []).map((e: { members?: { name?: string } } & LoyaltyEvent) => ({
      ...e,
      name: e.members?.name,
    }));
  } catch {
    return [];
  }
}
