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
  // --- Google review nudge (automatic, after a visit) ---
  review_enabled: boolean;
  review_url: string | null;
  review_delay_min: number;
  review_max_nudges: number;
  review_nudge_text: string | null;
};

// Default review-nudge message (used when review_nudge_text is empty).
export const DEFAULT_REVIEW_TEXT =
  "We hope you enjoyed your coffee! ☕ A ⭐️ review would mean a lot to us — the link is on the back of your card. Thank you!";

export const DEFAULT_SETTINGS: Settings = {
  resto_name: "Coffee Shop",
  address: "1 Example Street\nYour City",
  phone: null,
  hours: "Mon–Fri · 7am–6pm\nSat–Sun · 8am–5pm",
  instagram: "https://www.instagram.com/",
  goal: 9,
  offer_text: null,
  offer_at: null,
  review_enabled: false,
  review_url: null,
  review_delay_min: 17,
  review_max_nudges: 1,
  review_nudge_text: null,
};

// Reads the settings row. Falls back to the defaults if the table does not
// exist yet (before migration) or on error — the site never breaks.
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
