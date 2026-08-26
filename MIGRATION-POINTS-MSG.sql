-- À lancer une fois dans Supabase → SQL Editor. Idempotent.
-- L'app fonctionne avant migration (repli non-atomique + message sans expiration),
-- mais lance-la pour activer les correctifs #5 et #7.

-- #7 : horodatage de la dernière écriture du message ciblé (offre / relance avis).
-- Le code masque le message sur la carte après 30 jours (fini le message collé).
alter table members add column if not exists push_msg_at timestamptz;

-- #5 : ajout/retrait de points ATOMIQUE (évite la perte de tampon si deux scans
-- arrivent en même temps). Retourne le nouveau solde de points.
create or replace function change_points(p_id uuid, p_delta int, p_earned int)
returns int
language sql
as $$
  update members
     set points = greatest(0, points + p_delta),
         total_earned = greatest(0, total_earned + p_earned),
         updated_at = now()
   where id = p_id
  returning points;
$$;

-- #5 : réclamation de récompense ATOMIQUE : ne soustrait le palier QUE si le
-- solde suffit (empêche la double-réclamation d'une même récompense).
-- Retourne le nouveau solde, ou NULL si pas assez de points / id inconnu.
create or replace function claim_reward(p_id uuid, p_goal int)
returns int
language sql
as $$
  update members
     set points = points - p_goal,
         updated_at = now()
   where id = p_id and points >= p_goal
  returning points;
$$;
