-- Pilot access (ADR-11), closing a gap: an account whose access is paused or
-- declined after approval could still upload audio to an older draft session
-- and queue processing (which spends AI and speech-to-text time). Now the app
-- can only add audio or jobs for approved therapists. Reading and exporting
-- their own data is unaffected (GDPR).
--
-- Not SECURITY DEFINER on purpose: current_user must be the caller, so the
-- worker (which also inserts jobs) is never blocked.
create or replace function enforce_access_app() returns trigger
language plpgsql as $$
begin
  if current_user = 'app_user'
     and not exists (select 1 from therapists where id = new.therapist_id and access_status = 'approved') then
    raise exception 'access_pending' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger audio_chunks_access_gate before insert on audio_chunks for each row execute function enforce_access_app();
create trigger jobs_access_gate before insert on jobs for each row execute function enforce_access_app();
