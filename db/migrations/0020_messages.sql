-- Messages between a therapist and a client who uses the client app (Shurik, 2026-10-22).
-- One conversation per client. Only the two of them can read it; nobody else, not
-- even an admin. Nothing here is read, scored or flagged by AI (ADR-4).
create table messages (
  id uuid primary key default gen_random_uuid(),
  therapist_id text not null references therapists(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  from_client boolean not null,
  sender_id text not null references "user"(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index messages_client on messages(client_id, created_at desc);
create index messages_unread on messages(therapist_id) where read_at is null and from_client;
alter table messages enable row level security;
alter table messages force row level security;

-- The therapist: their own clients' conversations; writes only as themselves.
create policy therapist_read on messages for select using (therapist_id = app_current_user());
create policy therapist_write on messages for insert
  with check (therapist_id = app_current_user() and sender_id = app_current_user() and not from_client
              and exists (select 1 from clients c where c.id = client_id and c.therapist_id = app_current_user()));
-- The client: their own conversation, while linked; writes only as themselves, to their therapist.
create policy client_read on messages for select using (client_id = current_client_id());
create policy client_write on messages for insert
  with check (from_client and sender_id = app_current_user() and client_id = current_client_id()
              and therapist_id = (select a.therapist_id from client_accounts a where a.user_id = app_current_user() and a.revoked_at is null));
-- Pending or declined therapists can't message. (Checked on the therapist's own
-- messages: the gate looks the therapist up, which a client's account can't do.)
create trigger messages_access_gate before insert on messages for each row
  when (not new.from_client) execute function enforce_access_app();

-- Marks the other person's messages in one conversation as read. Returns how many.
create or replace function messages_mark_read(p_client uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_user text := app_current_user();
  v_n integer;
begin
  if current_client_id() = p_client then
    update messages set read_at = now() where client_id = p_client and not from_client and read_at is null;
  elsif exists (select 1 from clients where id = p_client and therapist_id = v_user) then
    update messages set read_at = now() where client_id = p_client and from_client and read_at is null;
  else
    return 0;
  end if;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Who to tell about a new message, by email, without its content. Only the sender may
-- ask, and only for the first unread message in a row (one email per batch, not per line).
create or replace function message_notice(p_message uuid)
returns table (email text, language text, therapist_name text, pseudonym text, to_client boolean, client_id uuid)
language sql stable security definer set search_path = public as $$
  select case when m.from_client then tu.email else cu.email end,
         coalesce(t.language, 'en'),
         coalesce(nullif(t.display_name, ''), '—'), c.pseudonym, not m.from_client, m.client_id
    from messages m
    join therapists t on t.id = m.therapist_id
    join "user" tu on tu.id = m.therapist_id
    join clients c on c.id = m.client_id
    left join client_accounts a on a.client_id = m.client_id and a.revoked_at is null
    left join "user" cu on cu.id = a.user_id
   where m.id = p_message and m.sender_id = app_current_user()
     -- An admin writing to their own test client doesn't need an email.
     and (a.user_id is null or a.user_id <> m.therapist_id)
     and not exists (select 1 from messages p where p.client_id = m.client_id and p.from_client = m.from_client
                      and p.id <> m.id and p.read_at is null and p.created_at < m.created_at
                      and p.created_at > m.created_at - interval '12 hours')
$$;
