import Link from "next/link";

export const metadata = { title: "Conditions Générales d’Utilisation — Pizzeria Esempio" };

const h2: React.CSSProperties = {
  fontFamily: "var(--font-display), serif",
  fontSize: 18,
  fontWeight: 700,
  color: "var(--cream)",
  textTransform: "none",
  textAlign: "left",
  margin: "28px 0 8px",
};

export default function CGU() {
  return (
    <main style={{ maxWidth: 700, margin: "0 auto", padding: "44px 22px 90px", lineHeight: 1.65 }}>
      <Link href="/join" style={{ color: "var(--copper)", fontSize: 14, textDecoration: "none" }}>
        ← Retour
      </Link>

      <h1 style={{ fontFamily: "var(--font-display), serif", fontSize: 28, fontWeight: 800, color: "var(--cream)", textAlign: "left", margin: "16px 0 4px", textTransform: "none" }}>
        Conditions Générales d’Utilisation
      </h1>
      <p className="muted" style={{ marginBottom: 10 }}>
        Carte de fidélité numérique <strong>Pizzeria Esempio</strong> — dernière mise à jour : juin 2026.
      </p>

      <h2 style={h2}>1. Objet</h2>
      <p className="muted">
        Les présentes conditions régissent l’utilisation de la carte de fidélité numérique
        « Pizzeria Esempio », ajoutée au portefeuille Apple Wallet du client. En ajoutant la
        carte, le client accepte sans réserve les présentes conditions.
      </p>

      <h2 style={h2}>2. Éditeur</h2>
      <p className="muted">
        La carte est éditée par <strong>SOCIETE-EXEMPLE</strong> (EURL), exploitant la pizzeria
        Pizzeria Esempio, située à Bordeaux (Gironde, 33).
        Contact&nbsp;: par message privé sur Instagram{" "}
        <a href="https://www.instagram.com/pizzeria-esempio/" target="_blank" rel="noopener">@pizzeria-esempio</a>.
      </p>

      <h2 style={h2}>3. Le programme de fidélité</h2>
      <p className="muted">
        Chaque achat éligible en boutique donne droit à un tampon, ajouté à la carte par le
        commerçant. Une fois le nombre de tampons requis atteint, le client bénéficie de la
        récompense indiquée sur sa carte (ex.&nbsp;: une pizza offerte). Les tampons n’ont aucune
        valeur monétaire, ne sont ni cessibles, ni échangeables, ni remboursables. Le commerçant
        peut faire évoluer ou interrompre le programme à tout moment.
      </p>

      <h2 style={h2}>4. Données collectées &amp; finalités</h2>
      <p className="muted">
        À l’inscription sont collectés&nbsp;: le prénom et le nom, et de manière facultative la
        date de naissance et le numéro de téléphone. Ces données servent uniquement à&nbsp;:
        gérer le compte fidélité du client, lui envoyer les mises à jour de sa carte et des
        notifications (solde de tampons, offres, message d’anniversaire), et l’identifier en cas
        de perte de sa carte. Base légale&nbsp;: consentement du client et exécution du programme
        de fidélité. Les données ne sont ni vendues, ni cédées à des tiers à des fins commerciales.
      </p>

      <h2 style={h2}>5. Notifications</h2>
      <p className="muted">
        Les notifications sont transmises gratuitement via Apple Wallet. Le client peut les
        désactiver à tout moment dans les réglages de sa carte (Wallet → carte → Mises à jour /
        Notifications), ou supprimer purement et simplement la carte de son téléphone.
      </p>

      <h2 style={h2}>6. Conservation des données</h2>
      <p className="muted">
        Les données sont conservées tant que la carte de fidélité est active, puis supprimées sur
        demande du client ou après une période d’inactivité prolongée, sous réserve des durées de
        conservation légales applicables.
      </p>

      <h2 style={h2}>7. Vos droits (RGPD)</h2>
      <p className="muted">
        Conformément au Règlement Général sur la Protection des Données, le client dispose d’un
        droit d’accès, de rectification, d’effacement, d’opposition et de portabilité de ses
        données. Ces droits s’exercent par message privé sur notre compte Instagram{" "}
        <a href="https://www.instagram.com/pizzeria-esempio/" target="_blank" rel="noopener">@pizzeria-esempio</a>. Le client peut
        également introduire une réclamation auprès de la CNIL (www.cnil.fr).
      </p>

      <h2 style={h2}>8. Apple Wallet</h2>
      <p className="muted">
        La carte fonctionne au sein de l’application Apple Wallet, soumise aux conditions
        d’utilisation d’Apple. SOCIETE-EXEMPLE n’est pas responsable du fonctionnement du service Apple ni
        de l’appareil du client.
      </p>

      <h2 style={h2}>9. Responsabilité</h2>
      <p className="muted">
        Le service est fourni « en l’état ». SOCIETE-EXEMPLE ne saurait être tenue responsable d’une
        indisponibilité temporaire, d’une non-réception d’une notification (la livraison n’étant
        pas garantie par Apple) ou d’une perte de tampons liée à un usage non conforme.
      </p>

      <h2 style={h2}>10. Modification des conditions</h2>
      <p className="muted">
        Les présentes conditions peuvent être modifiées à tout moment. La version applicable est
        celle publiée sur cette page au moment de l’utilisation de la carte.
      </p>

      <h2 style={h2}>11. Droit applicable</h2>
      <p className="muted">
        Les présentes conditions sont soumises au droit français. Tout litige relève de la
        compétence des tribunaux de Bordeaux.
      </p>
    </main>
  );
}
