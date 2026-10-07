-- Coffee shop + Google Wallet. Idempotent and non-destructive: safe to run on
-- an existing wallet-loyalty database (same content as
-- MIGRATION-COFFEE-GOOGLE-WALLET.sql at the repository root).

-- Columns the app always relied on (no-ops when they already exist).
alter table members add column if not exists phone text;
alter table members add column if not exists total_earned int not null default 0;
alter table members add column if not exists updated_at timestamptz not null default now();

-- Google Wallet: the loyalty object id of this member's card. One card per
-- member; the stamp balance stays in members.points (single source of truth).
alter table members add column if not exists google_object_id text;
create unique index if not exists members_google_object_idx
  on members (google_object_id) where google_object_id is not null;

-- Buy 9 coffees, the 10th is free: 9 stamps = 1 free coffee.
alter table settings alter column goal set default 9;
update settings set goal = 9 where id = 1 and goal = 10;

-- Replace the pizzeria placeholder details, but only while they are untouched.
alter table settings alter column resto_name set default 'Coffee Shop';
update settings
   set resto_name = 'Coffee Shop',
       address    = E'1 Example Street\nYour City',
       hours      = E'Mon–Fri · 7am–6pm\nSat–Sun · 8am–5pm',
       instagram  = 'https://www.instagram.com/'
 where id = 1 and resto_name = 'Pizzeria Esempio';

-- Only the server (service_role) may call the stamp functions.
revoke execute on function change_points(uuid, int, int) from public, anon, authenticated;
revoke execute on function claim_reward(uuid, int) from public, anon, authenticated;
grant execute on function change_points(uuid, int, int) to service_role;
grant execute on function claim_reward(uuid, int) to service_role;
