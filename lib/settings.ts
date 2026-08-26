import { supabaseAdmin } from "./supabase";

export type Settings = {
  resto_name: string;
  address: string;
  phone: string | null;
  hours: string;
  instagram: string;
  goal: number;
  offer_text: string | null;
  offer_at: string | null;
  // --- Avis Google (relance auto post-visite) ---
  review_enabled: boolean;
  review_url: string | null;
  review_delay_min: number;
  review_max_nudges: number;
  review_nudge_text: string | null;
};

// Message par défaut de la relance avis (si review_nudge_text est vide).
export const DEFAULT_REVIEW_TEXT =
  "On espère que vous vous êtes régalé ! 🍕 Un avis ⭐️ nous aiderait énormément — le lien est au dos de votre carte. Grazie mille !";

export const DEFAULT_SETTINGS: Settings = {
  resto_name: "Pizzeria Esempio",
  address: "1 rue de l'Exemple\n33000 Bordeaux",
  phone: null,
  hours: "Mar–Sam · 11h–14h · 18h–22h (22h30 ven-sam)\nDim · 18h–22h30 · Fermé le lundi",
  instagram: "https://www.instagram.com/pizzeria-esempio/",
  goal: 10,
  offer_text: null,
  offer_at: null,
  review_enabled: false,
  review_url: null,
  review_delay_min: 17,
  review_max_nudges: 1,
  review_nudge_text: null,
};

// Lit la ligne de réglages. Renvoie les defaults si la table n'existe pas encore
// (avant migration) ou en cas d'erreur — le site ne casse jamais.
export async function getSettings(): Promise<Settings> {
  try {
    const db = supabaseAdmin();
    const { data, error } = await db.from("settings").select("*").eq("id", 1).single();
    if (error || !data) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...data };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function updateSettings(patch: Partial<Settings>): Promise<boolean> {
  try {
    const db = supabaseAdmin();
    const { error } = await db.from("settings").update(patch).eq("id", 1);
    return !error;
  } catch {
    return false;
  }
}
