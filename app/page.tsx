import QRCode from "qrcode";
import { baseUrl } from "@/lib/url";

export const dynamic = "force-dynamic";

// Page commerçant : affiche le QR à montrer aux clients (mène à /join).
export default async function Home() {
  const base = await baseUrl();
  const joinUrl = `${base}/join`;
  const qr = await QRCode.toDataURL(joinUrl, { margin: 1, width: 440 });

  return (
    <div className="card">
      <h1>🍕 Pizzeria Esempio</h1>
      <h2>Carte de fidélité</h2>
      <p className="muted">Le client scanne ce QR code pour ajouter sa carte au Wallet.</p>
      <div className="qr">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="QR inscription" />
      </div>
      <p className="muted">
        Ou ouvrez : <span className="copper">{joinUrl}</span>
      </p>
    </div>
  );
}
