-- "Your client is waiting" / "Your therapist is ready" emails (Shurik, 2026-10-22).
-- When one person enters a video room and the other isn't there yet, the other
-- gets a short email with a link. At most one email per person per room every
-- 15 minutes, so dropping out and coming back doesn't flood anyone.
alter table video_rooms add column therapist_notified_at timestamptz;
alter table video_rooms add column client_notified_at timestamptz;

-- Called by the app right after it hands out an entry pass. Marks the email as
-- sent and returns where to send it (no rows when there's nobody to tell, or
-- they were told a moment ago). Only names and a link go out, never content.
create or replace function video_join_notice(p_room_name text, p_joiner text)
returns table (email text, language text, therapist_name text, pseudonym text, room_id uuid)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if p_joiner = 'client' then
    return query
      update video_rooms r set therapist_notified_at = now()
        from therapists t, "user" u, clients c
       where r.room_name = p_room_name and r.ended_at is null
         and (r.therapist_notified_at is null or r.therapist_notified_at < now() - interval '15 minutes')
         and t.id = r.therapist_id and u.id = r.therapist_id and c.id = r.client_id
         -- An admin testing with their own test client is both people.
         and not exists (select 1 from client_accounts a where a.client_id = r.client_id and a.revoked_at is null and a.user_id = r.therapist_id)
      returning u.email, coalesce(t.language, 'en'), coalesce(nullif(t.display_name, ''), '—'), c.pseudonym, r.id;
  elsif p_joiner = 'therapist' then
    return query
      update video_rooms r set client_notified_at = now()
        from therapists t, client_accounts a, "user" u, clients c
       where r.room_name = p_room_name and r.ended_at is null
         and (r.client_notified_at is null or r.client_notified_at < now() - interval '15 minutes')
         and t.id = r.therapist_id and c.id = r.client_id
         and a.client_id = r.client_id and a.revoked_at is null and a.user_id <> r.therapist_id and u.id = a.user_id
      returning u.email, coalesce(t.language, 'en'), coalesce(nullif(t.display_name, ''), '—'), c.pseudonym, r.id;
  end if;
end $$;
