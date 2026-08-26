import { NextRequest, NextResponse, after } from "next/server";
import { updateSettings } from "@/lib/settings";
import { refreshActiveCards } from "@/lib/broadcast";

export const runtime = "nodejs";

// Enregistre les réglages du resto (infos carte + seuil).
export async function POST(req: NextRequest) {
  const f = await req.formData();
  // Deux formulaires distincts postent ici (resto / avis) : on ne patche que
  // les champs de la section soumise, sinon enregistrer l'un écraserait l'autre.
  const section = String(f.get("section") || "resto");

  if (section === "review") {
    const delay = parseInt(String(f.get("review_delay_min") || "17"), 10);
    const maxNudges = parseInt(String(f.get("review_max_nudges") || "1"), 10);
    const reviewUrl = String(f.get("review_url") || "").trim();
    const nudgeText = String(f.get("review_nudge_text") || "").trim();
    await updateSettings({
      review_enabled: f.get("review_enabled") != null,
      review_url: reviewUrl || null,
      review_delay_min: Number.isFinite(delay) ? Math.max(0, Math.min(240, delay)) : 17,
      review_max_nudges: Number.isFinite(maxNudges) ? Math.max(1, Math.min(10, maxNudges)) : 1,
      review_nudge_text: nudgeText ? nudgeText.slice(0, 120) : null,
    });
  } else {
    await updateSettings({
      resto_name: String(f.get("resto_name") || "").trim() || "Pizzeria Esempio",
      address: String(f.get("address") || "").trim(),
      phone: String(f.get("phone") || "").trim() || null,
      hours: String(f.get("hours") || "").trim(),
      instagram: String(f.get("instagram") || "").trim(),
      // Palier (goal) volontairement non modifiable depuis l'UI : il reste sur
      // sa valeur en base pour éviter les cartes incohérentes.
    });
  }

  // Ces réglages s'affichent sur les cartes déjà dans les Wallet : on les
  // rafraîchit en arrière-plan (after) pour qu'elles reflètent les nouvelles
  // infos sans faire attendre le commerçant.
  after(() => refreshActiveCards());

  return NextResponse.redirect(new URL("/dashboard/settings?saved=1", req.url), 303);
}
