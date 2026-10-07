import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { merchantSession } from "@/lib/linkSign";

export const runtime = "nodejs";

// Brute-force protection: after MAX_TRIES failed attempts within WINDOW, the IP
// is locked for LOCK. Counters live in the `login_attempts` table (Supabase), the
// only reliable shared storage in serverless (an in-memory variable would not
// survive between requests).
const MAX_TRIES = 5;
const WINDOW_MS = 15 * 60_000; // counting window: 15 min
const LOCK_MS = 15 * 60_000; // lock duration: 15 min

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

// IP actuellement bloquée ? (trop d'essais ratés récemment)
async function isLocked(ip: string): Promise<boolean> {
  try {
    const db = supabaseAdmin();
    const { data } = await db
      .from("login_attempts")
      .select("locked_until")
      .eq("ip", ip)
      .single();
    if (!data?.locked_until) return false;
    return new Date(data.locked_until).getTime() > Date.now();
  } catch {
    return false; // table absente / erreur → on ne bloque pas (fail-open)
  }
}

// Enregistre un essai raté ; pose un blocage si le seuil est atteint.
async function recordFailure(ip: string): Promise<void> {
  try {
    const db = supabaseAdmin();
    const now = Date.now();
    const { data } = await db
      .from("login_attempts")
      .select("count,first_at")
      .eq("ip", ip)
      .single();

    let count = 1;
    let firstAt = new Date(now).toISOString();
    if (data) {
      // toujours dans la fenêtre → on incrémente ; sinon on repart de zéro
      if (now - new Date(data.first_at).getTime() < WINDOW_MS) {
        count = (data.count ?? 0) + 1;
        firstAt = data.first_at;
      }
    }
    const lockedUntil = count >= MAX_TRIES ? new Date(now + LOCK_MS).toISOString() : null;

    await db
      .from("login_attempts")
      .upsert({ ip, count, first_at: firstAt, locked_until: lockedUntil });
  } catch {
    /* table absente / erreur → pas de comptage (fail-open) */
  }
}

// Connexion réussie → on efface le compteur de l'IP.
async function clearAttempts(ip: string): Promise<void> {
  try {
    await supabaseAdmin().from("login_attempts").delete().eq("ip", ip);
  } catch {
    /* non bloquant */
  }
}

// Valide le PIN et pose un cookie. Le middleware s'appuie dessus.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const pin = (form.get("pin") as string | null)?.trim();
  const next = (form.get("next") as string | null) || "/dashboard";
  const expected = process.env.MERCHANT_PIN;

  // internal paths only (no open redirect, including protocol-relative "//host")
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  const ip = clientIp(req);

  // Trop d'essais ratés récents → on refuse, même si le PIN est bon.
  if (await isLocked(ip)) {
    const url = new URL("/login", req.url);
    url.searchParams.set("error", "locked");
    url.searchParams.set("next", safeNext);
    return NextResponse.redirect(url, 303);
  }

  if (!expected || pin !== expected) {
    await recordFailure(ip);
    const url = new URL("/login", req.url);
    url.searchParams.set("error", "1");
    url.searchParams.set("next", safeNext);
    return NextResponse.redirect(url, 303);
  }

  await clearAttempts(ip);
  const res = NextResponse.redirect(new URL(safeNext, req.url), 303);
  // The cookie holds an HMAC of the PIN, never the PIN itself.
  res.cookies.set("mpin", await merchantSession(expected), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // http in dev, https in prod
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
  return res;
}
