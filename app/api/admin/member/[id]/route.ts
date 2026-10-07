import { NextRequest, NextResponse, after } from "next/server";
import { addPoints, removePoint, claimReward, setNote, pushUpdate } from "@/lib/members";
import { baseUrl } from "@/lib/url";
import { supabaseAdmin } from "@/lib/supabase";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPS = new Set(["add", "remove", "claim", "note", "sync"]);

export const runtime = "nodejs";

// Merchant mutations (protected by the /api/admin/* middleware).
// The database is updated first; the Apple + Google card updates run in the
// BACKGROUND (after) → the merchant never waits for Apple or Google.
// JSON response when called with fetch (member page), else a redirect (plain form).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const json = req.headers.get("accept")?.includes("application/json");
  const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

  if (!UUID.test(id)) return fail(404, "Member not found.");
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "Invalid request.");
  }
  const op = String(form.get("op") || "");
  if (!OPS.has(op)) return fail(400, "Unknown operation.");

  const db = supabaseAdmin();
  const { data: exists } = await db.from("members").select("id").eq("id", id).maybeSingle();
  if (!exists) return fail(404, "Member not found.");

  let points: number | null = null;
  let mutated = false;

  if (op === "add") {
    const n = Number(form.get("n") ?? "1");
    if (!Number.isInteger(n) || n < 1) return fail(400, "Invalid number of coffees.");
    points = await addPoints(id, n); // capped at 100 per request
    mutated = true;
  } else if (op === "remove") {
    points = await removePoint(id);
    mutated = true;
  } else if (op === "claim") {
    points = await claimReward(id);
    // Not enough stamps (or already redeemed by a simultaneous request).
    if (points == null) return fail(409, "No free coffee available.");
    mutated = true;
  } else if (op === "note") {
    await setNote(id, String(form.get("note") || ""));
  } else if (op === "sync") {
    // Manual "resync wallets": re-sends the current state to both cards.
    mutated = true;
  }

  const base = await baseUrl();
  if (mutated) after(() => pushUpdate(id, base));

  if ((op === "add" || op === "remove") && points == null) return fail(500, "Could not update the stamps.");

  if (json) {
    return NextResponse.json({ ok: true, points });
  }
  return NextResponse.redirect(new URL(`/m/${id}`, req.url), 303);
}
