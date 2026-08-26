import BirthdayField from "@/app/_components/BirthdayField";

// Page d'inscription client : saisit ses infos, reçoit sa carte Wallet.
export default function Join() {
  return (
    <div className="card">
      <h1>🍕 Bienvenue !</h1>
      <h2>Votre carte de fidélité</h2>
      <form action="/api/join" method="POST">
        <input name="name" placeholder="Prénom" required maxLength={40} autoComplete="given-name" />
        <input name="last_name" placeholder="Nom" required maxLength={40} autoComplete="family-name" />
        <BirthdayField />
        <input name="phone" placeholder="Téléphone (optionnel)" type="tel" maxLength={20} autoComplete="tel" />
        <p className="muted" style={{ fontSize: 12, margin: "2px 0 14px" }}>
          Téléphone &amp; date de naissance facultatifs — pour récupérer vos points et recevoir une surprise d&apos;anniversaire 🎁
        </p>
        <button type="submit">Ajouter à Apple Wallet</button>
      </form>
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        En cliquant sur «&nbsp;Ajouter à Apple Wallet&nbsp;», vous acceptez les{" "}
        <a href="/cgu" target="_blank" rel="noopener">conditions générales d&apos;utilisation</a>.
      </p>
    </div>
  );
}
