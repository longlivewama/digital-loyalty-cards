-- Baseline schema for wallet-loyalty, assembled from the original files
-- (supabase-schema.sql + MIGRATION-*.sql) in a order that works on an empty
-- database. The root SQL files are kept unchanged as history.
--
-- Also adds three members columns the app has always used but that no
-- original SQL file created (phone, total_earned, updated_at): /api/join
-- inserts them and change_points() updates them, so without them signup and
-- the atomic stamp functions fail on a fresh database.

-- ---- supabase-schema.sql --------------------------------------------------
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  serial text unique not null,
  name text not null,
  points int not null default 0,
  created_at timestamptz not null default now()
);
-- Apple Wallet registration callback + APNs push
alter table members add column if not exists registered_at timestamptz;
alter table members add column if not exists device_lib_id text;
alter table members add column if not exists push_token text;
create index if not exists members_serial_idx on members (serial);
-- RLS on, no public policy: only the server (service_role) reaches the data.
alter table members enable row level security;

-- ---- Columns used by the app but missing from the original SQL ------------
alter table members add column if not exists phone text;
alter table members add column if not exists total_earned int not null default 0;
alter table members add column if not exists updated_at timestamptz not null default now();
-- The Wallet "list updated passes" endpoint filters on device + updated_at.
create index if not exists members_device_idx on members (device_lib_id, updated_at);

-- ---- MIGRATION-DASHBOARD.sql ----------------------------------------------
create table if not exists settings (
  id int primary key default 1,
  resto_name text not null default 'Coffee Shop',
  address text not null default E'1 Example Street\nYour City',
  phone text,
  hours text not null default E'Mon–Fri · 7am–6pm\nSat–Sun · 8am–5pm',
  instagram text not null default 'https://www.instagram.com/',
  goal int not null default 9,
  offer_text text,
  offer_at timestamptz
);
insert into settings (id) values (1) on conflict (id) do nothing;

create table if not exists events (
  id bigint generated always as identity primary key,
  member_id uuid references members(id) on delete cascade,
  type text not null,            -- 'signup' | 'add' | 'remove' | 'claim'
  delta int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists events_member_idx on events(member_id, created_at desc);
create index if not exists events_created_idx on events(created_at desc);

create table if not exists campaigns (
  id bigint generated always as identity primary key,
  message text not null,
  segment text not null default 'all',
  sent_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table members add column if not exists note text;
alter table members add column if not exists push_msg text;

alter table settings enable row level security;
alter table events enable row level security;
alter table campaigns enable row level security;

-- ---- MIGRATION-PROFILE.sql ------------------------------------------------
alter table members add column if not exists last_name text;
alter table members add column if not exists birthday  date;

-- ---- MIGRATION-CARD-TOKEN.sql ---------------------------------------------
alter table members add column if not exists auth_token text;
alter table members add column if not exists token_rotated boolean not null default false;
update members set auth_token = gen_random_uuid()::text where auth_token is null;

-- ---- MIGRATION-POINTS-MSG.sql ---------------------------------------------
alter table members add column if not exists push_msg_at timestamptz;

-- Atomic add/remove: two simultaneous scans cannot overwrite each other.
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

-- Atomic claim: subtracts the goal only if the balance covers it, so the same
-- reward cannot be claimed twice. Returns the new balance or NULL.
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

-- ---- MIGRATION-LOGIN-RATELIMIT.sql ----------------------------------------
create table if not exists login_attempts (
  ip           text primary key,
  count        int not null default 0,
  first_at     timestamptz not null default now(),
  locked_until timestamptz
);
alter table login_attempts enable row level security;

-- ---- MIGRATION-REVIEWS.sql (sections 1 and 2) -----------------------------
-- Section 3 (pg_cron schedule) needs your deployed URL and CRON_SECRET, so it
-- is not part of the automatic migrations; run it by hand in production.
alter table settings add column if not exists review_enabled   boolean not null default false;
alter table settings add column if not exists review_url        text;
alter table settings add column if not exists review_delay_min  int     not null default 17;
alter table settings add column if not exists review_max_nudges int     not null default 1;
alter table settings add column if not exists review_nudge_text text;

alter table members add column if not exists review_prompted_at timestamptz;
alter table members add column if not exists reviewed_at         timestamptz;
alter table members add column if not exists review_nudges       int not null default 0;
create index if not exists members_review_idx on members(reviewed_at, review_prompted_at);
