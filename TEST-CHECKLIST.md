> **Historical note:** original planning notes (in French) from the pizzeria version of this project. The current product is a coffee shop card: **9 stamps = 1 free coffee**, Apple Wallet + Google Wallet. See README.md for current behaviour.

# Checklist de test — MVP (Mac + iPhone)

URL : https://wallet-loyalty.vercel.app · PIN resto : **210110**

Coche au fur et à mesure. Le résultat attendu est indiqué à chaque étape.

---

## Phase 0 — Préparation
- [ ] Sur le **Mac** : ouvrir https://wallet-loyalty.vercel.app/dashboard dans Safari/Chrome.
- [ ] Il demande le **PIN** → entrer `210110` → « Déverrouiller ».
- [ ] Résultat : tableau de bord avec stats (Membres / Cartes actives / Pizzas cumulées) + liste. **Laisser cet onglet ouvert** pour suivre en direct.

## Phase 1 — Inscription client (iPhone)
- [ ] Sur l'**iPhone** : ouvrir Safari → https://wallet-loyalty.vercel.app/join
- [ ] Entrer un **prénom** (ex. `Romain`) + un **téléphone** (ex. `0612345678`).
- [ ] Toucher **« Ajouter à Apple Wallet »**.
- [ ] Résultat : page avec **spinner « Ajout en cours… »**, puis la feuille Apple Wallet apparaît.
- [ ] Toucher **« Ajouter »** (en haut à droite de la feuille Wallet).
- [ ] Revenir à Safari : la page doit basculer en **« ✅ Carte ajoutée ! »** en ~2-5 s (= détection d'ajout réelle).

## Phase 2 — Vérifier la carte dans Wallet (iPhone)
- [ ] Ouvrir l'app **Cartes (Wallet)** → la carte « Pizzeria Esempio » est là.
- [ ] Recto : logo, **0/10**, tampons `○○○…`, « 🎁 Pizza offerte », ton prénom, QR.
- [ ] Toucher le bouton **•••** (haut droite) → la carte **se retourne** : règles, spécialités, adresse Bordeaux, horaires, Instagram, « Champion du Monde 2016 ».
- [ ] **Double-clic sur le bouton latéral** (celui de paiement) → la carte de fidélité apparaît dans la pile.

## Phase 3 — Ajouter des points (Mac = resto, iPhone = carte client)
- [ ] Sur le **Mac dashboard** : rafraîchir → le nouveau membre apparaît dans la liste.
- [ ] Cliquer dessus → fiche client (nom, tél, **0/10**, Total cumulé : 0).
- [ ] Cliquer **« +1 pizza 🍕 »** → passe à **1/10**, Total 1.
- [ ] Dans le champ nombre, mettre **5** → **« Ajouter »** → passe à **6/10**, Total 6.
- [ ] Cliquer **« −1 (annuler) »** → repasse à **5/10**, Total 5.

## Phase 4 — Voir les points à jour sur la carte (iPhone)
- [ ] Sur la fiche client (Mac), cliquer **« Carte à jour (re-télécharger) »** — OU sur iPhone, scanner à nouveau le QR de la carte et ouvrir le lien.
- [ ] Sur l'iPhone, la feuille Wallet propose de **mettre à jour** la carte → confirmer.
- [ ] Résultat : la carte dans Wallet affiche maintenant **5/10**, tampons `●●●●●○○○○○`.
  > Note : en MVP la mise à jour est **manuelle** (re-téléchargement). L'auto-update temps réel = phase APNs.

## Phase 5 — Récompense (atteindre 10)
- [ ] Sur le Mac : ajouter assez de pizzas pour **dépasser 10** (ex. +5 → 10, ou +7 → 12).
- [ ] Résultat fiche : bandeau **« 🎉 1 pizza offerte à donner ! »**, la carte passe en **vert**.
- [ ] Re-télécharger la carte sur iPhone → fond **vert**, « 🎉 1 pizza offerte ! ».
- [ ] Sur le Mac : cliquer **« Récompense utilisée (−10) »** → le compteur retombe (ex. 12 → 2/10), le surplus est **conservé**.

## Phase 6 — Sécurité (le test important)
- [ ] Sur l'**iPhone**, ouvrir une fenêtre Safari **privée** (pas de cookie) → scanner le QR de ta propre carte (ou coller l'URL `/m/...`).
- [ ] Résultat : tu es **redirigé vers la page PIN** 🔒 — impossible d'ajouter des points sans le code. ✅ (C'est ce qui empêche un client de tricher.)
- [ ] Entrer un **mauvais PIN** (ex. `0000`) → « Code incorrect ».
- [ ] Entrer `210110` → accès à la fiche.

## Phase 7 — Cas limites (optionnel)
- [ ] **Suppression de carte** : dans Wallet, supprimer la carte → sur le dashboard, après un moment, « Cartes actives » diminue (détection du retrait).
- [ ] **2 clients même prénom** : refaire une inscription avec le même prénom → 2 cartes distinctes (serials différents), pas de confusion.
- [ ] **Géolocalisation** : *(testable uniquement à proximité du resto — l'adresse du commerce)* en passant à ~150 m, la carte remonte sur l'écran verrouillé. **Non testable depuis chez toi.**

---

## Récap résultats attendus

| Fonctionnalité | OK ? |
|---|---|
| Inscription + tél | ☐ |
| Carte ajoutée au Wallet | ☐ |
| Détection d'ajout (spinner → validé) | ☐ |
| Recto + dos (flip) | ☐ |
| +1 / +N / −1 | ☐ |
| Mise à jour carte (re-téléchargement) | ☐ |
| Cumul + récompense + reset (−10) | ☐ |
| PIN bloque les clients | ☐ |
