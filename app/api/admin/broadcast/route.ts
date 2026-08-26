import { NextRequest, NextResponse } from "next/server";
import { broadcast, type Segment } from "@/lib/broadcast";

export const runtime = "nodejs";
export const maxDuration = 60;

// Envoie une notif push à un segment de cartes.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const message = String(form.get("message") || "");
  const segment = String(form.get("segment") || "all") as Segment;

  const sent = await broadcast(message, segment);

  return NextResponse.redirect(new URL(`/dashboard/notify?sent=${sent}`, req.url), 303);
}
