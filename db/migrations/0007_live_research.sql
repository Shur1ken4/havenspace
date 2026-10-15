-- Live research mode (ADR-10): an EXPERIMENT for the founders only, role-play
-- sessions only. While recording, short self-contained clips (live_mic,
-- live_tab, live_room) are transcribed one by one and deleted straight away;
-- the text goes to live_lines, and every ~30 s the AI writes a short read of
-- the session into live_insights. Not part of the product (see ADR-4).

alter table sessions add column live_research boolean not null default false;

alter table audio_chunks drop constraint audio_chunks_track_check;
alter table audio_chunks add constraint audio_chunks_track_check
  check (track in ('mic','tab','room','upload','calibration','dictation','live_mic','live_tab','live_room'));

-- Live clips are only accepted for sessions where live research was switched on
-- (the consent gate above still applies to them as to any other audio).
create or replace function enforce_live_chunk() returns trigger
language plpgsql as $$
begin
  if new.track like 'live\_%' and not exists (select 1 from sessions where id = new.session_id and live_research) then
    raise exception 'live_not_enabled' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger audio_chunks_live_gate before insert on audio_chunks
  for each row execute function enforce_live_chunk();

create table live_lines (
  id bigserial primary key,
  therapist_id text not null references therapists(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  seq integer not null,                -- which ~8 s clip it came from
  speaker text not null,               -- therapist | client | speaker
  offset_ms integer not null,          -- from the start of the recording
  text text not null,
  created_at timestamptz not null default now()
);
create index live_lines_session on live_lines(session_id, id);

create table live_insights (
  id bigserial primary key,
  therapist_id text not null references therapists(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  upto_line bigint not null,           -- the last live_lines.id the AI had seen
  offset_ms integer not null,
  content jsonb not null,
  model_id text not null,
  prompt_version text not null,
  created_at timestamptz not null default now()
);
create index live_insights_session on live_insights(session_id, id);

alter table live_lines enable row level security;
alter table live_lines force row level security;
create policy own_rows on live_lines using (therapist_id = app_current_user()) with check (therapist_id = app_current_user());
alter table live_insights enable row level security;
alter table live_insights force row level security;
create policy own_rows on live_insights using (therapist_id = app_current_user()) with check (therapist_id = app_current_user());
