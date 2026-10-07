import { NextRequest, NextResponse } from "next/server";
import { verifyMerchantSession } from "@/lib/linkSign";

// Protects the staff pages (member page + dashboard) with the merchant PIN.
// A customer who scans their own card lands on /login and does not know the PIN.
// The cookie holds an HMAC of the PIN (see lib/linkSign.ts), never the PIN itself.
export async function middleware(req: NextRequest) {
  const cookie = req.cookies.get("mpin")?.value;

  if (await verifyMerchantSession(cookie).catch(() => false)) return NextResponse.next();

  // fetch() callers (the member page's instant actions) get a plain 401;
  // regular form posts keep the original redirect to /login.
  if (req.nextUrl.pathname.startsWith("/api/") && req.headers.get("accept")?.includes("application/json")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/m/:path*", "/dashboard/:path*", "/dashboard", "/api/admin/:path*"],
};
