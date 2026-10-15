# Privacy architecture

Input for the Data Protection Impact Assessment (DPIA). Describes what data we
hold, where it flows, how long we keep it and how it is protected. Plain
language first, technical detail second.

## 1. Roles
- **Therapist** — our customer. Data controller for their clients' data.
- **Psych Copilot** — data processor for client data; controller for the therapist's own account data.
- **Client** — the person in therapy. Never a user of the app; identified only by a pseudonym chosen by the therapist.

## 2. Data we hold

| Data | Example | Special category? | Where | Kept for |
|---|---|---|---|---|
| Therapist account | email, display name, profession, modalities, note format, language | No | Postgres (EU) | Until account deletion |
| Therapist voice fingerprint | 192 numbers derived from a 5-second sample | Biometric — yes, if used to identify | Postgres (EU) | Until deleted in Settings or account deletion |
| Client pseudonym | "Client A", "J.M." | No (pseudonymous) | Postgres | Until the therapist deletes the client |
| Consent records | version, method, given/withdrawn dates | Health-adjacent | Postgres | With the client |
| **Session audio** | mic + meeting-tab tracks, room recording, upload, dictation | **Yes (health)** | Object storage (EU) | **Deleted right after transcription** by default; optional 7 days; abandoned recordings 48 h |
| **Transcripts** | speaker-labelled text | **Yes** | Postgres | Until the therapist deletes the session/client/account |
| **Notes, reflections, timeline, supervision packs** | AI drafts edited by the therapist | **Yes** | Postgres | Same as transcripts |
| Audit log | "note.export_pdf by user X at time T" | No content | Postgres | Survives account deletion (no content) |
| Waiting-list / demo requests | email, name, profession | No | Postgres (write-only for the app) | Until removal requested |

## 3. How a session flows

```
Therapist's browser ──(TLS, ~10 s pieces)──▶ Web app (EU) ──▶ Object storage (EU)
                                                   │
                                     job row ──▶ Postgres (EU) ◀── Worker (EU GPU server)
                                                                   1. join pieces, decode
                                                                   2. speech-to-text (on our server)
                                                                   3. who-spoke-when (on our server)
                                                                   4. save transcript ──▶ DELETE AUDIO
                                                                   5. transcript text ──▶ Claude on Bedrock (EU region)
                                                                   6. evidence check, guardrail check
                                                                   7. save note / reflection / timeline
Therapist reviews, edits, approves ◀── Web app ◀── Postgres
```

- Only **text** reaches the AI provider, never audio. It carries the pseudonym, never a name.
- With `ALLOW_REAL_CLIENT_DATA=false` (default) the app shows "Demo mode: role-play only", and the worker refuses to start with real data unless the AI provider is **Bedrock in an EU region**.
- **Live research mode (ADR-10)** — an experiment for the founders only, switched off whenever `ALLOW_REAL_CLIENT_DATA=true`: short ~8 s clips are transcribed during the session and deleted immediately; the words and the AI's short reads are stored with the session and deleted with it.
- Recaps can be typed (no audio at all) or dictated; dictation is transcribed by our own speech-to-text, never a browser/cloud dictation service.

## 4. Protections

| Area | What we do | Where in code |
|---|---|---|
| Consent gate | The database refuses to create a recorded session, or store any audio piece, for a client without an active consent record. Withdrawal stops recording immediately. | `db/migrations/0002_app.sql`, `0003_dictation.sql` (triggers); tests in `apps/web/tests/security.test.ts` |
| Isolation between therapists | Row-level security on every content table, forced, with a database role that cannot bypass it. | `0002_app.sql`; `apps/web/src/lib/db.ts` (`withUser`); tests |
| Audio deletion | Hard-delete after transcription; scheduled job for 7-day and abandoned audio. | `services/worker/worker/pipeline.py`, `retention.py`; tests in `services/worker/tests/test_jobs_and_retention.py` |
| No content in logs | Worker log function only accepts whitelisted fields (ids, counts, stage, error class). Job and session errors store only an error class name. | `services/worker/worker/log.py` |
| No analytics by default | No analytics or error tracking are installed. If added: EU-hosted, non-content events only, after consent. | — |
| Audit log | Views, edits, approvals, exports and deletions are logged (who/what/when, no content). Append-only for the app. | `apps/web/src/lib/audit.ts`, `0002_app.sql` |
| Sign-in | Email magic links (15 min, single use), passkeys, optional authenticator-app 2FA, 12-hour sessions, rate limiting; re-sign-in within 15 min for bulk exports and deletions. | `apps/web/src/lib/auth.ts`; ADR-7 |
| Transport and browser | HTTPS everywhere (HSTS), strict Content-Security-Policy, no third-party scripts or fonts (fonts self-hosted), microphone/screen-capture allowed only on our own origin, no referrer. | `apps/web/next.config.ts` |
| Encryption at rest | Provider disk encryption; S3 objects stored with server-side encryption. Per-therapist envelope encryption proposed (ADR-6). | `storage.ts` |
| AI guardrails | No diagnosis / risk rating: no fields for them in the output schema, prompt rules, forbidden-terms check with one automatic redraft, evals. | ADR-4; `services/worker/worker/agent/` |
| Evidence | Every reflection point must cite real transcript segments and an exact quote, or it is dropped. | `agent/evidence.py` |
| Data subject rights | Export all data (ZIP of JSON) or one client's data; delete a client, a session or the whole account. | `apps/web/src/app/api/export/route.ts`, Settings → Privacy |
| No training | Session data is never used to train models; Bedrock does not store or train on prompts. | ADR-3 |

## 5. Retention summary
- Audio: minutes (default) / 7 days (opt-in) / 48 h for abandoned recordings / 1 h for voice samples and dictation.
- Expired sign-in links and sessions: removed by the scheduled job.
- Everything else: until the therapist deletes it. Account deletion removes all rows (database cascade) and any remaining audio files.
- Backups: provider-dependent; to be documented with the chosen Postgres provider (crypto-shredding in ADR-6 covers backups).

## 6. Open items before real client data
1. Choose and contract EU Postgres + object storage providers (ADR-5); sign DPAs with every sub-processor.
2. Switch AI to Bedrock EU and confirm model availability in the EU region (ADR-3).
3. Implement envelope encryption (ADR-6).
4. Independent DPIA review by a lawyer; finalise the DPA and privacy notice.
5. Clinical Lead sign-off on prompts, rubrics, consent wording (docs/clinical-review.md).
6. Penetration test / security review; dependency scanning in CI.
