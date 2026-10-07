import Link from "next/link";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Terms of Use — Loyalty Card" };

const h2: React.CSSProperties = {
  fontFamily: "var(--font-display), serif",
  fontSize: 18,
  fontWeight: 700,
  color: "var(--cream)",
  textTransform: "none",
  textAlign: "left",
  margin: "28px 0 8px",
};

// Template terms of use — review and adapt them to your business and local law.
export default async function Terms() {
  const s = await getSettings();
  const shop = s.resto_name;
  return (
    <main style={{ maxWidth: 700, margin: "0 auto", padding: "44px 22px 90px", lineHeight: 1.65 }}>
      <Link href="/join" style={{ color: "var(--copper)", fontSize: 14, textDecoration: "none" }}>
        ← Back
      </Link>

      <h1 style={{ fontFamily: "var(--font-display), serif", fontSize: 28, fontWeight: 800, color: "var(--cream)", textAlign: "left", margin: "16px 0 4px", textTransform: "none" }}>
        Terms of Use
      </h1>
      <p className="muted" style={{ marginBottom: 10 }}>
        <strong>{shop}</strong> digital loyalty card.
      </p>

      <h2 style={h2}>1. Purpose</h2>
      <p className="muted">
        These terms govern the use of the {shop} digital loyalty card, added to the customer&apos;s
        Apple Wallet or Google Wallet. By adding the card, the customer accepts these terms.
      </p>

      <h2 style={h2}>2. Contact</h2>
      <p className="muted">
        The card is provided by {shop}.{" "}
        {s.instagram ? (
          <>
            Contact us by direct message on{" "}
            <a href={s.instagram} target="_blank" rel="noopener">Instagram</a>
            {s.phone ? <> or by phone at {s.phone}</> : null}.
          </>
        ) : s.phone ? (
          <>Contact us by phone at {s.phone}.</>
        ) : (
          <>Contact us in the shop.</>
        )}
      </p>

      <h2 style={h2}>3. The loyalty program</h2>
      <p className="muted">
        Each eligible coffee bought in the shop earns one stamp, added to the card by the staff.
        Once {s.goal} stamps are collected, the customer gets their next coffee free. Stamps have no
        cash value and cannot be transferred, exchanged or refunded. The shop may change or end
        the program at any time.
      </p>

      <h2 style={h2}>4. Data we collect and why</h2>
      <p className="muted">
        At signup we collect your first and last name and, optionally, your birthday and phone
        number. This data is only used to manage your loyalty card, send card updates and
        notifications (stamp balance, offers, birthday message), and identify you if you lose your
        card. Your data is never sold or shared with third parties for marketing.
      </p>

      <h2 style={h2}>5. Notifications</h2>
      <p className="muted">
        Card updates and notifications are delivered free of charge through Apple Wallet or Google
        Wallet. You can turn them off at any time in your card&apos;s settings, or simply remove the
        card from your phone.
      </p>

      <h2 style={h2}>6. Data retention</h2>
      <p className="muted">
        Data is kept while the loyalty card is active, then deleted on request or after a long
        period of inactivity, subject to any legal retention periods.
      </p>

      <h2 style={h2}>7. Your rights</h2>
      <p className="muted">
        You may request access to, correction of, or deletion of your data, or object to its use,
        by contacting us as described above. You may also contact your local data protection
        authority.
      </p>

      <h2 style={h2}>8. Apple Wallet and Google Wallet</h2>
      <p className="muted">
        The card works inside Apple Wallet or Google Wallet, which are subject to Apple&apos;s and
        Google&apos;s own terms. {shop} is not responsible for these services or for the
        customer&apos;s device.
      </p>

      <h2 style={h2}>9. Liability</h2>
      <p className="muted">
        The service is provided “as is”. {shop} is not liable for temporary unavailability, for a
        notification that is not received (delivery is not guaranteed by Apple or Google), or for
        stamps lost through misuse.
      </p>

      <h2 style={h2}>10. Changes to these terms</h2>
      <p className="muted">
        These terms may change at any time. The version that applies is the one published on this
        page when the card is used.
      </p>
    </main>
  );
}
