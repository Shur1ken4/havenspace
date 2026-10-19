-- The worker processes every therapist's jobs. Locally it uses a role with
-- BYPASSRLS; some managed Postgres providers (e.g. Neon) may not allow that,
-- so the worker is also given explicit row-level-security policies. The web
-- app's role (app_user) is unaffected and still sees only its own rows.
do $$
declare t text;
begin
  foreach t in array array['clients','consents','sessions','audio_chunks','transcript_segments','notes',
                           'reflections','client_timeline_items','supervision_packs','supervision_hours',
                           'jobs','feedback','live_lines','live_insights','therapists','audit_log']
  loop
    if exists (select 1 from pg_roles where rolname = 'worker_user') then
      execute format('create policy worker_all on %I to worker_user using (true) with check (true)', t);
    end if;
  end loop;
end $$;
