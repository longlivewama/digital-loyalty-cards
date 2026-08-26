import { NextRequest, NextResponse } from "next/server";
import { sendReviewNudges } from "@/lib/reviews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Déclenché toutes les minutes par Supabase pg_cron (POST) et 1×/jour par
// Vercel Cron (GET, filet de secours). Protégé par CRON_SECRET : sans le bon
// jeton, on refuse — personne ne peut spammer la relance depuis l'extérieur.
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET non configuré" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  }

  const report = await sendReviewNudges();
  return NextResponse.json({ ok: true, ...report });
}

export const GET = handle;
export const POST = handle;
