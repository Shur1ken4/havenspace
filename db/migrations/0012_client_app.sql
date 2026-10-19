-- Client app (ADR-14): a therapist invites a client with a one-time code; the
-- client signs in with their own email and sees only what their therapist
-- shares with them: homework, the next session date, and their own diary.
-- Clients never see notes, transcripts, reflections or the pseudonym list.
--
-- Roles: a signed-in user is a CLIENT if they have a client_accounts row,
-- otherwise a therapist. app_current_user() is the signed-in user either way.

-- ── Who is linked to which client ─────────────────────────────────────────
create table client_accounts (
  user_id text primary key references "user"(id) on delete cascade,
  therapist_id text not null references therapists(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  linked_at timestamptz not null default now(),
  revoked_at timestamptz                      -- the therapist disconnected them
);
create unique index client_accounts_one_live on client_accounts(client_id) where revoked_at is null;

-- The signed-in client's record (null for therapists and disconnected clients).
create or replace function current_client_id() returns uuid
language sql stable security definer set search_path = public as $$
  select client_id from client_accounts where user_id = app_current_user() and revoked_at is null
$$;

alter table client_accounts enable row level security;
alter table client_accounts force row level security;
create policy therapist_read on client_accounts for select using (therapist_id = app_current_user());
create policy self_read on client_accounts for select using (user_id = app_current_user());
-- No insert/update/delete for the app: links change only through the functions below.

-- ── One-time invites ──────────────────────────────────────────────────────
-- Only a SHA-256 hash of the code is stored; the code itself is shown once.
create table client_invites (
  id uuid primary key default gen_random_uuid(),
  therapist_id text not null references therapists(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  code_hash text not null unique,
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index client_invites_client on client_invites(client_id);
alter table client_invites enable row level security;
alter table client_invites force row level security;
create policy own_rows on client_invites using (therapist_id = app_current_user()) with check (therapist_id = app_current_user());
create trigger client_invites_access_gate before insert on client_invites for each row execute function enforce_access_app();

-- Before signing in: is this code valid, and who sent it? Returns only the
-- therapist's display name, never anything about the client.
create or replace function client_invite_preview(p_hash text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(t.display_name, ''), '—')
    from client_invites i join therapists t on t.id = i.therapist_id join clients c on c.id = i.client_id
   where i.code_hash = p_hash and i.used_at is null and i.expires_at > now()
     and t.access_status = 'approved' and c.status = 'active'
$$;

-- After signing in: link the signed-in user to the invited client.
create or replace function redeem_client_invite(p_hash text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user text := app_current_user();
  v_inv client_invites%rowtype;
begin
  if v_user is null then raise exception 'not_signed_in' using errcode = 'P0001'; end if;
  if exists (select 1 from therapists where id = v_user and onboarding_completed_at is not null) then
    raise exception 'therapist_account' using errcode = 'P0001';
  end if;
  if exists (select 1 from client_accounts where user_id = v_user and revoked_at is null) then
    raise exception 'already_linked' using errcode = 'P0001';
  end if;
  select * into v_inv from client_invites
   where code_hash = p_hash and used_at is null and expires_at > now() for update;
  if not found or client_invite_preview(p_hash) is null then
    raise exception 'invite_invalid' using errcode = 'P0001';
  end if;
  -- A client has at most one live link: a new invite replaces an old device/account.
  update client_accounts set revoked_at = now() where client_id = v_inv.client_id and revoked_at is null;
  -- An empty therapist profile may exist if this person opened the therapist sign-in first.
  delete from therapists where id = v_user and onboarding_completed_at is null;
  insert into client_accounts (user_id, therapist_id, client_id)
       values (v_user, v_inv.therapist_id, v_inv.client_id)
  on conflict (user_id) do update set therapist_id = excluded.therapist_id, client_id = excluded.client_id,
                                      linked_at = now(), revoked_at = null;
  update client_invites set used_at = now() where id = v_inv.id;
  insert into audit_log (therapist_id, actor, action, entity_type, entity_id)
       values (v_inv.therapist_id, v_user, 'client_app.joined', 'client', v_inv.client_id::text);
  return v_inv.client_id;
end $$;

-- The therapist disconnects their client from the app.
create or replace function revoke_client_link(p_client uuid) returns void
language sql security definer set search_path = public as $$
  update client_accounts set revoked_at = now()
   where client_id = p_client and therapist_id = app_current_user() and revoked_at is null;
  delete from client_invites where client_id = p_client and therapist_id = app_current_user() and used_at is null;
$$;

-- The client's own view of their therapist: a display name, nothing else.
create or replace function my_therapist_name() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(t.display_name, ''), '—') from client_accounts a join therapists t on t.id = a.therapist_id
   where a.user_id = app_current_user() and a.revoked_at is null
$$;

-- ── Homework the therapist shares ─────────────────────────────────────────
create table assignments (
  id uuid primary key default gen_random_uuid(),
  therapist_id text not null references therapists(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  details text not null default '' check (char_length(details) <= 2000),
  due_on date,
  done_at timestamptz,
  client_reply text check (char_length(client_reply) <= 1000),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assignments_client on assignments(client_id, created_at desc);
create trigger assignments_updated before update on assignments for each row execute function touch_updated_at();
alter table assignments enable row level security;
alter table assignments force row level security;
create policy own_rows on assignments using (therapist_id = app_current_user()) with check (therapist_id = app_current_user());
create policy client_read on assignments for select using (client_id = current_client_id() and archived_at is null);
create trigger assignments_access_gate before insert on assignments for each row execute function enforce_access_app();

-- The client marks homework done (or not) and may leave a short reply.
create or replace function client_update_assignment(p_id uuid, p_done boolean, p_reply text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update assignments
     set done_at = case when p_done then coalesce(done_at, now()) else null end,
         client_reply = nullif(btrim(left(coalesce(p_reply, ''), 1000)), '')
   where id = p_id and client_id = current_client_id() and archived_at is null;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
end $$;

-- ── Session reminders (a date, nothing more) ──────────────────────────────
create table appointments (
  id uuid primary key default gen_random_uuid(),
  therapist_id text not null references therapists(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  starts_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index appointments_client on appointments(client_id, starts_at);
alter table appointments enable row level security;
alter table appointments force row level security;
create policy own_rows on appointments using (therapist_id = app_current_user()) with check (therapist_id = app_current_user());
create policy client_read on appointments for select using (client_id = current_client_id());

-- ── The client's mood diary ───────────────────────────────────────────────
-- Written by the client. The therapist sees an entry only if the client
-- shared it. Nothing here is scored or flagged (ADR-4).
create table mood_entries (
  id uuid primary key default gen_random_uuid(),
  therapist_id text not null references therapists(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  client_user_id text not null references "user"(id) on delete cascade,
  mood smallint not null check (mood between 1 and 5),
  note text not null default '' check (char_length(note) <= 1000),
  shared boolean not null default true,
  created_at timestamptz not null default now()
);
create index mood_entries_client on mood_entries(client_id, created_at desc);
alter table mood_entries enable row level security;
alter table mood_entries force row level security;
create policy therapist_read on mood_entries for select using (therapist_id = app_current_user() and shared);
create policy client_own on mood_entries
  using (client_user_id = app_current_user())
  with check (client_user_id = app_current_user() and client_id = current_client_id()
              and therapist_id = (select therapist_id from client_accounts where user_id = app_current_user() and revoked_at is null));

-- ── Therapist verification documents (optional, ADR-14) ───────────────────
alter table therapists add column full_name text check (char_length(full_name) <= 120);

create table therapist_documents (
  id uuid primary key default gen_random_uuid(),
  therapist_id text not null references therapists(id) on delete cascade,
  path text not null,
  filename text not null check (char_length(filename) <= 200),
  mime text not null check (mime in ('application/pdf','image/jpeg','image/png')),
  bytes integer not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz                      -- file removed 30 days after the access decision
);
create index therapist_documents_owner on therapist_documents(therapist_id);
alter table therapist_documents enable row level security;
alter table therapist_documents force row level security;
create policy own_rows on therapist_documents using (therapist_id = app_current_user()) with check (therapist_id = app_current_user());
create policy admin_read on therapist_documents for select using (is_admin());

-- Limits how fast anyone can try invite codes (a code has ~40 bits of entropy anyway).
create table join_attempts (ip text not null, at timestamptz not null default now());
create index join_attempts_ip on join_attempts(ip, at);
alter table join_attempts enable row level security;
alter table join_attempts force row level security;

create or replace function note_join_attempt(p_ip text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  delete from join_attempts where at < now() - interval '1 hour';
  if (select count(*) from join_attempts where ip = p_ip and at > now() - interval '10 minutes') >= 20 then
    return false;
  end if;
  insert into join_attempts (ip) values (p_ip);
  return true;
end $$;
