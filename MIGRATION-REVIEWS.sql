-- ============================================================
-- MIGRATION AVIS GOOGLE — à coller dans Supabase > SQL Editor > Run
-- (une seule fois). Active la relance auto "laisse un avis Google".
-- Idempotent : peut être relancé sans danger.
-- ============================================================

-- 1) Réglages de la feature (sur la ligne unique settings id=1)
alter table settings add column if not exists review_enabled   boolean     not null default false;
alter table settings add column if not exists review_url        text;                         -- lien d'avis Google du resto
alter table settings add column if not exists review_delay_min  int         not null default 17;   -- délai après le scan avant la notif
alter table settings add column if not exists review_max_nudges int         not null default 1;    -- nb max de relances par client (1 = une seule fois)
alter table settings add column if not exists review_nudge_text text;                         -- message de la notif (null = texte par défaut)

-- 2) État par client
alter table members add column if not exists review_prompted_at timestamptz;   -- dernière relance envoyée
alter table members add column if not exists reviewed_at         timestamptz;   -- a cliqué le lien d'avis (→ on ne relance plus jamais)
alter table members add column if not exists review_nudges       int not null default 0;  -- nb de relances déjà envoyées

create index if not exists members_review_idx on members(reviewed_at, review_prompted_at);

-- ============================================================
-- 3) PLANIFICATEUR GRATUIT (pg_cron + pg_net, intégré à Supabase)
--    Toutes les minutes, Supabase "sonne" l'app Vercel ; l'app regarde
--    qui a été scanné il y a ~17 min et n'a pas encore été relancé.
--    => "17 min après le scan" SANS payer Vercel Pro.
--
--    ⚠️ AVANT DE LANCER, remplace les 2 valeurs ci-dessous :
--      - <TON_URL>        ex: https://wallet-loyalty.vercel.app
--      - <TON_CRON_SECRET> la même valeur que la variable CRON_SECRET sur Vercel
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- supprime l'ancienne planif si elle existe (re-run safe)
select cron.unschedule('review-nudge')
where exists (select 1 from cron.job where jobname = 'review-nudge');

select cron.schedule('review-nudge', '* * * * *', $CRON$
  select net.http_post(
    url     := '<TON_URL>/api/cron/review-nudge',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <TON_CRON_SECRET>',
      'Content-Type',  'application/json'
    ),
    body    := '{}'::jsonb
  );
$CRON$);

-- Vérifs utiles :
--   select * from cron.job;                              -- la planif existe ?
--   select * from cron.job_run_details order by start_time desc limit 5;  -- ça tourne ?
--   select * from net._http_response order by created desc limit 5;       -- réponses de l'app
