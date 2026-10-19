-- Pilot access (ADR-11): anyone can request access by signing up and filling
-- in their professional details; an admin approves or declines. Until then the
-- account cannot add clients or record anything (enforced here, not only in the UI).

alter table therapists add column access_status text not null default 'pending'
  check (access_status in ('pending','approved','declined'));
alter table therapists add column access_decided_at timestamptz;
alter table therapists add column professional_body text;      -- e.g. IACP, PSI, CORU, BACP
alter table therapists add column registration_number text;    -- checked by hand against the public register
alter table therapists add column country text;
update therapists set access_status = 'approved', access_decided_at = now();  -- accounts that existed before

-- Admins are named by email (managed with `node scripts/pilot.mjs admin <email>`),
-- so they can be set up before they first sign in.
create table admins (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

-- People invited from the waiting list: approved automatically when they sign up.
create table access_invites (
  email text primary key check (email = lower(email)),
  invited_at timestamptz not null default now()
);

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins a join "user" u on lower(u.email) = a.email where u.id = app_current_user())
$$;

-- Called when a therapist finishes onboarding: invited people and admins are
-- approved straight away, everyone else waits for review. Returns the status.
create or replace function request_access() returns text
language plpgsql security definer set search_path = public as $$
declare v_email text; v_status text;
begin
  select lower(email) into v_email from "user" where id = app_current_user();
  select access_status into v_status from therapists where id = app_current_user();
  if v_status = 'pending' and (exists (select 1 from access_invites where email = v_email)
                               or exists (select 1 from admins where email = v_email)) then
    update therapists set access_status = 'approved', access_decided_at = now() where id = app_current_user();
    v_status := 'approved';
  end if;
  return v_status;
end $$;

-- Emails to notify about new requests (no other admin data is exposed).
create or replace function admin_emails() returns setof text
language sql stable security definer set search_path = public as $$
  select email from admins
$$;

-- Pending or declined accounts cannot add clients or start sessions.
create or replace function enforce_access() returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from therapists where id = new.therapist_id and access_status = 'approved') then
    raise exception 'access_pending' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger clients_access_gate before insert on clients for each row execute function enforce_access();
create trigger sessions_access_gate before insert on sessions for each row execute function enforce_access();

-- Admin views: therapist profiles (never client content) and the waiting list.
create policy admin_read on therapists for select using (is_admin());
create policy admin_update on therapists for update using (is_admin()) with check (is_admin());
create policy admin_read on pilot_signups for select using (is_admin());

alter table admins enable row level security;
alter table admins force row level security;
create policy admin_read on admins for select using (is_admin());

alter table access_invites enable row level security;
alter table access_invites force row level security;
create policy admin_all on access_invites using (is_admin()) with check (is_admin());
