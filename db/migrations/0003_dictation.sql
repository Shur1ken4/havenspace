-- Dictated recaps: the therapist's own voice, transcribed in our EU worker
-- (never a cloud speech service). No client voice, so no consent gate.
alter table audio_chunks drop constraint audio_chunks_track_check;
alter table audio_chunks add constraint audio_chunks_track_check
  check (track in ('mic','tab','room','upload','calibration','dictation'));

alter table jobs drop constraint jobs_kind_check;
alter table jobs add constraint jobs_kind_check
  check (kind in ('process_session','enrol_voice','supervision_pack','regenerate','transcribe_dictation'));

alter table sessions add column dictation_status text check (dictation_status in ('recording','transcribing','ready','failed'));
alter table sessions add column dictation_text text;

create or replace function enforce_chunk_consent() returns trigger
language plpgsql as $$
declare v_client uuid; v_mode text;
begin
  if new.session_id is null then return new; end if;
  select client_id, capture_mode into v_client, v_mode from sessions where id = new.session_id;
  if new.track = 'dictation' then
    if v_mode <> 'recap' then raise exception 'dictation_only_for_recap' using errcode = 'P0001'; end if;
    return new;
  end if;
  if v_mode = 'recap' or not client_has_active_consent(v_client) then
    raise exception 'consent_required' using errcode = 'P0001';
  end if;
  return new;
end $$;
