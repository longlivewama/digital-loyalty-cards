import { NextRequest, NextResponse } from "next/server";

// Protège les pages commerçant (fiche client + dashboard) par PIN.
// Le client qui scannerait sa propre carte tombe sur /login et ne connaît pas le PIN.
export function middleware(req: NextRequest) {
  const pin = process.env.MERCHANT_PIN;
  const cookie = req.cookies.get("mpin")?.value;

  if (pin && cookie === pin) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/m/:path*", "/dashboard/:path*", "/dashboard", "/api/admin/:path*"],
};
