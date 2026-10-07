import BirthdayField from "@/app/_components/BirthdayField";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Customer signup: enter your details, get your loyalty card for Apple Wallet
// or Google Wallet (both are the same card, with the same stamps).
const ERRORS: Record<string, string> = {
  name: "Please enter your first and last name (40 characters max).",
  birthday: "Please enter a valid birthday, or leave it empty.",
  phone: "Please enter a valid phone number, or leave it empty.",
};

export default async function Join({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const s = await getSettings();
  return (
    <div className="card">
      <h1>☕ Welcome!</h1>
      <h2>{s.resto_name} · Loyalty Card</h2>
      <p className="muted" style={{ margin: "4px 0 16px" }}>
        Buy {s.goal} coffees, get the {s.goal + 1}th <strong>free</strong>.
      </p>
      {error && (
        <p role="alert" style={{ color: "#ff9b9b", fontSize: 14, margin: "0 0 12px" }}>
          {ERRORS[error] ?? "Something went wrong. Please try again."}
        </p>
      )}
      <form action="/api/join" method="POST">
        <input name="name" placeholder="First name" required maxLength={40} autoComplete="given-name" />
        <input name="last_name" placeholder="Last name" required maxLength={40} autoComplete="family-name" />
        <BirthdayField />
        <input name="phone" placeholder="Phone (optional)" type="tel" maxLength={20} autoComplete="tel" />
        <p className="muted" style={{ fontSize: 12, margin: "2px 0 14px" }}>
          Phone &amp; birthday are optional — they help us recover your stamps and send you a
          birthday treat 🎁
        </p>
        <button type="submit">Get my loyalty card</button>
      </form>
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        By tapping “Get my loyalty card”, you accept the{" "}
        <a href="/cgu" target="_blank" rel="noopener">terms of use</a>.
      </p>
    </div>
  );
}
