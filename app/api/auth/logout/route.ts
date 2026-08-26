import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Déconnexion : supprime le cookie PIN.
// `secure` DOIT matcher la pose du cookie (/api/auth) : sinon en http (localhost)
// le navigateur ignore le cookie d'effacement → on reste "connecté".
export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", req.url), 303);
  res.cookies.set("mpin", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return res;
}
