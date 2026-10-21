-- Therapy tools in video sessions (ADR-21): scales, wheel of balance, emotion wheel,
-- art cards and a drawing board, shared live on the call. What the therapist saves
-- lands on the client's card. Same rules as notes: the therapist's own rows only,
-- kept in the EU, deleted with the client or the account.
create table tool_results (
  id uuid primary key default gen_random_uuid(),
  therapist_id text not null references therapists(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  video_room_id uuid references video_rooms(id) on delete set null,
  session_id uuid references sessions(id) on delete set null,
  kind text not null check (kind in ('scale', 'balance', 'emotions', 'cards', 'board')),
  content jsonb not null,
  -- The drawing board as a PNG picture (small: a few hundred KB at most).
  image bytea check (image is null or octet_length(image) <= 2000000),
  created_at timestamptz not null default now()
);
create index tool_results_client on tool_results(client_id, created_at desc);
alter table tool_results enable row level security;
alter table tool_results force row level security;
-- Only the therapist's own rows, and only for their own clients (clients are row-secured too).
create policy own_rows on tool_results
  using (therapist_id = app_current_user())
  with check (therapist_id = app_current_user() and exists (select 1 from clients c where c.id = client_id));
-- Pending or declined therapists can't save.
create trigger tool_results_access_gate before insert on tool_results for each row execute function enforce_access_app();
