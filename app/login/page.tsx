// Saisie du PIN commerçant (page publique). Une fois validé, cookie posé.
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="card">
      <h1>🔒 Espace commerçant</h1>
      <h2>Pizzeria Esempio</h2>
      <p className="muted">Entrez le code PIN du restaurant pour accéder à la fiche client.</p>
      {sp.error === "locked" ? (
        <p style={{ color: "#ff9b9b", fontSize: 14, marginTop: 8 }}>
          Trop d&apos;essais. Réessayez dans 15 minutes.
        </p>
      ) : sp.error ? (
        <p style={{ color: "#ff9b9b", fontSize: 14, marginTop: 8 }}>Code incorrect.</p>
      ) : null}
      <form action="/api/auth" method="POST">
        <input type="hidden" name="next" value={sp.next ?? "/dashboard"} />
        <input
          name="pin"
          type="password"
          inputMode="numeric"
          placeholder="Code PIN"
          autoFocus
          required
        />
        <button type="submit">Déverrouiller</button>
      </form>
    </div>
  );
}
