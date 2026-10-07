import { supabaseAdmin } from "@/lib/supabase";
import { isAppleWalletConfigured } from "@/lib/pass";
import { isGoogleWalletConfigured } from "@/lib/googleWallet";
import { verifyCardKey } from "@/lib/linkSign";
import { notFound } from "next/navigation";
import AddedClient from "./AddedClient";
import QRCode from "qrcode";
import { baseUrl } from "@/lib/url";

export const dynamic = "force-dynamic";

// After signup: offers Apple Wallet and Google Wallet for the SAME member
// (same stamps, same QR code). Only reachable with the signed key from signup.
export default async function Added({
  params,
  searchParams,
}: {
  params: Promise<{ serial: string }>;
  searchParams: Promise<{ k?: string }>;
}) {
  const { serial } = await params;
  const { k } = await searchParams;
  if (!k || !(await verifyCardKey(serial, k))) notFound();

  const db = supabaseAdmin();
  const { data: member } = await db.from("members").select("id,name").eq("serial", serial).single();
  if (!member) notFound();

  const q = `?k=${encodeURIComponent(k)}`;
  // The same member QR as on both wallet cards (no secret in it): customers
  // without a wallet can show it from their screen.
  const memberQr = await QRCode.toDataURL(`${await baseUrl()}/m/${member.id}`, { margin: 1, width: 360 });
  return (
    <AddedClient
      name={member.name}
      serial={serial}
      memberQr={memberQr}
      statusUrl={`/api/member/${serial}/status${q}`}
      appleUrl={isAppleWalletConfigured() ? `/api/pass/${serial}${q}` : null}
      googleUrl={isGoogleWalletConfigured() ? `/api/google-pass/${serial}${q}` : null}
    />
  );
}
