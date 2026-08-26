# Carte de fidélité Apple Wallet — Pizzeria Esempio

Document de référence du MVP. But : poser le concept, ce qui est déjà construit, et tous les cas à gérer pour pouvoir build sereinement sans rien oublier.

---

## 1. Le problème qu'on résout

Les cartes de fidélité papier (ou plastique) sont **perdues, oubliées, jamais sur soi**. Résultat : le programme de fidélité ne tourne pas, le client ne revient pas plus.

La carte vit dans l'**Apple Wallet** du client → toujours dans sa poche, impossible à oublier.

## 2. La valeur

**Pour le client**
- Jamais besoin d'avoir une carte physique : elle est dans le téléphone.
- Expérience fluide : il scanne, il a sa carte en 10 secondes.

**Pour le restaurant**
- **Présence permanente dans la tête du client.** À chaque fois qu'il paie avec son tel (double-clic latéral), il voit défiler la carte → le nom « Pizzeria Esempio ».
- **Géolocalisation** : dès que le client passe à ~150 m du resto, la carte remonte sur son écran verrouillé avec le nom du resto → rappel + incitation à entrer.
- **Notifications push** (phase 2) : « Plus que 2 pizzas avant la gratuite », promos, événements.
- Pousse à consommer plus (objectif des 10 tampons).

## 3. Comment ça marche

### Créer une carte (inscription)
1. Un **QR code au comptoir** (affiché en permanence).
2. Le client le scanne avec son appareil photo → ouvre la page d'inscription.
3. Il entre son **prénom** → sa carte personnalisée s'ajoute à son Apple Wallet.

### Ajouter un (ou des) point(s)
Deux approches possibles :

**Option A — QR privé derrière le comptoir, scanné par le client.**
- Le client scanne un QR « +1 pizza ».
- ❌ Problèmes : s'il prend 5 pizzas il doit scanner 5 fois ; surtout **n'importe qui peut scanner le QR autant de fois qu'il veut** (le client peut tricher, photographier le QR, l'envoyer à des amis). Pas de contrôle.

**Option B — le resto scanne le QR de la carte du client. ✅ (recommandé)**
- L'employé scanne le QR présent **sur la carte du client**.
- Ça ouvre une page (côté resto) avec les **stats du client** + boutons pour ajouter **1, 2, … N** pizzas d'un coup.
- Contrôle total : seul le resto valide. Gère le cas « 5 pizzas en une commande » d'un clic.

> Décision retenue : **Option B**. (Voir §6 « Sécurité » : cette page doit être protégée, sinon le client peut scanner sa propre carte et s'ajouter des points lui-même.)

## 4. Ce qui est déjà construit (état actuel)

- ✅ App Next.js déployée sur Vercel : **https://wallet-loyalty.vercel.app**
- ✅ Base Supabase (`members`).
- ✅ Inscription : page `/join` → prénom → carte signée générée à la volée et ajoutée au Wallet.
- ✅ QR de la carte client → page resto `/m/[id]` → bouton **+1 pizza** / reset récompense.
- ✅ Carte aux couleurs de la pizzeria (espresso / cuivre / crème), logo, dos avec infos resto.
- ✅ **Géolocalisation** (≈150 m) : carte sur écran verrouillé près du resto.
- ✅ **Détection d'ajout réel** : quand le client ajoute la carte, iOS prévient le serveur → on sait qui a vraiment la carte (et on stocke son `push_token` pour la phase 2).
- ✅ Écran de confirmation avec spinner « Ajout en cours… » → bascule en « Carte ajoutée ! » une fois confirmé.

## 5. Architecture technique (résumé)

- **Génération de carte** : le serveur construit `pass.json` par client et le **signe** avec le certificat Apple (Pass Type ID). Voir `lib/pass.ts`.
- **Identité Apple** : `pass.com.example.loyalty` / team `TEAMID1234`.
- **DB** : table `members` (`id`, `serial` unique, `name`, `points`, `created_at`, `registered_at`, `device_lib_id`, `push_token`).
- **Endpoints PassKit** : `/api/wallet/v1/...` (enregistrement appareil = détection d'ajout).
- Détails complets dans `CLAUDE.md`.

## 6. Cas à gérer (à décider avant de build « pour de vrai »)

### Récompense (atteinte des 10)
- **Réclamation** : quand le client arrive à 10/10, comment réclame-t-il ? (proposition : le resto ouvre sa fiche → bouton « Récompense utilisée » → remet à 0.)
- **Accumulation au-delà de 10** : s'il achète une 11ᵉ pizza avant d'avoir réclamé, on plafonne à 10 ou on cumule (11 = 1 offerte + 1 tampon) ? (proposition : cumuler, plus généreux.)
- **Historique** : garder le nombre total de pizzas offertes / achetées par client (stats, anti-abus).
- **Paliers multiples** (plus tard) : 5 = boisson, 10 = pizza, 20 = menu.

### Sécurité / anti-fraude ⚠️
- **FAILLE ACTUELLE** : la page `/m/[id]` (ajout de points) est **publique**. Le QR de la carte du client pointe dessus → **le client peut scanner sa propre carte et s'ajouter des points tout seul**. → Il faut **protéger la page resto** (code PIN, ou login employé, ou un secret dans l'URL connu du resto seul).
- **Annulation** : pouvoir retirer un point ajouté par erreur (bouton −1 / undo).
- **Comptes bidon** : un client peut créer plein de cartes avec de faux prénoms. Peu grave au début ; à surveiller.

### Identité & récupération de carte
- **Prénom seul = collisions** (plusieurs « Romain »). Pour l'ajout de points ce n'est pas un souci (on scanne la carte unique). Mais en cas de **perte / changement de téléphone**, comment le client récupère sa carte et ses points ?
  - Proposition : demander aussi un **numéro de téléphone** (ou email) à l'inscription → permet de retrouver et ré-émettre la carte.
- **Suppression de carte** : si le client retire la carte du Wallet, on le détecte (`registered_at` repassé à null). Décider si on garde ses points ou non.

### Opérations resto
- **Plusieurs employés** : tous utilisent la même page ? même PIN ?
- **Hors-ligne** : que se passe-t-il si pas de réseau au comptoir au moment d'ajouter un point ?
- **Mauvais client scanné** : confirmation visuelle claire (nom + photo/avatar) avant de valider.

### Mise à jour de la carte (important)
- Aujourd'hui : après ajout de points, le client doit **re-télécharger** sa carte pour voir le nouveau total.
- **Phase 2 (APNs)** : les points montent **tout seuls** sur la carte + notification push. Les `push_token` sont déjà collectés, l'infra est à moitié prête.

### Marketing / événements (phase 2+)
- Notif « ta pizza offerte est dispo ».
- Notif de **relance** d'un client inactif depuis X semaines.
- Notif **anniversaire** (si on collecte la date).
- **Événements spéciaux** : double points le mardi, offre flash, etc.
- **Parrainage** : un client en invite un autre → bonus.

### Légal / données (RGPD)
- On collecte prénom (+ tel/email si ajouté) → mention de consentement + possibilité de suppression des données.

### Couverture
- Actuellement **Apple Wallet uniquement**. Les clients **Android (Google Wallet)** ne sont pas couverts → segment important à prévoir.

## 7. Roadmap proposée

1. **Sécuriser la page resto** (bloquant — la faille ci-dessus).
2. Définir les règles de récompense (réclamation, reset, cumul).
3. **Phase 2 — mise à jour auto (APNs)** : points en temps réel + notifications.
4. Ajout téléphone/email + récupération de carte.
5. Notifications marketing (relance, promos, événements).
6. Google Wallet (Android).

## 8. Questions ouvertes

- Règle d'accumulation au-delà de 10 : plafond ou cumul ?
- Identité : prénom seul, ou prénom + téléphone dès le départ ?
- Protection de la page resto : PIN simple partagé, ou comptes employés ?
- Priorité : sécuriser + règles d'abord, ou foncer sur la mise à jour auto (APNs) ?
- Android (Google Wallet) : maintenant ou plus tard ?
