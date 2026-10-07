import { createClient } from "@supabase/supabase-js";

// Server client (service_role key — NEVER exposed to the browser).
// Used only in server routes/actions.
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

export type Member = {
  id: string;
  serial: string;
  name: string;
  last_name?: string | null;
  birthday?: string | null;
  note?: string | null;
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
  device_lib_id?: string | null;
  // Google Wallet loyalty object id (set once the customer asks for the card).
  google_object_id?: string | null;
};
