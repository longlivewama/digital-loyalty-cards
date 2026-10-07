import { NextRequest, NextResponse, after } from "next/server";
import { updateSettings } from "@/lib/settings";
import { refreshActiveCards } from "@/lib/broadcast";
import { refreshClass } from "@/lib/googleWallet";
import { baseUrl } from "@/lib/url";

export const runtime = "nodejs";

// Saves the shop settings (card details + review nudge).
export async function POST(req: NextRequest) {
  const f = await req.formData();
  // Two separate forms post here (shop / review): only patch the fields of the
  // submitted section, otherwise saving one would overwrite the other.
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
      resto_name: String(f.get("resto_name") || "").trim() || "Coffee Shop",
      address: String(f.get("address") || "").trim(),
      phone: String(f.get("phone") || "").trim() || null,
      hours: String(f.get("hours") || "").trim(),
      instagram: String(f.get("instagram") || "").trim(),
      // The goal is deliberately not editable from the UI: it keeps its
      // database value (9) to avoid inconsistent cards.
    });
  }

  // These details are shown on cards already in Wallets: refresh them in the
  // background (after) — Apple via APNs, Google via its loyalty class.
  const base = await baseUrl();
  after(() => Promise.allSettled([refreshActiveCards(), refreshClass(base)]));

  return NextResponse.redirect(new URL("/dashboard/settings?saved=1", req.url), 303);
}
