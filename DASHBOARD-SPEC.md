> **Historical note:** original planning notes (in French) from the pizzeria version of this project. The current product is a coffee shop card: **9 stamps = 1 free coffee**, Apple Wallet + Google Wallet. See README.md for current behaviour.

# Espace commerçant — spécification complète

Tout ce que le dashboard doit contenir. Statut : ✅ fait · 🔨 à construire · 🕒 plus tard.

---

## 0. Accès / compte
- ✅ Connexion par **PIN** partagé (cookie 30 j).
- 🔨 Bouton **Déconnexion**.
- 🔨 **Changer le PIN** depuis les réglages.
- 🕒 Comptes employés distincts (traçabilité).

## 1. Home / vue d'ensemble
Page d'accueil après connexion. Doit donner l'état du programme en un coup d'œil + accès rapide.
- 🔨 **KPIs** : membres totaux · cartes actives (ajoutées au Wallet) · pizzas distribuées · récompenses données · nouveaux cette semaine.
- 🔨 **Raccourcis** gros boutons : **Scanner une carte**, **Envoyer une notif**, **Voir les membres**.
- 🔨 **Activité récente** : derniers +1, dernières inscriptions, dernières récompenses.
- 🕒 Mini-graphe inscriptions / visites (7-30 j).

## 2. Scanner & ajouter des pizzas
- ✅ Scanner le **QR d'une carte client** (appareil photo) → ouvre la **fiche client** `/m/[id]` (protégée PIN). Si l'appareil est déjà connecté (cookie PIN) → ouvre direct la page d'ajout. **C'est déjà ce que tu décris.**
- 🔨 Bouton **« Scanner »** dans l'app qui ouvre la **caméra dans le navigateur** (pas besoin de quitter l'app) + décodage QR → fiche. *(confort ; le scan natif marche déjà)*
- ✅ Ajout **+1 / +N / −1 / récompense utilisée**.
- ✅ **Recherche** d'un client par nom (si pas de carte sous la main).

## 3. Fiche client
- ✅ Nom, tampons, récompenses dispo, total cumulé, **+1/+N/−1/claim**.
- 🔨 **Téléphone, date d'inscription, dernière visite**.
- 🔨 **Historique** des opérations du client (+1, récompenses, dates).
- 🔨 **Note libre** (« allergique », « habitué du midi »…).
- 🕒 Supprimer / bloquer un client.

## 4. Membres
- ✅ Liste + recherche.
- 🔨 **Tri** : récents · plus de points · **inactifs** (relance).
- 🔨 **Filtres** : cartes actives/inactives · récompense dispo · proches du palier.
- 🔨 **Export CSV** (récupérer sa base = argument clé vs Uber/Deliveroo).
- 🕒 Import / fusion de doublons.

## 5. Notifications / marketing (broadcast) 🔨 GROS morceau
Envoyer un message push à **toutes les cartes** (ou un segment).
- 🔨 **Composer une notif** : texte court → push lock-screen à toutes les cartes actives. Ex. « Ce soir −20% sur les calzones 🍕 ».
  - *Tech* : on met à jour un **champ "offre"** sur chaque carte + `changeMessage` + push APNs. (Le push est déjà en place.)
- 🔨 **Segments** : tous · actifs · **inactifs depuis X** (relance) · récompense dispo · proches du palier.
- 🔨 **Historique des campagnes** (quoi, quand, combien touchés).
- 🕒 **Programmer** une notif (cron) — ex. tous les vendredis midi.
- 🕒 **Anniversaire** auto (si date collectée).

## 6. Réglages du resto
- 🔨 Éditer **infos resto** (nom, adresse, tél, horaires, Instagram) → **reflétées sur la carte** automatiquement.
- 🔨 **Seuil de récompense** (10 par défaut) configurable.
- 🔨 **QR d'inscription à imprimer** (affichette comptoir) + lien `/join`.
- 🕒 Couleurs / logo de la carte.
- 🕒 Message d'offre par défaut.

## 7. Analytics 🕒
- Inscriptions dans le temps, taux d'activation (ajoutée/inscrite), rétention, fréquence de visite, top clients, estimation CA fidélité.

---

## Récap priorités proposées

**Lot 1 — Dashboard utilisable (le cœur)**
1. Home avec KPIs + raccourcis + activité récente
2. Navigation propre entre les pages (+ déconnexion)
3. Fiche client enrichie (historique, dernière visite)

**Lot 2 — Marketing (la valeur business)**
4. Broadcast notif à toutes les cartes (+ segments inactifs / récompense dispo)
5. Historique campagnes

**Lot 3 — Gestion**
6. Membres : tri/filtres + **export CSV**
7. Réglages resto (infos carte éditables, QR à imprimer)

**Lot 4 — Plus tard**
8. Analytics, scanner in-app, comptes employés, notifs programmées, anniversaire
