-- In-app video sessions (ADR-17). A video room joins one therapist and one of their
-- clients for one meeting. The call itself runs on LiveKit (EU, Frankfurt); we only
-- keep who/when here. Nothing is recorded unless the therapist starts a recorded
-- session, which goes through the usual consent gate on `sessions`.
create table video_rooms (
  id uuid primary key default gen_random_uuid(),
  therapist_id text not null references therapists(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  room_name text not null unique default ('hs_' || replace(gen_random_uuid()::text, '-', '')),
  session_id uuid references sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create index video_rooms_client_open on video_rooms(client_id) where ended_at is null;
alter table video_rooms enable row level security;
alter table video_rooms force row level security;
create policy own_rows on video_rooms using (therapist_id = app_current_user()) with check (therapist_id = app_current_user());
-- A linked client sees only open rooms meant for them, and only for a few hours.
create policy client_read on video_rooms for select
  using (client_id = current_client_id() and ended_at is null and created_at > now() - interval '4 hours');
-- Pending or declined therapists can't open rooms.
create trigger video_rooms_access_gate before insert on video_rooms for each row execute function enforce_access_app();
