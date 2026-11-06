-- Open sign-up for pilot testers (Shurik, 2026-10-24): while auto_approve is on,
-- a therapist who finishes onboarding is approved straight away, with no admin
-- review. Turn it off again with `node scripts/pilot.mjs signup off`; admins can
-- still remove anyone's access on /admin. ADR-11 has the details.
create table access_settings (
  id boolean primary key default true check (id),   -- a single row
  auto_approve boolean not null default false
);
insert into access_settings (id, auto_approve) values (true, true);

alter table access_settings enable row level security;
alter table access_settings force row level security;
create policy admin_all on access_settings using (is_admin()) with check (is_admin());

create or replace function request_access() returns text
language plpgsql security definer set search_path = public as $$
declare v_email text; v_status text;
begin
  select lower(email) into v_email from "user" where id = app_current_user();
  select access_status into v_status from therapists where id = app_current_user();
  if v_status = 'pending' and (exists (select 1 from access_invites where email = v_email)
                               or exists (select 1 from admins where email = v_email)
                               or exists (select 1 from access_settings where auto_approve)) then
    update therapists set access_status = 'approved', access_decided_at = now() where id = app_current_user();
    v_status := 'approved';
  end if;
  return v_status;
end $$;
