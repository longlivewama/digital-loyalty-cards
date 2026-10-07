import { getSettings, DEFAULT_REVIEW_TEXT } from "@/lib/settings";
import { baseUrl } from "@/lib/url";
import QRCode from "qrcode";
import { isAppleWalletConfigured } from "@/lib/pass";
import { isGoogleWalletConfigured } from "@/lib/googleWallet";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const s = await getSettings();
  const base = await baseUrl();
  const joinUrl = `${base}/join`;
  const qr = await QRCode.toDataURL(joinUrl, { margin: 1, width: 440 });

  return (
    <div className="content-narrow">
      <div className="page-head"><div><div className="page-title">Settings</div><div className="page-sub">Details shown on the cards &amp; loyalty program</div></div></div>

      {saved != null && <div className="note ok">✅ Settings saved. Cards already in Apple Wallet and Google Wallet update automatically (within a few seconds).</div>}

      <div className="panel">
        <div className="panel-title">Coffee shop</div>
        <form action="/api/admin/settings" method="POST" className="form-grid">
          <input type="hidden" name="section" value="resto" />
          <label>Name<input name="resto_name" defaultValue={s.resto_name} /></label>
          <label>Address<textarea name="address" rows={2} defaultValue={s.address} /></label>
          <label>Phone<input name="phone" defaultValue={s.phone ?? ""} placeholder="+1 555 …" /></label>
          <label>Opening hours<textarea name="hours" rows={2} defaultValue={s.hours} /></label>
          <label>Instagram (URL)<input name="instagram" defaultValue={s.instagram} /></label>
          <button type="submit" className="s-btn-full">Save</button>
        </form>
      </div>

      <div className="panel">
        <div className="panel-title">Google reviews ⭐️ (automatic nudge)</div>
        <p className="page-sub">
          After a visit, the customer gets a notification inviting them to leave a Google review. A permanent link also appears on the back of their Apple card. Once they click it, they are never asked again.
        </p>
        <form action="/api/admin/settings" method="POST" className="form-grid" style={{ marginTop: 12 }}>
          <input type="hidden" name="section" value="review" />
          <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input type="checkbox" name="review_enabled" defaultChecked={s.review_enabled} style={{ width: "auto" }} />
            <span>Enable the review nudge</span>
          </label>
          <label>
            Google review link
            <input name="review_url" type="url" defaultValue={s.review_url ?? ""} placeholder="https://g.page/r/…/review" />
          </label>
          <label>
            Delay after the visit (minutes)
            <input name="review_delay_min" type="number" min={0} max={240} defaultValue={s.review_delay_min} />
          </label>
          <label>
            Max nudges per customer
            <input name="review_max_nudges" type="number" min={1} max={10} defaultValue={s.review_max_nudges} />
          </label>
          <label>
            Notification message
            <textarea name="review_nudge_text" rows={2} maxLength={120} defaultValue={s.review_nudge_text ?? ""} placeholder={DEFAULT_REVIEW_TEXT} />
          </label>
          <button type="submit" className="s-btn-full">Save</button>
        </form>
        {!s.review_url && (
          <p className="note" style={{ marginTop: 12 }}>
            ⚠️ Without a review link the nudge stays off (and no link appears on the back of the card).
          </p>
        )}
      </div>

      <div className="panel">
        <div className="panel-title">Signup QR code (to print)</div>
        <p className="page-sub">Display this QR code at the counter. Customers scan it to add their card to Apple Wallet or Google Wallet.</p>
        <div style={{ marginTop: 12 }}><div className="qr-print"><img src={qr} alt="Signup QR code" /></div></div>
        <p className="page-sub" style={{ marginTop: 8 }}>{joinUrl}</p>
      </div>

      <div className="panel">
        <div className="panel-title">Loyalty program</div>
        <p className="page-sub">Buy {s.goal} coffees, get the next one free: {s.goal} stamps = 1 free coffee. The goal is fixed in the database to keep every card consistent.</p>
      </div>

      <div className="panel">
        <div className="panel-title">Wallet status</div>
        <div className="info-row"><span className="info-k">Apple Wallet</span><span className="info-v">{isAppleWalletConfigured() ? "Configured ✓" : "Not configured (PASS_* variables missing)"}</span></div>
        <div className="info-row"><span className="info-k">Google Wallet</span><span className="info-v">{isGoogleWalletConfigured() ? "Configured ✓" : "Not configured (WALLET_ISSUER_ID / service account missing)"}</span></div>
      </div>

      <div className="panel">
        <div className="panel-title">Security</div>
        <p className="page-sub">The staff PIN is changed with the <strong>MERCHANT_PIN</strong> environment variable (restart/redeploy required).</p>
      </div>
    </div>
  );
}
