# Architecture Decision Records

Each record explains one real choice: what we picked, what else we looked at, and when to revisit it.
Prices are approximate as of October 2026 and must be re-checked before buying anything.

---

# ADR-1: Session capture method for online calls
Status: Proposed   Date: 2026-10-15   Deciders: Shurik, Clinical Lead

## Context
Most private-practice therapy in Ireland now happens partly online (Zoom, Google Meet, Teams). To write a note and give reflection, we need the session audio, ideally with the therapist and the client as **separate tracks** so we know who said what. The Clinical Lead's prototype does this on Windows with a virtual audio cable (VB-CABLE), which needs installing and configuring and does not work on Mac.

Constraints:
- Therapists are not technical; setup must take minutes.
- A visible "bot" joining the call harms trust in a therapy setting.
- Recording requires the client's consent (our consent gate enforces this).
- Session content is special-category health data, so fewer third parties is better.

## Decision
**Option (a): capture in our own web app**, in the browser:
- **Therapist track** = the microphone (`getUserMedia`).
- **Client track** = the audio of the meeting tab, which the therapist shares with "Share tab audio" ticked (`getDisplayMedia({audio: true})`). The meeting tab plays only the *other* person's voice, so the two tracks separate cleanly.
- Both tracks are recorded separately and uploaded in ~30-second chunks while the session runs.
- Speaker labelling uses the track first; the ported voice-fingerprint diarization only cleans up "bleed" (e.g. the client's voice leaking into the mic through laptop speakers). We will recommend headphones.
- Supported: Chrome and Edge on desktop. We show a browser check and clear instructions. Zoom *desktop app* users on Windows can share "entire screen + system audio"; Mac users are guided to the browser version of the call, or to phone/upload capture.

## Options considered

| Option | Complexity | Cost | Privacy / EU | Time to build |
|---|---|---|---|---|
| **(a) Browser tab-audio capture in our web app** | Low–medium | €0 extra | Best: audio goes only to our EU storage | 2–3 weeks |
| (b) Chrome extension | Medium (store review, extension updates) | €5 one-off store fee | Good, but extensions ask for broad permissions that worry users | 4–6 weeks |
| (c) Meeting bot (e.g. Recall.ai) joins the call | Low for us, high for trust | ~$0.50–1 per recorded hour + vendor | Weaker: extra US-based sub-processor; a visible third "participant" in a therapy call | 1–2 weeks |
| (d) Desktop app (prototype approach, VB-CABLE) | High (Windows + Mac installers, audio drivers, auto-update, code signing) | Code-signing certificates ~€100–400/yr | Good | 2–3 months |

## Consequences
- **Easier:** no install; works on day one for anyone with Chrome/Edge; two clean tracks make speaker labels near-trivial; no bot in the room.
- **Harder:** Safari/Firefox can't do it; Zoom desktop on Mac isn't covered; the therapist must remember to tick "Share tab audio" (we design the screen around this and check the track actually contains sound).
- **Revisit when:** pilot feedback shows Mac + Zoom-desktop users struggle → consider (b) Chrome extension first, (d) desktop app second. Never (c) without strong user demand.

---

# ADR-2: Hosting and EU data residency
Status: Proposed — database/sign-in part superseded by ADR-5   Date: 2026-10-15   Deciders: Shurik, Clinical Lead

## Context
Everything that touches session data must stay in the EU (GDPR Article 9 health data). We are a tiny team, so we want managed services that are fast to build on, while keeping an exit path. Three things need homes: (1) database + login + file storage, (2) the web app, (3) the speech-to-text worker, which needs a GPU in production to transcribe a 50-minute session in under 3 minutes.

Important nuance: "EU region" is not the same as "EU company". Supabase, Vercel and AWS are US companies running servers in the EU. That is legal under GDPR with a signed DPA and the EU–US Data Privacy Framework / Standard Contractual Clauses, and it is what most competitors do, but some Irish clinicians and DPIA reviewers will ask about it. We record this honestly in `docs/subprocessors.md`.

## Decision
1. **Database, login, file storage: Supabase, Frankfurt region (eu-central-1).** Postgres with row-level security, built-in magic-link auth and passkeys, and storage for short-lived audio chunks. All data access goes through a thin storage layer in our code so we can move to self-hosted Postgres + S3-compatible EU storage later.
2. **Web app: Vercel, with server functions pinned to Frankfurt (`fra1`).** The marketing pages can be served from Vercel's global CDN (no personal data); every route that reads or writes session data runs in Frankfurt. Audio uploads go **directly** from the browser to Supabase storage (signed URLs), not through Vercel.
3. **Speech-to-text worker:**
   - *Development (M3):* runs on Shurik's Mac on the CPU. Slower, free, synthetic/role-play audio only.
   - *Pilot (M6):* one **Hetzner dedicated GPU server (GEX44, Germany/Finland)**, a German company, roughly €185/month plus a one-time setup fee. It runs the worker loop, transcription, diarization and the calls to the LLM.
   - Alternative kept on file: Scaleway (French company) L4 GPU instances by the hour, if we need to scale up and down.
4. **Email for magic links:** an EU-based transactional email provider (Brevo, France; free tier is enough for the pilot). Supabase's built-in email is too rate-limited for real use. Login emails contain no client data.

## Options considered

| Area | Option | Complexity | Cost / month | Privacy / EU | Time to build |
|---|---|---|---|---|---|
| Database + auth | **Supabase EU** | Low | Free → ~$25 (Pro) | EU region, US company, DPA available | Fast |
| | Self-managed Postgres (Hetzner/Scaleway) + own auth | High | ~€15–40 + our time | EU region, EU company | +3–4 weeks |
| Web host | **Vercel, `fra1`** | Low | ~$20 (Pro, per seat) | EU functions, US company | Fast |
| | Fly.io / Render, Frankfurt | Medium | ~$10–30 | EU region, US companies | +1 week |
| | Scaleway Serverless Containers | Medium | ~€10–30 | EU region, EU company | +1–2 weeks |
| GPU for speech-to-text | **Hetzner GEX44 dedicated** | Low–medium | ~€185 fixed | EU company | Fast |
| | Scaleway L4 by the hour | Medium (start/stop logic) | ~€0.75/hour; ~€550 if always on | EU company | +1 week |
| | OVHcloud GPU | Medium | similar range | EU company | +1 week |
| | Hosted speech APIs (e.g. US vendors) | Low | per minute | Weaker: another sub-processor, often US | Fast, but rejected for privacy |

## Consequences
- **Easier:** we get login, database, security rules and storage in days instead of weeks; predictable GPU cost; data stays in Frankfurt/Germany.
- **Harder:** we depend on US-headquartered providers for the database and web tier; Supabase's free tier pauses idle projects and has no backups (fine for synthetic data, not for the pilot); one GPU server is a single point of failure (acceptable for 10 pilot therapists; jobs simply wait and retry).
- **Revisit when:** a DPIA reviewer or customers require EU-owned providers → move database to self-hosted Postgres and web to Scaleway; more than ~40 active therapists → second GPU or hourly GPUs.

---

# ADR-3: LLM provider and data handling
Status: Proposed   Date: 2026-10-15   Deciders: Shurik, Clinical Lead

## Context
The note, reflection and client-timeline steps use Claude. Transcripts are health data. We need: processing in the EU, no training on our data, and as little retention by the provider as possible. We also want to build quickly in development.

## Decision
- Build one `LLMProvider` interface in the worker with two implementations:
  - **`AnthropicDirect`** (Anthropic's own API): **development only, synthetic and role-play transcripts only.** Anthropic does not train on API data by default, but standard API data is processed outside the EU and kept for a limited period, so it is not where real client data goes.
  - **`BedrockEU`** (Claude via Amazon Bedrock in an EU region, e.g. Frankfurt): **required before any real client data.** AWS keeps processing in the selected EU region(s), does not store prompts/outputs or use them for training, and is covered by the AWS GDPR DPA. Exactly which Claude models are offered in EU regions at the time we switch (M6) will be checked and recorded here.
- A setting `ALLOW_REAL_CLIENT_DATA` is **`false` by default**. While false, the app shows "Demo mode: use role-play sessions only", and the worker **refuses** to use any provider other than `BedrockEU` when it is true.
- **Model choice:** start every step on **Claude Opus 5.5** (best quality for the supervisor-style reflection). Once the evals exist (M4), test whether the cheaper **Claude Sonnet 5.5** keeps the Clinical Lead's ratings at ≥ 4/5 for the simpler steps (transcript clean-up, timeline). The final choice is a quality-vs-cost decision for Shurik and the Clinical Lead.
- Every saved output records `model_id` and `prompt_version`.
- Only the transcript text and pseudonymised context are sent, never audio, client names or therapist contact details.

## Options considered

| Option | Complexity | Cost per 50-min session* | Privacy / EU | Time to build |
|---|---|---|---|---|
| Anthropic API direct (dev only) | Low | ~€0.25 (Sonnet 5.5) – €0.55 (Opus 5.5) | Not EU-resident; fine for synthetic data | Fast |
| **Claude on Bedrock, EU region (real data)** | Medium (AWS account, permissions) | Similar; AWS sets its own prices | EU region, no storage, no training, AWS DPA | +1 week at M6 |
| Claude on Google Vertex, EU region | Medium | Similar | Comparable | +1 week |
| Self-hosted open-source model on our GPU | High | GPU cost only | Best | Months; clearly lower quality today |

\* Rough estimate: ~45k input + ~20k output tokens across all pipeline steps. Anthropic list prices: Opus 5.5 $4 / $20 and Sonnet 5.5 $2 / $10 per million input / output tokens.

## Consequences
- **Easier:** fast development with Anthropic's API; a single code switch moves us to EU processing; per-session cost is small compared with €39/month pricing.
- **Harder:** two providers to test; Bedrock sometimes gets new models later than Anthropic's own API; an AWS account adds setup.
- **Revisit when:** Anthropic offers a contractual EU data-residency option on its own API (re-compare), or Bedrock EU lacks a model we need.

---

# ADR-4: Positioning guardrail
Status: Proposed   Date: 2026-10-15   Deciders: Shurik, Clinical Lead

## Context
Software that gives information used to make therapeutic decisions is generally a **Class IIa medical device** under EU MDR, and likely high-risk under the AI Act: 12–24 months and significant cost to certify. The prototype's live advice and suicide-risk marker fall into that category. Our business only works if the product stays clearly on the **documentation and professional-development** side of that line until we are funded to certify.

## Decision
The product does **post-session documentation and reflective practice only**:
- **No live, in-session advice.** Nothing is analysed until the therapist presses "End session".
- **No risk scoring, alerts or classification** (suicide, self-harm, harm to others, safeguarding).
- **No diagnosis suggestions** or diagnostic codes.
- Notes **document faithfully** what was said, including safety-related statements, in neutral factual language, without rating or flagging them.
- Reflection is about **the therapist's technique**, not the client's condition.

How it is enforced:
1. **Data shape:** the JSON schemas for notes and reflections have **no fields** for risk level, diagnosis or alerts. If the model can't put it anywhere, it can't show up in the product.
2. **Prompts:** every prompt in `services/worker/prompts/` begins with the same guardrail block; prompt changes are reviewed against this ADR.
3. **Automated checks:** a list of forbidden terms (`evals/forbidden_terms.txt`, e.g. diagnostic labels, "risk score", "high risk") is checked on every eval run **and** on every generated note before it's shown; a hit sends the note back for one regeneration and is logged (without content).
4. **No real-time path in code:** the worker only accepts jobs for sessions marked "ended". There is no streaming-analysis endpoint. *Exception (2026-10-15):* the research-only live mode in ADR-10, limited to named founder accounts and never active with real client data.
5. **UI and marketing copy:** never "AI detected…", "risk", "diagnosis", "clinically validated", "medical device", "GDPR certified" or "HIPAA". Copy says "You decide." A copy checklist is part of every feature's definition of done.
6. **Code review:** any pull request touching prompts, schemas or clinical wording is tagged `CLINICAL-REVIEW` and listed in `docs/clinical-review.md` for the Clinical Lead.
7. The prototype's live-advice loop and risk marker are **not ported**.

## Options considered

| Option | Complexity | Cost | Privacy / EU | Time to build |
|---|---|---|---|---|
| **Post-session reflection only (this ADR)** | Low | No certification cost | Lowest regulatory exposure | Fits MVP plan |
| Include risk flagging "for information only" | Low to build | High: likely pulls us into MDR Class IIa | Higher | Blocks launch 12–24 months |
| Include live in-session suggestions | Medium | High: MDR + AI Act high-risk | Higher | Blocks launch 12–24 months |

## Consequences
- **Easier:** we can launch to paying therapists without device certification; clear story for the DPIA and for clinicians ("a supervisor's notebook, not a clinician").
- **Harder:** some therapists will ask for risk alerts or live help; we say no for now. We must stay disciplined in marketing as well as code.
- **Revisit when:** we have funding and a regulatory consultant for an MDR pathway; a regulatory lawyer should confirm this boundary before the pilot uses real client data.

---

# ADR-5: Self-contained Postgres and our own sign-in instead of Supabase
Status: Accepted (for development; revisit before pilot)   Date: 2026-10-15   Deciders: Shurik (delegated to engineering)

## Context
ADR-2 proposed Supabase (Frankfurt) for database, sign-in and storage. Building locally on Supabase needs Docker Desktop or a cloud account before anything runs. We also want an easy exit from US-headquartered providers if a DPIA reviewer asks for it.

## Decision
- **Database:** plain PostgreSQL. Locally it runs from the project folder (`npm run db:start`, no Docker). In production any EU managed Postgres works — Supabase's Postgres in Frankfurt, Scaleway or OVH (French) or a Hetzner server (German).
- **Row-level security** is enforced in Postgres itself: the web app connects as `app_user`, which cannot bypass RLS, and sets the signed-in therapist per transaction. The worker uses `worker_user`, which can.
- **Sign-in:** Better Auth (open-source library) with email magic links, passkeys and optional authenticator-app 2FA, stored in our own database.
- **File storage:** a small storage layer with two drivers — local folder (dev) and any S3-compatible EU object storage (prod).

## Options considered
| Option | Complexity | Cost | Privacy / EU | Time to build |
|---|---|---|---|---|
| Supabase (auth + DB + storage) | Low | Free → ~$25/mo | EU region, US company | Fast, but needs Docker/cloud account to start |
| **Postgres + Better Auth + S3 layer** | Medium | Any EU Postgres (~€15–30/mo) | Can be fully EU-owned | +2 days, done |
| Auth.js / own magic-link code | Medium–high | — | Same | Slower; fewer features (passkeys, 2FA) |

## Consequences
- **Easier:** runs on a laptop with no accounts; provider-neutral; RLS tested in our own test suite.
- **Harder:** we operate sign-in ourselves (keep Better Auth updated); the auth tables are readable by the app role (no RLS) — every auth query must filter by the signed-in user.
- **Revisit when:** choosing pilot hosting (pick the EU Postgres + S3 provider and record it here).

---

# ADR-6: Encryption of transcripts and notes
Status: Proposed   Date: 2026-10-15   Deciders: Shurik, Clinical Lead

## Context
Transcripts, notes and reflections are special-category data. Managed Postgres encrypts disks at rest, but anyone with database access (or a leaked backup) can read rows.

## Decision (proposed for M6 hardening)
Per-therapist **envelope encryption** of `transcript_segments.text`, `notes.content_json`, `reflections.content_json` and `sessions.recap_text`: each therapist gets a data key, itself encrypted by a master key held in an EU key-management service (e.g. AWS KMS eu-central-1 or Scaleway Key Manager). The web app and worker decrypt only when needed. Deleting a therapist's data key makes all their content unreadable ("crypto-shredding"), which also covers backups.

## Options considered
| Option | Complexity | Cost | Privacy / EU | Time to build |
|---|---|---|---|---|
| Disk encryption only (provider default) | None | Included | Baseline | Done |
| **Per-therapist envelope encryption + EU KMS** | Medium | ~€1–5/mo | Strong; crypto-shredding | ~1 week |
| Client-side (browser) encryption | High | — | Strongest | Breaks server-side AI processing |

## Consequences
- **Easier:** strong story for the DPIA; deletion covers backups.
- **Harder:** full-text transcript search must happen after decryption (fine at our scale); key management must be operated carefully.
- **Revisit when:** before real client data (part of the M6 checklist).

---

# ADR-7: Re-authentication rules
Status: Accepted   Date: 2026-10-15   Deciders: Shurik (delegated to engineering)

## Decision
- Sessions last 12 hours (`SESSION_HOURS`).
- **Bulk exports** ("download all my data", "export this client") and **deletions** of a client or the account require a sign-in from the last 15 minutes; otherwise the therapist is asked to sign in again.
- Single-note PDF/Word exports do not ask again (they are part of everyday work) but are written to the audit log.
- Sign-in is rate-limited (Better Auth, stored in the database).

## Consequences
Protects the highest-impact actions without making daily note-writing tiresome. Revisit if pilot therapists share devices.

---

# ADR-8: Languages
Status: Accepted   Date: 2026-10-15   Deciders: Shurik

## Decision
English and Russian. All interface text lives in `apps/web/messages/{en,ru}.json`. Inside the app the language is chosen **only in Settings → Profile**. Public pages have a quiet "English · Русский" link in the footer (added Oct 2026) that sets the same cookie; a signed-in therapist's Settings choice always wins. It also sets the language of notes and reflections; speech-to-text detects the session language automatically. Ukrainian is dropped for now and can be added later by adding `uk.json` and one line in `src/i18n/request.ts`.

---

# ADR-9: Refusal fallbacks on Anthropic's API (development)
Status: Accepted   Date: 2026-10-15

## Decision
Development calls to Anthropic's API use the server-side `fallbacks: "default"` option: if a safety classifier declines a request (rare, but possible with therapy content such as self-harm disclosures), the API re-runs it on Anthropic's recommended fallback model within the same call. This is not available on Bedrock; there, a refusal fails the step and the session shows "couldn't finish — try again". The model that actually ran is stored on every output row.

---

# ADR-10: Live research mode (an experiment, not a product feature)
Status: Accepted   Date: 2026-10-15   Deciders: Shurik (Clinical Lead to review)

## Context
Shurik and the Clinical Lead want to find out whether short suggestions *during* a session actually help a therapist, the way the original prototype did. ADR-4 keeps live advice out of the product, because in the EU it is likely a Class IIa medical device and high-risk under the AI Act. The therapist making the final decision does not change that classification; the intended purpose does.

## Decision
Build live suggestions as a **private research mode** that is never sold, marketed or shown to pilot users:
- Only sign-in emails listed in `LIVE_RESEARCH_EMAILS` see the switch (on the recording screen). It is **off for everyone** when that list is empty, and **always off** when `ALLOW_REAL_CLIENT_DATA=true`. Role-play sessions only.
- While recording, the browser also sends short, self-contained ~8 s clips (`live_mic`, `live_tab`, `live_room`). The worker transcribes each one with a fast speech model (`LIVE_WHISPER_MODEL`, `small` on a laptop), **deletes the clip straight away**, and stores the words in `live_lines`.
- Every `LIVE_EVERY_SECONDS` (30 s) the AI (`LIVE_MODEL`, default Sonnet 5.5) sees the last 4 minutes and writes a short read into `live_insights`: what is happening now, up to two openings (each must quote the client's exact words, or it is dropped), and at most one idea in the therapist's modality.
- The same boundaries as ADR-4 apply: no diagnosis, no risk scoring or alerts, safety statements described neutrally and left entirely to the therapist; forbidden-terms check on every read. The prompt is marked `CLINICAL-REVIEW`.
- The database refuses live clips for sessions where live research was not switched on, and the normal consent gate still applies. Live lines and reads are private to the therapist (row-level security), included in data exports and deleted with the session.
- The usual after-session pipeline is unchanged and ignores live clips. Reads shown during the session are listed afterwards on the session page so they can be compared with how the session went.

## Options considered

| Option | Complexity | Cost | Privacy / EU | Time to build |
|---|---|---|---|---|
| **Research mode behind an allow-list (this ADR)** | Medium | ~€0.30–1 of AI per hour of session with Sonnet; more with Opus | Same as development (role-play only, Anthropic API) | ~1 day |
| Ship live suggestions in the product | Medium | MDR Class IIa + AI Act certification | Higher exposure | Blocks launch 12–24 months |
| Do nothing | None | None | None | — |

## Consequences
- Easier: real evidence (with the Clinical Lead) about whether live suggestions are worth certifying later.
- Harder: one more moving part in the worker; laptop CPU is the limit (two speech streams in real time), which is why live mode uses the smaller speech model.
- Revisit when: funding for certification exists, or a lawyer advises on the research use. Never enable for pilot therapists or real clients without a new ADR.

---

# ADR-11: Pilot access — request, review, approve
Status: Accepted   Date: 2026-10-18   Deciders: Shurik

## Context
The pilot goes to real therapists through a public link. We want only qualified therapists and trainees in, to control AI costs, and to know who is using the product, without collecting identity documents.

## Decision
- Anyone can **request access**: sign in with their email, then fill in their profile, including **professional body, membership/registration number and country**.
- New accounts are **pending**. They see "we're reviewing your request" and the **database refuses** to let them add clients or start sessions (`enforce_access` trigger). A therapist cannot change their own status (`lock_access_fields` trigger).
- **Admins** (named by email with `node scripts/pilot.mjs admin <email>`) see an **Admin** page: approve, decline or remove access, with a link to the relevant public register (IACP, PSI, CORU, BACP…) for a manual check. Admins can also **invite** people from the waiting list; invited emails are approved automatically when they sign up.
- Emails: admins get "a new request is waiting" (no personal details in the email); therapists get "your account is ready" or "you're invited" in their own language.
- No ID documents are uploaded. Registration numbers are checked by hand.

## Options considered
| Option | Complexity | Cost | Privacy | Time |
|---|---|---|---|---|
| Open sign-up | None | AI cost exposure | Anyone gets in | — |
| **Request + manual approval (this ADR)** | Low | None | Minimal extra data (body, number) | ~1 day |
| Automated register lookup | High | Scraping/API agreements | Same | Weeks; registers differ |
| ID document upload | Medium | ID-check vendor | Collects sensitive ID data | Rejected |

## Consequences
- Easier: controlled pilot; a clear list of who is in.
- Harder: someone must check requests (a minute each).
- Revisit when: paid plans launch (self-serve sign-up with verification later).

# ADR-12: Name "CouchNote" and the companion "Arch"
Status: Accepted (working name)   Date: 2026-10-19   Deciders: Shurik, Clinical Lead

## Context
"Antara" clashed with existing companies and with "Tara", the AI companion of another therapy app. We needed a working name we can ship the pilot with, and the companion designs (the "Soft Arch" character) needed a name that is not already a therapy companion.

## Decision
- The product is called **CouchNote** for now. Only the display name changed; the logo mark and colours stay.
- The companion is **Arch**: the soft-arch character with a small door and light on its chest. It is animated in the web app: the landing-page hero, Today, recording, processing and sign-in.
- **Arch's rules:**
  - Its moods only show its own work (listening, writing, ready, resting). It never reacts to what a client said, because that would be judgement and close to risk-flagging (ADR-4).
  - Its door light is on only while audio is being heard or processed.
  - All motion stops for people who ask their device for reduced motion.
  - The landing-page animation has a pause button.

## Options considered
| Option | Complexity | Cost | Privacy/EU | Time |
|---|---|---|---|---|
| Keep "Antara" | none | legal risk | — | — |
| CouchNote + Arch (chosen) | low | none | — | 1 day |
| Family-name based (Alento + Tosha) | low | domain likely needs buying | — | 1 day |

## Consequences
- Easier: the brand is consistent across the app and emails, and Arch makes the product feel warm and recognisable.
- Harder: "CouchNote" has not had a trademark search yet.
- Revisit: before any paid launch, do a TMview/EUIPO search and buy a domain. A rename is mostly text-only changes, plus the Hetzner server folder name.

# ADR-13: Sign in with an email code instead of a one-time link
Status: Accepted   Date: 2026-10-19   Deciders: Shurik

## Context
Many therapists use work email (HSE, clinics, universities) that is protected by security scanners such as Microsoft Defender Safe Links or Mimecast. These scanners open every link in an email to check it. That uses up a single-use magic link before the person clicks it, so they see "link expired". Links also sign you in on whichever device opens the email, often the phone rather than the laptop you were using.

## Decision
- Sign-in uses a **6-digit code** sent by email, which the person types on the sign-in screen. Passkeys (Face ID, Touch ID, Windows Hello) stay as the one-tap option.
- After the first sign-in, Today offers once to add a passkey.
- The code expires in 10 minutes and is stored hashed. Each code allows 5 tries. Each IP address can request at most 3 codes a minute.
- Local development has `/dev/login`: one click signs in as a test persona. It goes through the same code path and is disabled on any production build.

## Options considered
| Option | Complexity | Cost | Privacy/EU | Time |
|---|---|---|---|---|
| Magic link (before) | low | none | same | — |
| Email code (chosen) | low | none | same | hours |
| Link that opens a "confirm" page | medium | none | same | hours; still the wrong device |

## Consequences
- Easier: works with scanned work email and across devices; no "link expired" support requests.
- Harder: one more step (typing 6 digits). Phones autofill codes from email on iOS and macOS.
- Revisit: if pilot users still struggle, consider "trust this device for 30 days".

# ADR-14: Client app and therapist verification documents
Status: Accepted (pilot)   Date: 2026-10-19   Deciders: Shurik (Clinical Lead to review items 15–17)

## Context
Therapists want to share homework and session dates with clients between sessions, and clients want somewhere to note how they feel. Until now, clients were not users at all. Separately, approving therapists by hand is faster with a document to look at.

## Decision
- **Two roles, one sign-in system.**
  - A user is a **client** if they were linked through an invite. Everyone else is a therapist.
  - Clients only ever see `/me`. Therapist pages redirect them, and row-level security hides every clinical table from them (tested).
- **Invites:**
  - The therapist creates a one-time code (`K7P4-QM2X`), shown as a link plus a QR code. It is valid for 7 days, and only a hash is stored. Creating a new code cancels the old one.
  - The client signs in with **their own email**, which the therapist never sees.
  - Code attempts are limited to 20 per 10 minutes per IP address.
- **What a client gets:**
  - homework (mark it done, add a short reply);
  - the next session date (entered by hand; not a booking system);
  - a mood diary, where each entry can be shared or kept private.
- **Limits:**
  - No AI ever processes client-app content, and nothing is scored or flagged (ADR-4).
  - A static crisis signpost is shown on every client page.
- **Client rights:** a client can download their data and delete their account; deleting it removes their diary. The therapist can disconnect a client at any time.
- **Therapist sign-up:**
  - Full name (as on the register) is required, and so is a registration number unless they are a student.
  - A licence or membership document is optional (PDF, JPG or PNG, up to 4 MB, checked by content).
  - Only the therapist and admins can open documents, and they open in a sandbox. They are deleted 30 days after the access decision.

## Options considered
| Option | Complexity | Cost | Privacy/EU | Time |
|---|---|---|---|---|
| Code + link the therapist shares (chosen) | low | none | the therapist never handles the client's email | 1 day |
| We email the client | low | email | the client's email sits in the therapist's account | 1 day |
| Native mobile app | high | store fees | same | weeks |

## Consequences
- Easier: homework and the diary connect the time between sessions, without any clinical AI.
- Harder: client emails and mood diaries are new personal and health data, so the DPIA and privacy notice must be updated before real clients use it. Clients become data subjects with their own accounts.
- Revisit: email or push reminders (needs a scheduler), and whether "shared by default" is right (Clinical Lead).

# ADR-15: Russian-speaking therapists, and the question of serving Russia
Status: Proposed (needs legal advice before residents of Russia are accepted)   Date: 2026-10-19   Deciders: Shurik

## Context
Shurik wants CouchNote for both the EU and Russia.

## Decision (now)
- A first-time visitor whose browser is set to Russian sees the site in Russian. Code emails follow the same rule.
- At sign-up the therapist picks a country: Ireland, UK, another EU country, Ukraine, Russia, or other. The list of professional bodies shows that country's organisations first, including the Russian ones (RPA, OPPL, RPS, AKP and the state diploma). "Other" lets them type any organisation.
- Every account is still approved by hand on the Admin page.

## Why residents of Russia are not opened up yet
- **Russian law 152-FZ (data localisation):** personal data of Russian citizens must first be recorded in databases located in Russia. Ours is in Frankfurt. Health data also needs explicit written consent.
- **Providers:** Anthropic (Claude) does not support use from Russia. Stripe does not operate there. Hosting providers may restrict it.
- **EU sanctions:** EU Regulation 833/2014 limits some IT and software services to Russian entities. This needs a lawyer's opinion.

## Consequences
- Russian-speaking therapists in the EU are fully served now. This was already customer group 5 in CLAUDE.md.
- Serving residents of Russia would need a separate Russian deployment, with local hosting, a local AI provider and local payments, after legal review.

# ADR-16: Rename to HavenSpace
Status: Accepted (working name)   Date: 2026-10-19   Deciders: Shurik

The product is renamed from CouchNote to **HavenSpace**. Only the display name and internal labels changed; the logo, colours and Arch stay the same. The live address is still havenspace-app.vercel.app until a new address is chosen.

**Name check (quick web search, not legal advice):** there is a small "Haven" AI wellbeing hobby project hosted at havenspace-support (a free site builder), "The Haven Space" (a coaching page), and many counselling centres called "Haven". There is no large company with this name, but "Haven" is common in mental health. Search TMview/EUIPO (classes 9, 42, 44) before buying a domain or paying for branding.


# ADR-17: In-app video sessions with LiveKit
Status: Accepted (pilot)   Date: 2026-10-20   Deciders: Shurik
## Context
Therapists asked to hold sessions inside HavenSpace instead of Zoom, with booking later. Video and booking will be included in every plan, Free too (Shurik's decision), so HavenSpace becomes the place therapists open every day.
## Decision
Build our own video room on **LiveKit Cloud** (project region: EU, Frankfurt; agent observability off). HavenSpace decides who may enter (row-level security on `video_rooms`) and hands out short-lived entry passes; LiveKit only carries the media.
- The therapist opens a room from the client page; a linked client sees "Join now" in the client app.
- Nothing is recorded by default. "Record for notes" creates an ordinary online-call session, so the **consent gate** applies, and records the therapist's microphone and the client's audio as two separate tracks (`mic`, `tab`), so the existing worker labels speakers exactly as for browser tab capture.
- Ending the session closes the room for both people.
## Options considered
| Option | Complexity | Cost (pilot) | Privacy / EU | Time to build |
|---|---|---|---|---|
| **LiveKit Cloud (chosen)** | Medium: we build the screens | Free tier 5,000 participant-minutes/month | EU project region; can move to self-hosted LiveKit on our own EU server later | 1–2 days |
| Whereby Embedded | Low: ready-made room in an iframe | Free tier 2,000 minutes/month | EU hosting available; their UI and branding | ~1 day |
| Zoom / Meet links | None | Therapist's own subscription | Third party in the room; no clean two-track audio | — |
## Consequences
- Easier: notes from video sessions get two clean speaker tracks; one product for the whole session.
- Harder: we maintain the call screen; LiveKit becomes a sub-processor (listed) and must be in the DPIA.
- Revisit: booking; end-to-end encryption; self-hosting LiveKit in the EU before real client data.

**Update 2026-10-20: entry point and one-time links.** A video call is chosen like any other session: *Start session → client → "Video call in HavenSpace"* (first option, no consent needed for the call itself; recording still needs consent). In the room, "How [client] joins" offers the client app (automatic "Join now") and a **one-time link** for clients without the app. Links carry 32 random bytes; only a hash is stored; they work while the room is open, for at most 4 hours, and stop when the session ends or a new link is made. A guest joins with the same identity as the client, so a forwarded link replaces rather than adds a person. The guest page shows only the therapist's name.

**Update 2026-10-21: automatic recording and transparency.** Before joining, the therapist can choose "Record for notes automatically when [client] joins" (on by default only when consent is on file). Recording waits for the client's audio, so it starts when they join; if they never join, the empty draft is removed. The client's screen always shows "[therapist] is recording this session for notes" while it records (signalled through the therapist's LiveKit participant attributes; only the therapist's entry pass may set them). For accounts in live research mode (ADR-10, role-play only), live suggestions also work in video, from short clips sent next to the recording.

**Update 2026-10-21: screen sharing.** Either person can share the whole screen, any app window or a browser tab from a computer, as in Zoom or Teams: the browser's picker opens on the entire screen and the choice can be switched while sharing (phones can watch but browsers there can't share). One share at a time: while one person shares, the other's button waits. The shared screen takes the stage, shown whole, with both cameras small beside it and a Full screen button. Sound is shared only from a single browser tab ("Share tab audio"), never the whole computer's sound, so the call can't echo back. The HavenSpace tab itself is excluded from the picker. Recording for notes is unchanged: only the two microphones are recorded, never the shared screen or its sound.


# ADR-18: Accounts with email and password, chosen role at sign-up
Status: Accepted   Date: 2026-10-21   Deciders: Shurik
## Context
Accounts used to be created by the first 6-digit email code, with an optional password later. Shurik wants the familiar pattern: a clear "Create account" with a password, a confirmed email, a name and a photo, and a separate "Sign in".
## Decision
- **Sign up** (`/signup`): "I'm a therapist" / "I'm a client" → (clients: the therapist's invite, by link or typed code) → first name, last name, email, password (10+ characters) → a 6-digit code confirms the email (it signs them in) → optional photo. Therapists continue to professional details and admin approval (ADR-11); clients are connected to their therapist (ADR-14). Invite links skip the role question.
- **Sign in** (`/login`): email + password; or a passkey (Touch ID, Face ID, Windows Hello); "Forgot password?" resets with an email code; signing in with only an email code stays as a fallback (and for older accounts without a password).
- Codes **never create accounts**. An account whose email was never confirmed cannot sign in until it is, and is deleted after 2 days.
- Signing up with an address that already has an account looks identical on screen; the owner is emailed instead. Nobody can learn who uses HavenSpace (and so who may be in therapy).
## Consequences
- Easier: a pattern everyone knows; password managers work; fewer emails day to day.
- Harder: passwords to protect (hashed by the auth library, 10+ characters, rate-limited sign-in).
- Existing accounts without a password sign in with a code or use "Forgot password?" once.


# ADR-19: Arch as an AI practice agent ("Ask Arch")
Status: Accepted (pilot, role-play data)   Date: 2026-10-21   Deciders: Shurik
## Context
Shurik wants Arch to be a real AI agent, not only a mascot: competitors (Upheal, Blueprint, Heidi) lead with an assistant you can ask. Our positioning guardrail (ADR-4) still applies: no diagnosis, no risk scoring or alerts, no in-session advice.
## Decision
- "Ask Arch" page (button in the app header) and "Brief me" on each client page. Claude with tool use, streamed.
- Tools run as the therapist inside row-level security: list clients, client overview, search transcripts, one session, practice numbers. Answers cite the exact transcript moments as links (`/sessions/<id>?moment=<segment>` opens the transcript there).
- Actions are only proposed (homework, next session); nothing changes until the therapist presses Approve, which is validated again on the server.
- Limits in the instructions (CLINICAL-REVIEW item 18): no diagnosis or speculation, no risk rating, no treatment decisions, no unasked "flags" of safety content; asked about safety, Arch shows what was said and points to safeguarding and supervision.
- Conversations aren't stored; the audit log records only that Arch was asked. 150 questions per therapist per day.
- Claude API direct while ALLOW_REAL_CLIENT_DATA=false; Arch switches off when real data is allowed until Claude in the EU (Bedrock, ADR-3) is wired in.
## Consequences
- Easier: the product is visibly an AI agent; therapists find things in seconds; admin done with one click.
- Harder: another AI surface to evaluate; the Clinical Lead must review the instructions and refusals.
- Next: after-session autopilot (proposals bundled on the review screen), supervision-pack agent, nudges, voice.

# ADR-20: Downloadable apps for Mac, Windows and Android
Status: Accepted (test builds)   Date: 2026-10-21   Deciders: Shurik
## Context
Shurik wants big "Download for Mac / Windows / Android" buttons on the homepage, downloading straight from our site (App Store and Google Play later). The installable web app (PWA) already works, but people expect a real file to download. The apps must keep every feature: video calls, camera, recording for notes and screen sharing.
## Decision
- **Mac and Windows: Electron**, a window onto the live HavenSpace site using Chrome's engine (as Slack, Teams and Notion do). Everything behaves as in Chrome. The app holds no data; it only opens havenspace-app.vercel.app, sends other links to the person's browser, and allows the camera, microphone and screen only for HavenSpace. Screen sharing: the macOS system picker on macOS 15+, otherwise our own picker (entire screen or any app window, as in Zoom or Teams). HavenSpace's own windows are left out.
- **Android: a Trusted Web Activity** (Google's way to package a web app; made with Bubblewrap). It runs in Chrome, so camera, microphone and sign-in work as in Chrome. It shows no address bar once our site lists the app's signing fingerprint (`/.well-known/assetlinks.json`).
- **Builds happen on GitHub's computers** (`.github/workflows/apps.yml`), so nothing is installed on our Macs. The files would be published as a GitHub release and linked from the homepage.
- **Test builds are unsigned** (Mac: ad-hoc signature, so it opens via "Open Anyway"; Windows: "More info → Run anyway"). Paid signing comes before launch (Apple Developer $99/year; a Windows certificate about €100–300/year).
## Options considered
| Option | Complexity | Cost | Privacy/EU | Notes |
|---|---|---|---|---|
| Electron (chosen for desktop) | Low | €0 | Same as browser | ~100 MB download; Chrome engine everywhere, so screen sharing and recording behave the same |
| Tauri | Low | €0 | Same as browser | ~10 MB, but uses Safari's engine on Mac: screen sharing and recording inside it are uncertain |
| PWA install only | None | €0 | Same | Already there; not the "download a file" experience Shurik wants |
| Android Trusted Web Activity (chosen) | Low | €0 | Same | Accepted by Google Play later |
| Android WebView wrapper | Medium | €0 | Same | Camera and passkeys need extra work |
## Consequences
- Easier: one codebase. The apps update themselves because they open the live site.
- Harder: unsigned test builds show a security step on first open. Passkeys (Touch ID) in the Mac app need the paid Apple signature; email + password works.
- Android signing key: created 2026-10-21. The private copy is in `.secrets/android/` on Shurik's Mac (never committed; back it up somewhere safe) and a locked copy is in GitHub secrets. Every Android update must be signed with it; if it's lost, people have to reinstall the app once. The site's `/.well-known/assetlinks.json` lists its fingerprint so the app shows no address bar.
- Checks before every release: the Mac app's signature is verified; the Mac and Windows apps are started and must open HavenSpace with camera, microphone and screen sharing available; the Android app's signature must match the site, and it's installed and screenshotted on a virtual small phone, phone and tablet (light, dark, landscape). The release is published only if all of them pass.
- **Platform only inside the apps (Shurik, 2026-10-21).** Someone who downloaded the app came from the website, so the apps never show the homepage: they open on sign-in or the workspace, signing out returns to sign-in, and links to website pages (home, pricing, privacy, legal) open in the person's browser. A small "HavenSpace website ↗" link (sign-in page, and the Help menu on Mac and Windows) is there for anyone who wants it. The same applies when HavenSpace is installed from the browser. Detected per window (Electron, or a standalone window), never by cookie, so the same person's ordinary browser tabs still show the website (`lib/app-window.ts`).
- Revisit: Google has announced developer verification for apps installed outside Google Play (some countries from 2026, everywhere from 2027). Register as a Google developer before that, or move Android to Google Play.
