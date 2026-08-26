import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Apple POST ses logs/erreurs ici. On les logge pour diagnostic (visibles via `vercel logs`).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[WALLET-LOG iOS]", JSON.stringify(body));
  } catch {
    console.log("[WALLET-LOG iOS] (corps illisible)");
  }
  return new NextResponse(null, { status: 200 });
}
