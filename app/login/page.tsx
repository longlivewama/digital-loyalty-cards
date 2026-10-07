import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Staff PIN entry (public page). Once validated, a session cookie is set.
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const s = await getSettings();
  return (
    <div className="card">
      <h1>🔒 Staff area</h1>
      <h2>{s.resto_name}</h2>
      <p className="muted">Enter the shop PIN to open the customer card.</p>
      {sp.error === "locked" ? (
        <p style={{ color: "#ff9b9b", fontSize: 14, marginTop: 8 }}>
          Too many attempts. Please try again in 15 minutes.
        </p>
      ) : sp.error ? (
        <p style={{ color: "#ff9b9b", fontSize: 14, marginTop: 8 }}>Incorrect PIN.</p>
      ) : null}
      <form action="/api/auth" method="POST">
        <input type="hidden" name="next" value={sp.next ?? "/dashboard"} />
        <input
          name="pin"
          type="password"
          inputMode="numeric"
          placeholder="PIN"
          autoFocus
          required
        />
        <button type="submit">Unlock</button>
      </form>
    </div>
  );
}
