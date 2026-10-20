-- One-time join links for video sessions (ADR-17): lets a client without the
-- client app join one session from a link the therapist sends. Only a hash of
-- the link is stored. It works while the room is open, for at most 4 hours, and
-- stops the moment the therapist ends the session or makes a new link.
alter table video_rooms add column guest_token_hash text unique;
alter table video_rooms add column guest_expires_at timestamptz;

-- Anyone holding a valid link learns only the room to enter and the therapist's
-- name to show; nothing about the client.
create or replace function video_guest_room(p_hash text) returns table (room_id uuid, room_name text, therapist_name text)
language sql stable security definer set search_path = public as $$
  select r.id, r.room_name, coalesce(nullif(t.full_name, ''), nullif(t.display_name, ''), '—')
    from video_rooms r join therapists t on t.id = r.therapist_id
   where r.guest_token_hash = p_hash and r.ended_at is null and r.guest_expires_at > now()
     and t.access_status = 'approved'
$$;
