-- Core application tables.
-- Every table holding therapist or client data carries therapist_id and has
-- row-level security (RLS) forced on, so the web app's database role can only
-- ever see rows where therapist_id = the signed-in user (set per transaction
-- via set_config('app.user_id', ...)). See docs/privacy-architecture.md.

create extension if not exists pgcrypto;

create or replace function app_current_user() returns text
language sql stable as $$ select nullif(current_setting('app.user_id', true), '') $$;

create or replace function touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- Therapist profile (1:1 with auth "user")
create table therapists (
  id text primary key references "user"(id) on delete cascade,
  display_name text not null default '',
  profession text check (profession in ('counsellor','psychotherapist','psychologist','other')),
  accreditation_stage text check (accreditation_stage in ('student','pre_accredited','accredited','supervisor')),
  modalities text[] not null default '{}',
  note_format text not null default 'SOAP' check (note_format in ('SOAP','DAP','BIRP','FREE')),
  language text not null default 'en' check (language in ('en','ru','uk')),
  audio_retention text not null default 'delete_after_transcription'
    check (audio_retention in ('delete_after_transcription','keep_7_days')),
  voice_embedding real[],             -- biometric: therapist's own voice fingerprint, deletable in Settings
  voice_enrolled_at timestamptz,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger therapists_updated before update on therapists for each row execute function touch_updated_at();

-- Clients: pseudonym or code only. No names, addresses or dates of birth.
create table clients (
  id uuid primary key default gen_random_uuid(),
  therapist_id text not null references therapists(id) on delete cascade,
  pseudonym text not null check (char_length(btrim(pseudonym)) between 1 and 40),
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (therapist_id, pseudonym)
);
create trigger clients_updated before update on clients for each row execute function touch_updated_at();

create table consents (
  id uuid primary key default gen_random_uuid(),
  therapist_id text not null references therapists(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  consent_version text not null,
  method text not null check (method in ('verbal_in_session','signed_form','e_sign_link')),
  given_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  created_at timestamptz not null default now()
);
create index consents_client on consents(client_id);

create or replace function client_has_active_consent(p_client uuid) returns boolean
language sql stable as $$
  select exists (select 1 from consents where client_id = p_client and withdrawn_at is null)
$$;

create table sessions (
  id uuid primary key default gen_random_uuid(),
  therapist_id text not null references therapists(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  capture_mode text not null check (capture_mode in ('online_call','in_person','upload','recap')),
  status text not null default 'draft'
    check (status in ('draft','recording','uploaded','processing','ready','failed')),
  stage text,                                   -- progress: transcribing | labelling | writing_note | reflecting | timeline
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer,
  language text,                                -- detected session language
  speaker_names jsonb not null default '{}'::jsonb,  -- e.g. {"client":"Client A"}; therapist-editable
  recap_text text,                              -- only for capture_mode = recap
  audio_retention text not null default 'delete_after_transcription',
  audio_delete_after timestamptz,
  audio_deleted_at timestamptz,
  error_code text,                              -- never contains session content
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sessions_therapist_started on sessions(therapist_id, started_at desc);
create index sessions_client on sessions(client_id, started_at desc);
create trigger sessions_updated before update on sessions for each row execute function touch_updated_at();

-- Consent gate: a recorded session can't be created, and no audio can be
-- stored, for a client without an active consent record.
create or replace function enforce_session_consent() returns trigger
language plpgsql as $$
begin
  if new.capture_mode <> 'recap' and not client_has_active_consent(new.client_id) then
    raise exception 'consent_required' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger sessions_consent_gate before insert on sessions
  for each row execute function enforce_session_consent();

create table audio_chunks (
  id uuid primary key default gen_random_uuid(),
  therapist_id text not null references therapists(id) on delete cascade,
  session_id uuid references sessions(id) on delete cascade,   -- null for voice-enrolment samples
  track text not null check (track in ('mic','tab','room','upload','calibration')),
  segment integer not null default 0,     -- a new MediaRecorder instance (e.g. after a reload) starts a new segment
  seq integer not null,
  path text not null,
  bytes integer not null,
  mime text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (session_id, track, segment, seq)
);
create index audio_chunks_session on audio_chunks(session_id);

create or replace function enforce_chunk_consent() returns trigger
language plpgsql as $$
declare v_client uuid; v_mode text;
begin
  if new.session_id is null then return new; end if;
  select client_id, capture_mode into v_client, v_mode from sessions where id = new.session_id;
  if v_mode = 'recap' or not client_has_active_consent(v_client) then
    raise exception 'consent_required' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger audio_chunks_consent_gate before insert on audio_chunks
  for each row execute function enforce_chunk_consent();

create table transcript_segments (
  id uuid primary key default gen_random_uuid(),
  therapist_id text not null references therapists(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  idx integer not null,
  speaker text not null,            -- therapist | client | client_2 | speaker_3 | recap
  start_ms integer not null default 0,
  end_ms integer not null default 0,
  text text not null,
  original_text text,               -- ASR text before clean-up, for audit
  unique (session_id, idx)
);
-- Simple full-text search across the transcript
create index transcript_segments_session on transcript_segments(session_id, idx);

create table notes (
  id uuid primary key default gen_random_uuid(),
  therapist_id text not null references therapists(id) on delete cascade,
  session_id uuid not null unique references sessions(id) on delete cascade,
  format text not null,
  content_json jsonb not null,
  status text not null default 'draft' check (status in ('draft','approved')),
  approved_at timestamptz,
  prompt_version text,
  model_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger notes_updated before update on notes for each row execute function touch_updated_at();

create or replace function lock_approved_notes() returns trigger
language plpgsql as $$
begin
  if old.status = 'approved' and new.content_json is distinct from old.content_json then
    raise exception 'note_locked' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger notes_lock before update on notes for each row execute function lock_approved_notes();

create table reflections (
  id uuid primary key default gen_random_uuid(),
  therapist_id text not null references therapists(id) on delete cascade,
  session_id uuid not null unique references sessions(id) on delete cascade,
  modality text not null,
  content_json jsonb not null,
  dropped_items integer not null default 0,   -- items removed by the evidence check
  prompt_version text,
  model_id text,
  created_at timestamptz not null default now()
);

create table client_timeline_items (
  id uuid primary key default gen_random_uuid(),
  therapist_id text not null references therapists(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,
  kind text not null check (kind in ('theme','goal','homework','change')),
  text text not null,
  status text not null default 'active' check (status in ('active','done','dropped')),
  evidence jsonb not null default '[]'::jsonb,   -- [{session_id, segment_ids:[...]}]
  source text not null default 'ai' check (source in ('ai','therapist')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index timeline_client on client_timeline_items(client_id, created_at desc);
create trigger timeline_updated before update on client_timeline_items for each row execute function touch_updated_at();

create table supervision_packs (
  id uuid primary key default gen_random_uuid(),
  therapist_id text not null references therapists(id) on delete cascade,
  month date not null,                  -- first day of the month
  content_json jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','ready','failed')),
  prompt_version text,
  model_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (therapist_id, month)
);
create trigger packs_updated before update on supervision_packs for each row execute function touch_updated_at();

-- Supervision hours the therapist attended (client hours come from sessions)
create table supervision_hours (
  id uuid primary key default gen_random_uuid(),
  therapist_id text not null references therapists(id) on delete cascade,
  occurred_on date not null,
  minutes integer not null check (minutes > 0 and minutes <= 600),
  kind text not null default 'individual' check (kind in ('individual','group')),
  supervisor text not null default '',
  created_at timestamptz not null default now()
);

-- Background work for the Python worker. Never store session content here.
create table jobs (
  id bigserial primary key,
  therapist_id text references therapists(id) on delete cascade,
  session_id uuid references sessions(id) on delete cascade,
  kind text not null check (kind in ('process_session','enrol_voice','supervision_pack','regenerate')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','running','done','failed')),
  attempts integer not null default 0,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_ready on jobs(status, run_after) where status = 'queued';
create trigger jobs_updated before update on jobs for each row execute function touch_updated_at();

-- Who did what, when. No content.
create table audit_log (
  id bigserial primary key,
  therapist_id text,                    -- owner of the data (not a foreign key: survives account deletion)
  actor text not null,                  -- user id, or 'worker' / 'system'
  action text not null,                 -- e.g. session.view, note.export, client.delete
  entity_type text not null,
  entity_id text,
  at timestamptz not null default now()
);
create index audit_therapist_at on audit_log(therapist_id, at desc);

-- Marketing site: join-the-pilot form
create table pilot_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  profession text not null,
  created_at timestamptz not null default now()
);

-- Pilot feedback widget (therapists are asked not to include client details)
create table feedback (
  id uuid primary key default gen_random_uuid(),
  therapist_id text not null references therapists(id) on delete cascade,
  page text not null,
  rating integer check (rating between 1 and 5),
  message text not null default '',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['clients','consents','sessions','audio_chunks','transcript_segments','notes',
                           'reflections','client_timeline_items','supervision_packs','supervision_hours',
                           'jobs','feedback']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy own_rows on %I using (therapist_id = app_current_user()) with check (therapist_id = app_current_user())', t);
  end loop;
end $$;

alter table therapists enable row level security;
alter table therapists force row level security;
create policy own_row on therapists using (id = app_current_user()) with check (id = app_current_user());

-- Audit log: a therapist can read and append their own entries, never edit or delete.
alter table audit_log enable row level security;
alter table audit_log force row level security;
create policy audit_read on audit_log for select using (therapist_id = app_current_user());
create policy audit_insert on audit_log for insert with check (therapist_id = app_current_user() and actor = app_current_user());

-- Pilot sign-ups: the web app may insert, nobody reads through the app role.
alter table pilot_signups enable row level security;
alter table pilot_signups force row level security;
create policy signup_insert on pilot_signups for insert with check (true);
