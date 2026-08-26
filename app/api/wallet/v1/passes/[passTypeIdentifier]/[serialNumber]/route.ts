import { NextRequest, NextResponse } from "next/server";
import { generatePkpass } from "@/lib/pass";
import { authorizeCard } from "@/lib/cardAuth";
import { baseUrl } from "@/lib/url";

export const runtime = "nodejs";

// iOS appelle cet endpoint (après un push) pour récupérer la carte à jour.
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ serialNumber: string }> }
) {
  const { serialNumber } = await ctx.params;
  // authorizeCard valide le jeton ET renvoie le membre (jeton secret par carte).
  const member = await authorizeCard(serialNumber, req.headers.get("authorization"));
  console.log(`[WALLET-FETCH] serial=${serialNumber} auth=${!!member} ims=${req.headers.get("if-modified-since")}`);
  if (!member) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  // If-Modified-Since : si rien n'a changé, 304 (économise de la bande passante).
  const lastModified = new Date(member.updated_at || member.created_at);
  const ims = req.headers.get("if-modified-since");
  if (ims && new Date(ims).getTime() >= Math.floor(lastModified.getTime() / 1000) * 1000) {
    console.log(`[WALLET-FETCH] serial=${serialNumber} -> 304 (lastModified=${lastModified.toISOString()})`);
    return new NextResponse(null, { status: 304 });
  }
  console.log(`[WALLET-FETCH] serial=${serialNumber} -> 200 fresh (push_msg=${member.push_msg ?? null}, lastModified=${lastModified.toISOString()})`);

  const base = await baseUrl();
  const buffer = await generatePkpass(member, base);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.apple.pkpass",
      "Last-Modified": lastModified.toUTCString(),
    },
  });
}
