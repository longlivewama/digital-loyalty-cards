import { NextRequest, NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { markReviewed } from "@/lib/reviews";
import { baseUrl } from "@/lib/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lien d'avis tracké. Le client clique (depuis la notif ou le dos de sa carte)
// → on note qu'il a cliqué (plus jamais de relance) → on le renvoie vers la
// vraie page d'avis Google. Si aucun lien n'est réglé, retour à l'accueil.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const s = await getSettings();

  // détection du clic (best-effort, ne bloque pas la redirection)
  await markReviewed(id).catch(() => {});

  const target = s.review_url?.trim();
  if (!target) return NextResponse.redirect(await baseUrl(), 302);
  return NextResponse.redirect(target, 302);
}
