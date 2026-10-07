import QRCode from "qrcode";
import { baseUrl } from "@/lib/url";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Counter page: shows the QR code customers scan to get their card (→ /join).
export default async function Home() {
  const base = await baseUrl();
  const s = await getSettings();
  const joinUrl = `${base}/join`;
  const qr = await QRCode.toDataURL(joinUrl, { margin: 1, width: 440 });

  return (
    <div className="card">
      <h1>☕ {s.resto_name}</h1>
      <h2>Loyalty Card</h2>
      <p className="muted">
        Scan this QR code to add your loyalty card to Apple Wallet or Google Wallet. Buy {s.goal}{" "}
        coffees, get the {s.goal + 1}th free!
      </p>
      <div className="qr">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="Signup QR code" />
      </div>
      <p className="muted">
        Or open: <span className="copper">{joinUrl}</span>
      </p>
    </div>
  );
}
