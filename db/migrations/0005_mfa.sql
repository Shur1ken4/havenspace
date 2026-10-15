-- Sessions that have passed two-step verification. A therapist with 2FA on is
-- treated as signed out (except for the "enter your code" step) until their
-- current session appears here. Applies to every sign-in method, including
-- magic links, which the sign-in library's 2FA plugin does not cover.
create table mfa_verified_sessions (
  session_id text primary key references "session"(id) on delete cascade,
  verified_at timestamptz not null default now()
);
