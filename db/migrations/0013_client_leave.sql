-- A client deletes their own app account (ADR-14). Removes the login, which
-- cascades to their client link and every diary entry. The therapist's
-- records (homework they set, session notes) are the therapist's and stay.
create or replace function leave_client_app() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user text := app_current_user();
  v_link client_accounts%rowtype;
begin
  select * into v_link from client_accounts where user_id = v_user;
  if not found then raise exception 'not_a_client' using errcode = 'P0001'; end if;
  insert into audit_log (therapist_id, actor, action, entity_type, entity_id)
       values (v_link.therapist_id, v_user, 'client_app.left', 'client', v_link.client_id::text);
  delete from "user" where id = v_user;
end $$;
