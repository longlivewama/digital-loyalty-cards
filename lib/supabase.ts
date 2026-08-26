import { createClient } from "@supabase/supabase-js";

// Client serveur (clé service_role — JAMAIS exposée au navigateur).
// Utilisé uniquement dans les routes/actions serveur.
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants");
  return createClient(url, key, { auth: { persistSession: false } });
}

export type Member = {
  id: string;
  serial: string;
  name: string;
  points: number;
  total_earned: number;
  phone: string | null;
  created_at: string;
  updated_at?: string | null;
  registered_at?: string | null;
  push_msg?: string | null;
  push_msg_at?: string | null;
  push_token?: string | null;
  auth_token?: string | null;
  token_rotated?: boolean | null;
  review_prompted_at?: string | null;
  reviewed_at?: string | null;
  review_nudges?: number | null;
};
