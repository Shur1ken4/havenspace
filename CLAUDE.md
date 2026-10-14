# CLAUDE.md — Psych Copilot (working name)

> **How to use this file:** put it in the root of an empty project folder, open Claude Code in that folder, and paste the kickoff prompt at the bottom (section 14). Claude Code reads `CLAUDE.md` automatically in every session, so this is the permanent project brief.

---

## 0. Who you are working with (read first)

- **Founder / CEO: Shurik (Aleksandr).** Business and product owner. **Not a developer.** Explain every technical decision in plain language: what it does, why, and what it costs. Before running anything that installs software, creates cloud resources, costs money, or deletes files, explain it in one or two sentences and ask.
- **Clinical Lead: Shurik's father, a practising psychologist.** He built the Python prototype (`psych_copilot`, details in section 3). He decides what is clinically correct. Anything clinical (rubrics, prompts, note templates, wording shown to therapists) is a **draft for his review**. Mark it `// CLINICAL-REVIEW` in code and list it in `docs/clinical-review.md`.
- **Working style:**
  - Build in small milestones (section 11). Finish one, show it running, then stop and summarise in non-technical language: what was built, how to try it, and what is next.
  - Prefer boring, well-documented tools over clever ones.
  - Keep `docs/decisions.md` updated (ADR format, section 12) whenever you make a real choice.
  - Keep a `README.md` that a non-developer can follow to run the app locally.

---

## 1. The business in one page

**What we are building:** an AI assistant for **the people who host therapy sessions**: counsellors, psychotherapists and psychologists, mostly solo private practice in Ireland and later the UK and EU. Clients are not our users.

**Positioning (do not drift from this):** a **post-session reflective-practice and supervision copilot**. After a session it:

1. drafts the clinical note,
2. gives the therapist feedback on **their own technique** against their chosen modality (CBT, MI, DBT, person-centred, solution-focused…),
3. keeps a timeline per client,
4. builds a monthly **supervision pack** for their supervisor.

**What we are deliberately NOT building yet:**

- **No live, in-session advice** ("try technique X now").
- **No suicide/risk scoring, alerts or classification.**
- **No diagnosis suggestions.**

Why: in the EU, software giving information used for therapeutic decisions is generally a **Class IIa medical device** under MDR, and high-risk under the AI Act. That means 12–24 months of certification. The prototype's live mode does exactly this, so it stays out of the product until we are funded to certify it. Notes must still **document faithfully** what was said, including safety-related content; we just don't score or flag it.

**Why Ireland first:** members of IACP (7,000+ members) must have regular, paid clinical supervision: 1 hour per 10 client hours before accreditation, 1:20 to 1:40 after. Nobody helps them prepare for it with data from their own sessions. PSI has ~5,000 psychologist members.

**Customers in order:** (1) newly qualified / pre-accredited counsellors, (2) students on training courses (sold via colleges), (3) accredited supervisors (a free channel, not a revenue line), (4) experienced private-practice psychologists, (5) Russian- and Ukrainian-speaking therapists across the EU.

**Pricing (planned, Stripe later):** Free (5 sessions/month) · Solo €39/month · Growth €59/month (supervision features) · Supervisor free · College ~€15/student/month.

**Hard constraint:** session content is **special-category health data under GDPR Article 9**. Privacy is the product. See section 6.

---

## 2. Competitors: what to learn from them

| Product | What they do well (copy the idea, not the code or visuals) | Our difference |
|---|---|---|
| **Upheal** (upheal.io) | Capture any way: in-person (browser/mobile), virtual (in-app tool, Chrome extension, Mac app, Zoom integration), upload, or dictate a recap. Notes in ~60 s; many templates (SOAP, DAP, BIRP, GIRP…); AI learns writing style; session analytics (talk ratio, cadence, sentiment along a timeline); "audio deleted by default"; opt-out from training. $39/month for notes. | US-first; generic analytics, not modality fidelity |
| **Mentalyc** (mentalyc.com) | Calm watercolour illustrations; "each note builds on earlier sessions"; treatment plans and progress tracking; **"Alliance Genie": feedback "like a supervisor would"**; supervision notes; worksheet matching; client consent template; very clear 3-step "how it works". US data residency. | **Closest to us.** We win on EU data residency, Irish/UK accreditation workflow (hours log, supervision pack), validated fidelity rubrics, and RU/UA/EN |
| **Tandem Health** (tandemhealth.ai) | European trust signals: all data in EU, no audio stored, ISO 27001, MDR Class IIa; "Restoring presence" message; one-click export. | Generalist for doctors and clinics; no therapy craft |
| **Eleos Health** | Session insights and evidence-based-practice feedback for training clinics. | US enterprise only |

Design and copy takeaways:

- Lead with **presence and time**: "Be with your client. We'll handle the rest."
- Show a 3-step "how it works": Capture → Review → Reflect.
- Put **privacy badges and plain-language data promises** on every surface: "Audio deleted after transcription", "Stored in the EU", "Never used to train AI".
- Ship a **free client consent template** as a resource; it builds trust and SEO.

---

## 3. The existing prototype (from the Clinical Lead)

A local **Windows Python app** run during a call:

- Captures the therapist's mic and the call audio via a virtual cable (**VB-CABLE**).
- **Local speech recognition**; only text is sent to Claude.
- Every ~30 s it sends the last 2–3 minutes and gets a short read of the session plus a suggested technique (active listening, CBT, MI, grounding, solution-focused, DBT…). **This live mode is out of scope** (section 1).
- Had a crisis/suicide-risk marker. **Out of scope.**
- **Speaker diarization** with **ECAPA-TDNN voice embeddings (SpeechBrain)**: each speech chunk gets a voice fingerprint and is clustered by cosine similarity. A **"calibrate voice, ~3 s"** button enrols the therapist's voice first, so the first cluster is always "Therapist". It correctly labels the therapist even when their voice leaks into the call channel. **Reuse this logic** in the worker (section 5).
- Consent reminder checkbox; README for Python, VB-CABLE and Zoom/Meet audio.

**Ask Shurik for the `psych_copilot.zip` source** and put it in `/reference/prototype/` (read-only). Port the diarization and transcription code; do not port the live-advice loop.

---

## 4. What to build: the MVP

A **web app** (desktop browser first, works on phone) where a therapist can:

1. **Sign up / log in** (email magic link + optional passkey; 2FA available).
2. **Set up a profile:** name, profession (counsellor/psychotherapist/psychologist), accreditation stage (student / pre-accredited / accredited / supervisor), main modality (multi-select), preferred note format (SOAP, DAP, BIRP, free text), language (EN; RU and UA later).
3. **Add clients** using a **pseudonym or code only** ("Client A", "J.M."). No full names, addresses or dates of birth in MVP. Make this explicit in the UI.
4. **Record consent** per client before any recording: an in-app consent screen the therapist reads with or sends to the client, stored with timestamp, version of consent text and method (verbal-in-session / signed form / e-sign link). Withdrawing consent stops future recording and offers to delete past data.
5. **Capture a session** in one of four ways:
   - **Online call (Zoom / Google Meet / Teams in the browser):** the app records the **therapist's microphone** plus the **meeting tab's audio** via `getDisplayMedia({audio: true})`. The therapist shares the meeting tab with "Share tab audio" ticked. Keep the **two streams as separate tracks** (mic = therapist, tab = client), which makes speaker labelling near-trivial; fall back to diarization when they bleed. Chrome/Edge only; show a clear browser check. On Windows, "entire screen + system audio" also works for the Zoom desktop app. On Mac, guide users to the browser version of the call or to upload/phone capture.
   - **In-person:** record on a phone or laptop placed in the room (mic only) → diarization with therapist voice calibration.
   - **Upload** an audio file they recorded themselves.
   - **Dictate or type a recap** after the session; no client voice is recorded at all. Important for therapists or clients who refuse recording.
   - Show a calm, visible "Recording" indicator, a pause button, a timer, and a 3-second voice-calibration step before starting.
   - Upload audio in **chunks** during recording (resumable), so a crashed tab loses at most ~30 s.
6. **Processing (after "End session"):** transcribe → label speakers → **delete audio** (default on; configurable "keep for 7 days") → run the agent (section 5). Show progress: "Transcribing… Writing your note… Preparing reflection…". Target < 3 min for a 50-min session.
7. **Session page** with tabs:
   - **Note:** editable draft in the chosen format; "Approve" locks it; export to PDF/DOCX/copy.
   - **Reflection:** 3 strengths, 2 missed openings, 1 thing to try next time, plus modality rubric scores. **Every point links to the exact transcript moment.**
   - **Transcript:** speaker-labelled, searchable, editable speaker labels.
8. **Client page:** timeline of sessions, recurring themes, goals, homework (therapist-editable).
9. **Supervision pack (v1, after MVP):** pick a month → summary of client work, chosen excerpts, growth themes, hours log in IACP-friendly format → export PDF to bring to supervision.
10. **Settings → Privacy:** data retention controls, export all my data, delete my account and all data, download the DPA, see the sub-processor list.

**Not in MVP:** billing, scheduling, telehealth video, EHR integrations, meeting bots, native mobile apps (use a PWA), supervisor accounts, college dashboards, live mode.

---

## 5. Architecture

```
┌────────────────────────────┐        ┌───────────────────────────────┐
│  Web app (Next.js, PWA)    │ HTTPS  │  API (Next.js route handlers) │
│  - recorder (MediaRecorder │──────▶ │  - auth, CRUD, signed upload  │
│    mic + tab tracks)       │        │    URLs, job creation         │
│  - note/reflection editor  │        └──────────────┬────────────────┘
└────────────────────────────┘                       │
                                                     ▼
                 ┌───────────────────────────────────────────────────┐
                 │  Postgres (EU region) — app data + jobs table      │
                 │  Object storage (EU) — audio chunks (short-lived) │
                 └───────────────────────┬───────────────────────────┘
                                         │ polls jobs (SKIP LOCKED)
                                         ▼
                 ┌───────────────────────────────────────────────────┐
                 │  Worker (Python, FastAPI-free, simple loop)       │
                 │  1. concat chunks → 16 kHz mono per track         │
                 │  2. ASR: faster-whisper (large-v3 / turbo)        │
                 │  3. Diarization: ported ECAPA-TDNN + calibration  │
                 │  4. delete audio                                  │
                 │  5. Agent pipeline via LLM provider abstraction   │
                 │  6. evidence check, save results, audit log       │
                 └───────────────────────────────────────────────────┘
```

**Stack:**

- **Monorepo:** `apps/web` (Next.js App Router, TypeScript, Tailwind, shadcn/ui, Radix), `services/worker` (Python 3.11, uv or poetry), `packages/shared` (types, JSON schemas, modality packs), `docs/`.
- **Database and auth:** Postgres with **Supabase in an EU region (Frankfurt)** for speed of building (auth, storage, row-level security). Abstract storage access so we can move to self-hosted Postgres plus S3-compatible EU storage later. **Row-level security on every table**: a therapist can only ever see their own rows.
- **Jobs:** a `jobs` table plus a worker loop using `SELECT … FOR UPDATE SKIP LOCKED`. No Redis needed in MVP.
- **ASR:** `faster-whisper` on GPU in production (EU GPU provider, e.g. Scaleway / OVHcloud / Hetzner; propose and compare in an ADR), CPU locally for development.
- **Diarization:** port the Clinical Lead's SpeechBrain ECAPA-TDNN clustering + calibration. When two tracks exist (online calls), use the track as the primary signal and diarization only for bleed.
- **LLM:** Claude. Build an `LLMProvider` interface with two implementations:
  - `AnthropicDirect`: **development only, synthetic and role-play data only.**
  - `BedrockEU` (Claude on AWS Bedrock in an EU region): **required before any real client data.** Confirm current model availability in EU regions when implementing; document it in an ADR.
  - Config flag `ALLOW_REAL_CLIENT_DATA=false` by default. When false, show a banner "Demo mode: use role-play sessions only".
- **Hosting:** web on an EU region (e.g. Vercel with EU functions region, or a Fly.io / Render EU region; propose in an ADR). Everything that touches session data stays in the EU.

### Agent pipeline (the core IP)

Run as **separate, testable steps**, each with a JSON schema for its output (validate with Pydantic; retry once on invalid output):

1. **`clean_transcript`**: fix obvious ASR errors, keep speaker labels and segment ids, never invent words.
2. **`draft_note`**: input: transcript + note format + therapist profile + last 3 approved notes for this client (for continuity). Output: note sections. Rules: factual, third person, no diagnosis, documents safety-related statements accurately without rating risk, marks uncertain items as `[check]`.
3. **`reflect`**: input: transcript + selected **modality pack** + therapist growth history. Output: strengths (3), missed_openings (2), try_next (1), rubric scores. **Every item must cite `segment_ids`.** Tone: a warm, specific, respectful supervisor; never shaming.
4. **`update_client_timeline`**: themes, goals, homework, changes since last session. Each item cites the session and segment ids.
5. **`evidence_check`** (code, not LLM): verify every cited segment id exists and the quoted text appears in it; drop items that fail, log it.

**Modality packs** live in `packages/shared/modalities/*.json`: name, description, rubric dimensions with behavioural anchors, example good and bad moments. Start with drafts inspired by recognised fidelity frameworks (e.g. MITI for motivational interviewing, CTRS / CTS-R for CBT). **Do not copy copyrighted scale text.** Write our own anchors and mark them `CLINICAL-REVIEW`. The Clinical Lead owns these files.

**Prompts** live in `services/worker/prompts/*.md`, versioned. Store `prompt_version` and `model_id` on every output row.

### Data model (first pass)

`therapists` · `clients` (pseudonym, therapist_id) · `consents` (client_id, version, method, given_at, withdrawn_at) · `sessions` (client_id, started_at, duration, capture_mode, status) · `audio_chunks` (session_id, track, path, deleted_at) · `transcript_segments` (session_id, idx, speaker, start_ms, end_ms, text) · `notes` (session_id, format, content_json, status draft/approved, approved_at) · `reflections` (session_id, content_json, modality, prompt_version, model_id) · `client_timeline_items` · `supervision_packs` · `jobs` · `audit_log` (actor, action, entity, at; no content).

---

## 6. Privacy, security and compliance (non-negotiable)

- **EU only:** database, storage, worker, LLM calls. List every sub-processor in `docs/subprocessors.md`.
- **Audio deleted by default** after transcription. A scheduled job hard-deletes expired data; test that it works.
- **Encryption:** TLS everywhere; encryption at rest; consider per-therapist envelope encryption for transcripts and notes (propose in an ADR).
- **No client data in logs, analytics, error trackers or prompts to dev tools.** Scrub before logging. Product analytics only on non-content events, EU-hosted (e.g. Plausible / PostHog EU), and off by default until consent.
- **No training on client data.** State it in the UI and the privacy page.
- **Consent gate:** recording is technically impossible for a client without an active consent record.
- **Audit log** of access to sessions, notes and exports (who, what, when; no content).
- **Data subject rights:** export and delete per client and per account.
- **Auth:** short sessions, re-auth for exports and deletes, 2FA/passkeys, rate limiting.
- **Security basics:** dependency scanning, secrets only in env vars, CSP headers, RLS tests.
- Write `docs/privacy-architecture.md`: data flows, retention, sub-processors. It becomes the input for the DPIA a lawyer will review.
- Product copy must never claim "GDPR certified", "HIPAA", "medical device" or "clinically validated". Say what we actually do.

---

## 7. Design direction: mild, calm, trustworthy

The therapist uses this right after emotionally heavy work. **The interface should feel like a quiet room**: soft, warm, unhurried, never clinical-cold, never startup-loud.

**Palette (CSS variables, light + dark):**

| Token | Light | Use |
|---|---|---|
| `--bg` | `#FAF8F5` warm paper | page background |
| `--surface` | `#FFFFFF` | cards |
| `--ink` | `#2F3A35` deep green-grey | body text |
| `--muted` | `#6E7A73` | secondary text |
| `--primary` | `#6B8F7B` sage | primary buttons, links |
| `--primary-soft` | `#E6EEE9` | selected states, chips |
| `--accent` | `#C9A38A` soft clay | highlights, illustrations |
| `--calm-blue` | `#8FA9B8` | info, transcript speaker 2 |
| `--attention` | `#C98A5B` muted amber | warnings (**no red alarm colours**; use muted terracotta `#B5654A` only for destructive actions) |
| `--border` | `#E7E2DA` | hairlines |

Dark mode: deep warm charcoal `#1E2421` background, same hues desaturated.

**Typography:** headings in a soft serif (e.g. *Fraunces* or *Newsreader*), UI and body in *Inter*. Body 16–17 px, line-height 1.6, generous spacing.

**Shapes and motion:** radius 12–16 px; soft shadows (or none, with hairline borders); slow, gentle transitions (200–300 ms ease-out); a calm breathing pulse for the recording dot, not a blinking red light.

**Imagery:** soft watercolour or line illustrations of rooms, plants, two chairs, light through a window. No stock photos of people in distress, no brains, no robots.

**Voice and copy:** warm, plain, respectful, second person. "Your note is ready to review." "Here's something you did well." Never "AI detected…". Always "You decide."

**Key screens to design first:**

1. **Today:** greeting, today's sessions, "Start session" primary button, notes awaiting review.
2. **Recording:** large calm timer, breathing dot, track levels (You / Client), pause, end; consent confirmed badge.
3. **Session review:** three tabs (Note / Reflection / Transcript); reflection items as soft cards; clicking an item scrolls the transcript and highlights the moment.
4. **Client timeline:** vertical timeline of sessions with theme chips.
5. **Onboarding:** 4 steps (profession → modality → note format → voice calibration), each one screen.
6. **Privacy page:** plain-language promises with simple icons.

Accessibility: WCAG 2.2 AA contrast, full keyboard navigation, visible focus, reduced-motion support.

Also build a **simple marketing landing page** (`/`) in the same style: hero ("Be with your client. We'll take care of the rest."), 3-step how-it-works, reflection feature, privacy promises, pricing, join-the-pilot form (email + profession only).

---

## 8. Internationalisation

All UI strings through i18n from day one (`next-intl`). Ship **English**; scaffold **Russian** and **Ukrainian** (the Clinical Lead can review RU). Agent output language = the therapist's chosen language, regardless of the session language. ASR auto-detects language.

---

## 9. Quality and evaluation

- `evals/` folder: **role-play transcripts only** (the Clinical Lead and colleagues will record them; until then, write 5 synthetic transcripts covering CBT, MI, person-centred, a couples session, and a session with safety-related content).
- For each, the expected note facts and an expert-written reflection. Script `pnpm eval` runs the pipeline and produces a side-by-side HTML report for the Clinical Lead to rate (1–5) per item.
- Automated checks: schema validity, every reflection item has valid evidence, no diagnosis words in notes (list in `evals/forbidden_terms.txt`), output language correct.
- Unit tests for consent gate, RLS, retention deletion, evidence check.

---

## 10. Environments and secrets

- `.env.example` with every variable, commented in plain English.
- Local dev: Docker Compose for Postgres (or Supabase local) and the worker; seed script with a demo therapist and synthetic clients.
- Never commit secrets. Never use real client data locally.

---

## 11. Milestones (stop and report after each)

| # | Milestone | Done when |
|---|---|---|
| M0 | Repo, tooling, README, `docs/decisions.md` with ADRs 1–4 (section 12), design tokens, empty app deployed to an EU region | Shurik can open the URL and see the calm landing page |
| M1 | Auth, onboarding, profile, clients (pseudonyms), consent records | A therapist can sign up, add a client, record consent |
| M2 | Recorder: mic + tab audio as separate tracks, chunked upload, upload-a-file, dictate/type recap | A 10-min role-play over Google Meet uploads reliably |
| M3 | Worker: ASR + ported diarization + audio deletion + jobs/progress | Accurate speaker-labelled transcript in < 3 min for 50 min of audio |
| M4 | Agent pipeline: note + reflection + evidence check; session review UI | Clinical Lead rates the 5 eval sessions ≥ 4/5 on average |
| M5 | Client timeline, exports (PDF/DOCX), privacy settings, data export/delete, audit log | Full privacy checklist in section 6 passes |
| M6 | Pilot hardening: Bedrock EU switch, rate limits, error states, i18n RU/UA, pilot feedback widget | Ready for 10 pilot therapists using role-plays, then real sessions after the DPIA |
| M7 | Supervision pack + hours log | A pre-accredited counsellor can export a month's pack |

---

## 12. First ADRs to write (in `docs/decisions.md`)

Use this format for each:

```
# ADR-N: Title
Status: Proposed | Accepted   Date:   Deciders: Shurik, Clinical Lead
## Context
## Decision
## Options considered (table: complexity, cost, privacy/EU, time to build)
## Consequences (easier / harder / revisit when)
```

1. **ADR-1: Session capture method for online calls.** Options: (a) browser tab-audio capture in our web app, (b) Chrome extension, (c) meeting bot that joins the call (e.g. Recall.ai), (d) desktop app (prototype approach with VB-CABLE). **Starting recommendation: (a) for MVP**: no install, two clean tracks, no visible third participant in a therapy call (a bot in the room is a trust problem). Revisit (b) or (d) if Mac/Zoom-desktop users struggle.
2. **ADR-2: Hosting and EU data residency** (Supabase EU vs self-managed Postgres; web host; GPU provider for ASR).
3. **ADR-3: LLM provider and data handling** (Anthropic direct for dev with synthetic data → Claude on Bedrock EU for real data; zero retention; no training).
4. **ADR-4: Positioning guardrail.** Post-session reflection only; no live advice, no risk scoring, no diagnosis; how this is enforced in prompts, UI copy and code review.

---

## 13. Definition of done (every feature)

- Works on latest Chrome, Edge, Safari (recording: Chrome/Edge), and on a phone screen.
- Calm design tokens used; no hard-coded colours.
- No client content in logs; RLS tested.
- Strings in i18n files.
- README and relevant `docs/` updated.
- Short plain-English summary given to Shurik.

---

## 14. Kickoff prompt (paste this into Claude Code)

```
Read CLAUDE.md fully. You are the lead engineer on this project; I'm Shurik, the non-technical founder.

1. Summarise back to me, in plain English and in under 15 bullet points, what we're building, what we're NOT building, and the privacy rules — so I can confirm you understood.
2. Propose the folder structure and draft ADR-1 to ADR-4 in docs/decisions.md, with your recommendation for each. Explain each in 2–3 simple sentences.
3. List every account, API key or paid service I will need to create, with expected monthly cost for the MVP.
4. Then stop and wait for my go-ahead before starting milestone M0.

After that, work one milestone at a time. At the end of each milestone: show me how to try it, explain what you built in simple words, list anything I need to do, and wait for my OK.
```
