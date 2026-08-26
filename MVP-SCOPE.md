# MVP — Périmètre à construire

Document court et figé : ce qu'on build **maintenant**, et ce qu'on ne build **pas** (volontairement reporté). Le concept complet est dans `MVP.md`.

Règle d'or : aller à l'essentiel. Tout ce qui n'est pas ici = phase suivante.

---

## Objectif du MVP

Un client s'inscrit en 10 s via un QR au comptoir et obtient sa carte dans Apple Wallet. Le restaurant, depuis un **tableau de bord protégé par PIN**, scanne la carte du client et lui ajoute des pizzas. À 10 tampons → pizza offerte.

## ✅ Dans le MVP

### 1. Inscription client *(déjà fait, + ajout tél optionnel)*
- QR au comptoir → page `/join` → **prénom** (obligatoire) + **téléphone (optionnel)** → carte ajoutée au Wallet.
- Le téléphone sert uniquement à récupérer les points en cas de besoin. (Rappel : la carte revient seule via iCloud si le client garde le même Apple ID.)
- Carte aux couleurs du resto, géolocalisation ~150 m, détection d'ajout réel : **déjà en place**.

### 2. Tableau de bord resto (protégé par PIN)
- **Accès** : un **PIN partagé** (4-6 chiffres). Saisi une fois sur l'appareil, mémorisé (cookie). Protège toutes les pages resto.
- **Scanner une carte client** → ouvre la fiche de ce client.
- **Fiche client** :
  - Stats : tampons en cours, pizzas offertes disponibles, total de pizzas achetées.
  - Boutons : **+1**, **+N** (saisir une quantité, ex. commande de 5), **−1** (annuler une erreur).
  - **« Récompense utilisée »** quand une pizza offerte est donnée.
- *(Optionnel si le temps le permet)* : liste des membres.

### 3. Règles de récompense — **cumul**
- Ajout de N pizzas : `points += N`.
- Pizzas offertes disponibles : `floor(points / 10)`.
- Réclamer une récompense : `points -= 10` (on garde le surplus, jamais perdu).
- La carte affiche les tampons du cycle en cours (`points % 10`) + indication si une pizza est offerte.

### 4. Mise à jour de la carte — **automatique (APNs)** ✅
- Le commerçant ajoute des points → la carte du client se met à jour **toute seule** sur son iPhone en quelques secondes, sans rien faire.
- Push APNs authentifié par le certificat Pass Type ID (aucune clé `.p8` en plus). Endpoints PassKit `/api/wallet/v1/...` en place.

## ❌ Hors MVP (reporté, dans l'ordre de priorité)

1. **Mise à jour automatique (APNs)** : points en temps réel sur la carte + notifications push. Les `push_token` sont déjà collectés → infra à moitié prête. *C'est la priorité juste après le MVP.*
2. **Notifications marketing** : relance client inactif, anniversaire, événements (double points le mardi…).
3. **Comptes employés** (traçabilité) — le PIN partagé suffit pour l'instant.
4. **Google Wallet (Android)** — Apple uniquement pour le MVP.
5. **Paliers multiples** (5 = boisson, 20 = menu), **parrainage**.
6. **RGPD formalisé** — au-delà d'une mention de consentement basique.

## Critère de « MVP terminé »

- [ ] Un client s'inscrit (prénom + tel optionnel) et a sa carte dans Wallet.
- [ ] Le resto entre son PIN une fois.
- [ ] Le resto scanne la carte d'un client et voit ses stats.
- [ ] Le resto ajoute 1 ou N pizzas ; peut annuler (−1).
- [ ] À ≥10 points, une pizza offerte est signalée ; « Récompense utilisée » décrémente de 10.
- [ ] Le client peut re-télécharger sa carte à jour.

## Décisions figées

| Sujet | Décision |
|---|---|
| Sécurité dashboard | **PIN partagé** |
| Au-delà de 10 | **Cumul** (`points -= 10` à la réclamation) |
| Identité | **Prénom obligatoire + téléphone optionnel** |
| Mise à jour carte | **Manuelle (re-téléchargement)** pour le MVP |
| Android | **Hors MVP** |
| Mise à jour auto (APNs) | **Hors MVP**, priorité n°1 ensuite |

## Changements techniques à faire pour ce MVP

- Ajouter colonne `phone` (text, nullable) à `members`.
- Champ téléphone optionnel sur `/join`.
- PIN : variable d'env `MERCHANT_PIN` + page `/dashboard` de saisie + cookie + protection des routes `/m/...`.
- Fiche client : passer la logique à **cumul** (rewards = `floor(points/10)`, claim = `-10`), ajouter `+N` et `−1`.
- (Le total acheté peut être déduit ou stocké via une colonne `total_earned` incrémentée à chaque ajout.)
