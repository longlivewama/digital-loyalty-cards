-- Defense in depth: only the server (service_role) may call the stamp
-- functions. RLS already makes them no-ops for anon/authenticated (no policy
-- on members), but Postgres grants EXECUTE to PUBLIC by default.
revoke execute on function change_points(uuid, int, int) from public, anon, authenticated;
revoke execute on function claim_reward(uuid, int) from public, anon, authenticated;
grant execute on function change_points(uuid, int, int) to service_role;
grant execute on function claim_reward(uuid, int) to service_role;
