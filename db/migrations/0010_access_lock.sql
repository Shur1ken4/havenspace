-- A therapist must never be able to approve themselves: only an admin (or the
-- request_access() function for invited emails) may change access fields.
create or replace function lock_access_fields() returns trigger
language plpgsql as $$
begin
  if current_user <> 'app_user' or is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' and new.access_status <> 'pending' then
    raise exception 'access_locked' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and (new.access_status is distinct from old.access_status
                           or new.access_decided_at is distinct from old.access_decided_at) then
    raise exception 'access_locked' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger therapists_access_lock before insert or update on therapists
  for each row execute function lock_access_fields();

-- request_access() is SECURITY DEFINER, so inside it current_user is the owner
-- and the check above lets the invited-email approval through.

-- The access gate must see the therapist row whoever is inserting, so that a
-- write for someone else fails on row-level security rather than here.
create or replace function enforce_access() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from therapists where id = new.therapist_id and access_status = 'approved') then
    raise exception 'access_pending' using errcode = 'P0001';
  end if;
  return new;
end $$;
