-- Anti-force-brute sur le PIN commerçant (/api/auth).
-- Compte les essais ratés par IP ; le code pose un blocage de 15 min après 5 échecs.
-- Idempotent. À lancer une fois dans Supabase → SQL Editor.
-- Tant que cette table n'existe pas, l'app fonctionne mais SANS protection
-- (fail-open) : lance-la pour activer le blocage.

create table if not exists login_attempts (
  ip           text primary key,
  count        int not null default 0,
  first_at     timestamptz not null default now(),
  locked_until timestamptz
);

-- Accès réservé au service role (le serveur bypasse RLS). On active RLS sans
-- policy publique : personne d'autre ne peut lire/écrire la table.
alter table login_attempts enable row level security;
