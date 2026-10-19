-- Temporary audio/document storage inside Postgres (STORAGE_DRIVER=db), for the
-- pilot until EU object storage (Hetzner) is connected. Same lifecycle as S3:
-- audio is deleted right after transcription, and by retention after 48 hours
-- at the latest. Keys start with audio/<therapist>/ or documents/<therapist>/,
-- and row-level security ties each key to its owner.
create table blob_store (
  key text primary key check (key ~ '^[a-zA-Z0-9/_.-]+$' and key not like '%..%'),
  body bytea not null,
  mime text not null default 'application/octet-stream',
  created_at timestamptz not null default now()
);
create index blob_store_created on blob_store(created_at);
alter table blob_store enable row level security;
alter table blob_store force row level security;
create policy own_blobs on blob_store
  using (split_part(key, '/', 2) = app_current_user() and split_part(key, '/', 1) in ('audio', 'documents'))
  with check (split_part(key, '/', 2) = app_current_user() and split_part(key, '/', 1) in ('audio', 'documents'));
