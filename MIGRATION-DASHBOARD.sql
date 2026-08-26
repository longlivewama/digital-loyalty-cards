-- ============================================================
-- MIGRATION DASHBOARD — à coller dans Supabase > SQL Editor > Run
-- (une seule fois, au retour). Tout le dashboard s'active ensuite.
-- ============================================================

-- Réglages du resto (ligne unique id=1) : infos carte + seuil + offre courante
create table if not exists settings (
  id int primary key default 1,
  resto_name text not null default 'Pizzeria Esempio',
  address text not null default E'1 rue de l''Exemple\n33000 Bordeaux',
  phone text,
  hours text not null default E'Mar–Sam · 11h–14h · 18h–22h (22h30 ven-sam)\nDim · 18h–22h30 · Fermé le lundi',
  instagram text not null default 'https://www.instagram.com/pizzeria-esempio/',
  goal int not null default 10,
  offer_text text,
  offer_at timestamptz
);
insert into settings (id) values (1) on conflict (id) do nothing;

-- Journal des opérations (historique client, dernière visite, stats)
create table if not exists events (
  id bigint generated always as identity primary key,
  member_id uuid references members(id) on delete cascade,
  type text not null,            -- 'signup' | 'add' | 'remove' | 'claim'
  delta int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists events_member_idx on events(member_id, created_at desc);
create index if not exists events_created_idx on events(created_at desc);

-- Historique des campagnes de notifications
create table if not exists campaigns (
  id bigint generated always as identity primary key,
  message text not null,
  segment text not null default 'all',
  sent_count int not null default 0,
  created_at timestamptz not null default now()
);

-- Note libre par client
alter table members add column if not exists note text;

-- Dernier message ciblé reçu par le client (notif broadcast par carte)
alter table members add column if not exists push_msg text;

-- RLS (accès via service key uniquement, comme members)
alter table settings enable row level security;
alter table events enable row level security;
alter table campaigns enable row level security;
