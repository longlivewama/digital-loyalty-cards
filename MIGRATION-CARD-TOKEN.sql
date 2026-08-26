-- #4 : jeton secret par carte (au lieu du serial devinable) — à lancer une fois
-- dans Supabase → SQL Editor. Idempotent, non destructif.
-- Avant migration l'app fonctionne (repli sur l'ancien jeton). Après, chaque
-- carte bascule sur son jeton secret à son 1er rafraîchissement (rotation douce
-- gérée dans lib/cardAuth.ts), puis l'ancien jeton est refusé pour elle.

alter table members add column if not exists auth_token text;
alter table members add column if not exists token_rotated boolean not null default false;

-- Jeton secret aléatoire pour les cartes déjà existantes. token_rotated reste
-- false : l'ancien jeton (serial complété) est encore accepté le temps que la
-- carte télécharge sa version à jour, puis refusé automatiquement.
update members set auth_token = gen_random_uuid()::text where auth_token is null;
