import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { authorizeCard } from "@/lib/cardAuth";

export const runtime = "nodejs";

type Params = Promise<{ serialNumber: string; deviceLibraryIdentifier: string }>;

// iOS appelle CE endpoint juste après que l'utilisateur a tapé "Ajouter" dans Wallet.
// => c'est notre signal fiable que la carte a bien été ajoutée.
export async function POST(req: NextRequest, ctx: { params: Params }) {
  const { serialNumber, deviceLibraryIdentifier } = await ctx.params;
  if (!(await authorizeCard(serialNumber, req.headers.get("authorization")))) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  let pushToken: string | undefined;
  try {
    const body = await req.json();
    pushToken = body?.pushToken;
  } catch {
    /* corps optionnel */
  }

  const db = supabaseAdmin();
  await db
    .from("members")
    .update({
      registered_at: new Date().toISOString(),
      device_lib_id: deviceLibraryIdentifier,
      push_token: pushToken ?? null,
    })
    .eq("serial", serialNumber);

  // 201 = nouvel enregistrement
  return new NextResponse(null, { status: 201 });
}

// iOS appelle ceci si l'utilisateur supprime la carte du Wallet.
export async function DELETE(req: NextRequest, ctx: { params: Params }) {
  const { serialNumber } = await ctx.params;
  if (!(await authorizeCard(serialNumber, req.headers.get("authorization")))) {
    return new NextResponse("unauthorized", { status: 401 });
  }
  const db = supabaseAdmin();
  await db
    .from("members")
    .update({ registered_at: null, device_lib_id: null, push_token: null })
    .eq("serial", serialNumber);
  return new NextResponse(null, { status: 200 });
}
