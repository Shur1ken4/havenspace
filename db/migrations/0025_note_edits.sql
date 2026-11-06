-- How much therapists change the AI's note before approving it (Shurik, 2026-11-06),
-- the clearest sign of draft quality. The worker keeps a copy of its draft until the
-- note is approved; approving saves one number (the share of words changed, 0 to 1)
-- and deletes the copy, so no extra note text is kept after approval.
alter table notes add column ai_draft_json jsonb;
alter table notes add column edit_share real check (edit_share between 0 and 1);
