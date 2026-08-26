-- À coller dans Supabase > SQL Editor > Run
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  serial text unique not null,
  name text not null,
  points int not null default 0,
  created_at timestamptz not null default now()
);

-- Détection d'ajout au Wallet (callback PassKit) + push APNs (phase 2)
alter table members add column if not exists registered_at timestamptz;
alter table members add column if not exists device_lib_id text;
alter table members add column if not exists push_token text;

-- Index pour lookups rapides
create index if not exists members_serial_idx on members (serial);

-- RLS : on garde l'accès uniquement via la clé service_role (côté serveur).
alter table members enable row level security;
-- (aucune policy publique : tout passe par le backend Next.js avec service_role)
