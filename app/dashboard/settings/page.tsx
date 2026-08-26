import { getSettings, DEFAULT_REVIEW_TEXT } from "@/lib/settings";
import { baseUrl } from "@/lib/url";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const s = await getSettings();
  const base = await baseUrl();
  const joinUrl = `${base}/join`;
  const qr = await QRCode.toDataURL(joinUrl, { margin: 1, width: 440 });

  return (
    <div className="content-narrow">
      <div className="page-head"><div><div className="page-title">Réglages</div><div className="page-sub">Infos affichées sur les cartes &amp; programme de fidélité</div></div></div>

      {saved != null && <div className="note ok">✅ Réglages enregistrés. Les cartes déjà ajoutées se mettent à jour automatiquement (quelques secondes).</div>}

      <div className="panel">
        <div className="panel-title">Restaurant</div>
        <form action="/api/admin/settings" method="POST" className="form-grid">
          <input type="hidden" name="section" value="resto" />
          <label>Nom<input name="resto_name" defaultValue={s.resto_name} /></label>
          <label>Adresse<textarea name="address" rows={2} defaultValue={s.address} /></label>
          <label>Téléphone<input name="phone" defaultValue={s.phone ?? ""} placeholder="05 56 …" /></label>
          <label>Horaires<textarea name="hours" rows={2} defaultValue={s.hours} /></label>
          <label>Instagram (URL)<input name="instagram" defaultValue={s.instagram} /></label>
          <button type="submit" className="s-btn-full">Enregistrer</button>
        </form>
      </div>

      <div className="panel">
        <div className="panel-title">Avis Google ⭐️ (relance auto)</div>
        <p className="page-sub">
          Après une visite, le client reçoit une notification l&apos;invitant à laisser un avis Google. Un lien permanent apparaît aussi au dos de sa carte. Dès qu&apos;il clique, on ne le relance plus jamais.
        </p>
        <form action="/api/admin/settings" method="POST" className="form-grid" style={{ marginTop: 12 }}>
          <input type="hidden" name="section" value="review" />
          <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input type="checkbox" name="review_enabled" defaultChecked={s.review_enabled} style={{ width: "auto" }} />
            <span>Activer la relance avis</span>
          </label>
          <label>
            Lien d&apos;avis Google
            <input name="review_url" type="url" defaultValue={s.review_url ?? ""} placeholder="https://g.page/r/…/review" />
          </label>
          <label>
            Délai après la visite (minutes)
            <input name="review_delay_min" type="number" min={0} max={240} defaultValue={s.review_delay_min} />
          </label>
          <label>
            Nombre max de relances par client
            <input name="review_max_nudges" type="number" min={1} max={10} defaultValue={s.review_max_nudges} />
          </label>
          <label>
            Message de la notification
            <textarea name="review_nudge_text" rows={2} maxLength={120} defaultValue={s.review_nudge_text ?? ""} placeholder={DEFAULT_REVIEW_TEXT} />
          </label>
          <button type="submit" className="s-btn-full">Enregistrer</button>
        </form>
        {!s.review_url && (
          <p className="note" style={{ marginTop: 12 }}>
            ⚠️ Sans lien d&apos;avis, la relance reste inactive (le lien au dos de la carte n&apos;apparaît pas non plus).
          </p>
        )}
      </div>

      <div className="panel">
        <div className="panel-title">QR d&apos;inscription (à imprimer)</div>
        <p className="page-sub">Affichez ce QR au comptoir. Le client le scanne pour ajouter sa carte au Wallet.</p>
        <div style={{ marginTop: 12 }}><div className="qr-print"><img src={qr} alt="QR inscription" /></div></div>
        <p className="page-sub" style={{ marginTop: 8 }}>{joinUrl}</p>
      </div>

      <div className="panel">
        <div className="panel-title">Sécurité</div>
        <p className="page-sub">Le code PIN d&apos;accès se change via la variable d&apos;environnement <strong>MERCHANT_PIN</strong> (redéploiement requis).</p>
      </div>
    </div>
  );
}
