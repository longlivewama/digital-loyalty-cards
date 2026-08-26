-- Profil client enrichi : nom de famille + date de naissance.
-- Idempotent. À lancer dans Supabase → SQL Editor. ~30s pour le rechargement
-- du cache PostgREST avant que /api/join stocke réellement ces champs.

alter table members add column if not exists last_name text;
alter table members add column if not exists birthday  date;
