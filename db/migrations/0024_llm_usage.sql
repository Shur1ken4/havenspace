-- How much AI each step uses, so costs are measured rather than estimated
-- (Shurik, 2026-11-01). Token counts only: no prompts, replies or session content.
-- Deleting an account or session blanks the link and keeps the anonymous counts.
create table llm_usage (
  id bigserial primary key,
  therapist_id text references therapists(id) on delete set null,
  session_id uuid references sessions(id) on delete set null,
  step text not null,                   -- clean_transcript, draft_note, reflect, update_timeline, supervision_pack, live_insight, arch
  provider text not null,               -- anthropic or bedrock
  model_id text not null,               -- the model that actually answered
  input_tokens integer not null,
  output_tokens integer not null,
  cache_write_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  api_calls integer not null default 1, -- one Arch question can take several calls
  at timestamptz not null default now()
);
create index llm_usage_at on llm_usage(at desc);
create index llm_usage_session on llm_usage(session_id);

alter table llm_usage enable row level security;
alter table llm_usage force row level security;
-- The web app adds rows for Arch, only as the signed-in therapist. Only admins read them.
create policy usage_insert on llm_usage for insert with check (therapist_id = app_current_user());
create policy admin_read on llm_usage for select using (is_admin());
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'worker_user') then
    create policy worker_all on llm_usage to worker_user using (true) with check (true);
  end if;
end $$;
