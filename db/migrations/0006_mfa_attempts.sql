-- Failed two-step codes, for rate limiting (5 per 15 minutes per user).
create table mfa_attempts (
  id bigserial primary key,
  user_id text not null references "user"(id) on delete cascade,
  at timestamptz not null default now()
);
create index mfa_attempts_user_at on mfa_attempts(user_id, at desc);
