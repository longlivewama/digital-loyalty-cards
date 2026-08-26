import { NextRequest, NextResponse, after } from "next/server";
import { addPoints, removePoint, claimReward, setNote, pushUpdate } from "@/lib/members";

export const runtime = "nodejs";

// Mutations commerçant (protégé par middleware /api/admin/*).
// La notif au client part EN ARRIÈRE-PLAN (after) → le commerçant n'attend pas Apple.
// Réponse JSON si l'interface scan appelle en fetch, sinon redirection (formulaire classique).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const form = await req.formData();
  const op = String(form.get("op") || "");

  let points: number | null = null;
  let mutated = false;

  if (op === "add") {
    const n = parseInt(String(form.get("n") ?? "1"), 10);
    points = await addPoints(id, Number.isFinite(n) ? n : 1);
    mutated = true;
  } else if (op === "remove") {
    points = await removePoint(id);
    mutated = true;
  } else if (op === "claim") {
    points = await claimReward(id);
    mutated = true;
  } else if (op === "note") {
    await setNote(id, String(form.get("note") || ""));
  }

  if (mutated) after(() => pushUpdate(id));

  if (req.headers.get("accept")?.includes("application/json")) {
    return NextResponse.json({ ok: true, points });
  }
  return NextResponse.redirect(new URL(`/m/${id}`, req.url), 303);
}
