-- A therapist's own card decks (Shurik, 2026-10-22). Each deck is private to the
-- therapist who uploaded it; the therapist confirms they have the right to use the
-- images. In a call, the client sees a card through a short-lived signed link that
-- the therapist's screen hands over (lib/decks-server.ts), never a public address.
create table card_decks (
  id uuid primary key default gen_random_uuid(),
  therapist_id text not null references therapists(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  rights_confirmed_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index card_decks_owner on card_decks(therapist_id, created_at);
alter table card_decks enable row level security;
alter table card_decks force row level security;
create policy own_rows on card_decks using (therapist_id = app_current_user()) with check (therapist_id = app_current_user());
create trigger card_decks_access_gate before insert on card_decks for each row execute function enforce_access_app();

create table deck_cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references card_decks(id) on delete cascade,
  therapist_id text not null references therapists(id) on delete cascade,
  image bytea not null check (octet_length(image) <= 1500000),
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  width integer not null check (width between 16 and 4000),
  height integer not null check (height between 16 and 4000),
  created_at timestamptz not null default now()
);
create index deck_cards_deck on deck_cards(deck_id, created_at);
alter table deck_cards enable row level security;
alter table deck_cards force row level security;
create policy own_rows on deck_cards using (therapist_id = app_current_user())
  with check (therapist_id = app_current_user()
              and exists (select 1 from card_decks d where d.id = deck_id and d.therapist_id = app_current_user()));
create trigger deck_cards_access_gate before insert on deck_cards for each row execute function enforce_access_app();

-- One card image for someone holding a valid signed link (checked by the app before calling).
create or replace function deck_card_image(p_deck uuid, p_card uuid) returns table (image bytea, mime text)
language sql stable security definer set search_path = public as $$
  select c.image, c.mime from deck_cards c where c.id = p_card and c.deck_id = p_deck
$$;
