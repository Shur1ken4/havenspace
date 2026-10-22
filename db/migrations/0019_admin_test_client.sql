-- Admins test both sides with one account (Shurik, 2026-10-22): each admin gets a test
-- client of their own, linked to their own login, and switches between the therapist
-- and the client views. Nobody else's data is involved, and non-admins can't do this.
create policy admin_self_link on client_accounts for insert
  with check (user_id = app_current_user() and therapist_id = app_current_user() and is_admin());
create policy admin_self_relink on client_accounts for update
  using (user_id = app_current_user() and is_admin())
  with check (user_id = app_current_user() and therapist_id = app_current_user() and is_admin());

-- Returns the admin's test client, creating it (and the link to their own login) the first time.
-- Runs with the owner's rights, like redeem_client_invite: the app itself can't write client links.
create or replace function admin_test_client(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user text := app_current_user();
  v_client uuid;
begin
  if not is_admin() then raise exception 'not_admin' using errcode = 'P0001'; end if;
  select client_id into v_client from client_accounts
   where user_id = v_user and therapist_id = v_user and revoked_at is null;
  if v_client is not null then return v_client; end if;
  insert into clients (therapist_id, pseudonym) values (v_user, left(coalesce(nullif(trim(p_name), ''), 'Test client'), 40))
    returning id into v_client;
  insert into client_accounts (user_id, therapist_id, client_id) values (v_user, v_user, v_client)
    on conflict (user_id) do update set therapist_id = excluded.therapist_id, client_id = excluded.client_id,
      linked_at = now(), revoked_at = null;
  return v_client;
end $$;
