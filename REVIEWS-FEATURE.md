> **Historical note:** original planning notes (in French) from the pizzeria version of this project. The current product is a coffee shop card: **9 stamps = 1 free coffee**, Apple Wallet + Google Wallet. See README.md for current behaviour.

# Avis Google auto — relance post-visite

Nudge automatique qui invite le client à laisser un avis Google après son passage.
But : faire **grimper le volume d'avis** (le resto est déjà à ~4,9★).

## Ce que ça fait, concrètement

1. Le client se fait scanner au comptoir (un `+1` tampon).
2. **~17 min plus tard**, son iPhone reçoit une notif : « On espère que vous vous êtes régalé ! 🍕 Un avis ⭐️ nous aiderait… ».
3. Il ouvre sa carte → au **dos** il y a un lien **« ⭐️ Laisser un avis Google »**.
4. Il clique → on l'envoie sur la vraie page d'avis Google **et** on retient qu'il a cliqué.
5. **On ne le relance plus jamais** (par défaut : une seule relance, point).

Le lien au dos est **permanent** : même sans notif, le client peut laisser un avis quand il veut.

## Le truc malin : "17 min après" SANS payer Vercel

Problème : Vercel gratuit ne peut lancer une tâche programmée qu'**1×/jour**. Or on veut sonner toutes les minutes pour viser « 17 min après le scan ».

Solution : **Supabase** (la base de données, déjà là) sait se réveiller tout seul toutes les minutes (`pg_cron`) et appeler l'app Vercel (`pg_net`). C'est Supabase qui « sonne », pas Vercel → **ça reste 100 % gratuit**. À chaque sonnerie, l'app regarde qui a été scanné il y a ~17 min et pas encore relancé, et envoie la notif.

Filet de secours : Vercel lance aussi la même route **1×/jour** (gratuit) au cas où Supabase aurait un trou.

## Comment ça marche (technique)

- **Déclencheur de la notif** = on réutilise le mécanisme broadcast déjà rodé : on écrit un message sur la carte du client (`members.push_msg`), ce qui fait **changer la valeur** d'un champ de la face avant → iOS affiche la notif lock-screen (fiable). Le dos affiche le texte complet + le lien.
- **Détection du clic** = le lien au dos pointe sur `/r/[id]` (notre serveur), pas direct sur Google. On note `reviewed_at`, puis on redirige (302) vers le vrai lien Google. Donc tout clic (depuis la notif **ou** le dos) coupe les relances.
- **Anti-spam** : 3 garde-fous par client — a déjà cliqué (`reviewed_at`), plafond de relances atteint (`review_nudges` ≥ `review_max_nudges`, défaut **1**), ou relancé il y a moins de 14 j.

## Fichiers

| Fichier | Rôle |
|---|---|
| `MIGRATION-REVIEWS.sql` | Colonnes DB + planificateur Supabase (pg_cron). **À lancer une fois.** |
| `lib/reviews.ts` | Cœur : `sendReviewNudges()` (qui relancer + push) et `markReviewed()` (clic). |
| `app/api/cron/review-nudge/route.ts` | Route appelée par Supabase (chaque min) + Vercel (1×/j). Protégée par `CRON_SECRET`. |
| `app/r/[id]/route.ts` | Lien d'avis tracké : note le clic → redirige vers Google. |
| `lib/pass.ts` | Ajoute le lien « Laisser un avis » permanent au dos de la carte. |
| `lib/settings.ts` | Réglages : `review_enabled`, `review_url`, `review_delay_min`, `review_max_nudges`, `review_nudge_text`. |
| `app/dashboard/settings` | Panneau « Avis Google ⭐️ » pour tout régler. |
| `vercel.json` | Cron Vercel quotidien (filet de secours). |

## Mise en route — 3 étapes manuelles

### 1. Variable `CRON_SECRET` (mot de passe de la route cron)

Empêche n'importe qui de déclencher les relances depuis l'extérieur.

```bash
# en local : ajoute à wallet-loyalty/.env.local
CRON_SECRET=<redacted — generate your own with: openssl rand -hex 24>

# sur Vercel (production)
openssl rand -hex 24 | vercel env add CRON_SECRET production   # value redacted
```

(Vercel envoie automatiquement ce jeton à la route lors de son cron quotidien.)

### 2. Lancer la migration SQL

Ouvre `MIGRATION-REVIEWS.sql`, **remplace les 2 placeholders** en bas :
- `<TON_URL>` → `https://wallet-loyalty.vercel.app`
- `<TON_CRON_SECRET>` → la même valeur que `CRON_SECRET` ci-dessus

Puis colle tout dans **Supabase → SQL Editor → Run**. (Active les extensions `pg_cron`/`pg_net` si Supabase le demande : Database → Extensions.)

### 3. Récupérer + coller le lien d'avis Google

C'est le **seul vrai bloquant**. Où trouver le lien :

**Option simple (compte Google Business sur mobile) :**
1. Ouvre l'app **Google Business Profile** (ou cherche le resto sur Google en étant connecté au compte du resto).
2. Bouton **« Demander des avis »** / **« Obtenir plus d'avis »**.
3. Google donne un lien court du type `https://g.page/r/XXXXXXXX/review` → **c'est lui**.

**Option PlaceID (si pas d'accès au compte) :**
1. Va sur le [Place ID Finder de Google](https://developers.google.com/maps/documentation/places/web-service/place-id), cherche « Pizzeria Esempio Bordeaux », copie le **Place ID**.
2. Le lien devient : `https://search.google.com/local/writereview?placeid=LE_PLACE_ID`.

Ensuite : **Dashboard → Réglages → Avis Google** → colle le lien, coche « Activer », **Enregistrer**.
Tant que le lien est vide, la feature reste inactive (et le lien au dos n'apparaît pas).

## Réglages (Dashboard → Réglages → Avis Google)

- **Activer la relance avis** : on/off.
- **Lien d'avis Google** : l'URL ci-dessus.
- **Délai après la visite (min)** : défaut **17**.
- **Nombre max de relances par client** : défaut **1** (= une seule fois ; mets 2-3 pour relancer ceux qui n'ont pas cliqué, espacé de 14 j).
- **Message de la notification** : texte libre (120 car. max), sinon un texte par défaut.

## Tester

- **Sans iPhone** : `curl` la route avec le bon jeton →
  ```bash
  curl -X POST https://wallet-loyalty.vercel.app/api/cron/review-nudge \
    -H "Authorization: Bearer <CRON_SECRET>"
  # → {"ok":true,"sent":N,"candidates":M,...}
  ```
- **Avec iPhone** : ajoute une carte, fais-toi un `+1`, attends ~17 min (ou baisse le délai à 1 min le temps du test) → la notif doit tomber. Ouvre la carte, clique le lien au dos → tu dois arriver sur Google, et un 2ᵉ passage à la route ne doit plus te relancer.
- Logs : `vercel logs wallet-loyalty.vercel.app --follow` → cherche `[REVIEW-NUDGE]`.
- Supabase a bien sonné ? `select * from cron.job_run_details order by start_time desc limit 5;`

## Limites

- APNs reste **best-effort** (pas de garantie 100 % de livraison) — comme le reste des notifs Wallet.
- La détection du clic suppose que le client passe par le lien `/r/[id]` (notif ou dos de carte). S'il va sur Google par un autre chemin, on ne le sait pas → il pourrait recevoir 1 relance de plus (borné par `review_max_nudges`).
- Pas de vérification que l'avis est *réellement* posté (Google ne le dit pas) — on détecte le **clic**, pas la publication.
