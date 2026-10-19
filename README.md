# CouchNote — AI assistant for therapists

A calm assistant for therapists, used **after** a session. It:

1. drafts the clinical note (SOAP, DAP, BIRP or free text),
2. offers supervisor-style reflection on the therapist's own technique, with every point linked to the exact moment in the transcript,
3. keeps a timeline per client (themes, goals, homework),
4. prepares a monthly supervision pack with an hours log.

It deliberately does **not** give live advice, suggest diagnoses or score risk (see `docs/decisions.md`, ADR-4).

> **Demo mode.** Until the EU AI provider is connected and the privacy review (DPIA) is done, use **role-play sessions only**. The app shows a banner to remind you.

---

## Run it on your Mac

You need two free tools, installed once:

| Tool | Why | Check it's installed |
|---|---|---|
| Node.js 24 | runs the website | `node --version` |
| uv | runs the Python worker (speech-to-text and AI) | `~/.local/bin/uv --version` |

(Both are already installed on Shurik's Mac. To install uv elsewhere: `curl -LsSf https://astral.sh/uv/install.sh | sh`.)

### First time only

Open Terminal in the project folder and run:

```bash
npm run setup
```

Then create your settings file (skip this if `.env` already exists — it does on Shurik's Mac):

```bash
cp .env.example .env
```

Open `.env` and fill in `BETTER_AUTH_SECRET` (any long random text; `openssl rand -base64 32` makes one) and the two database passwords.

### Every time

```bash
npm run up
```

This starts the database, the website and the background worker. Then open **http://localhost:3210**.

The first time, also load the demo data (a demo therapist with five role-play clients):

```bash
npm run db:seed
```

### Signing in locally

Emails aren't sent on your laptop. The quickest way in is **http://localhost:3210/dev/login**: one click signs you in as the demo therapist (admin), a therapist waiting for approval, or a brand-new user. To try the real sign-in screen instead, ask for a code and find it at **http://localhost:3210/dev/mailbox**. Both pages exist only on your laptop, never on the live site.

- Demo account: **demo@psych.test** (has five role-play sessions ready to review)
- Or type any email to create a fresh account and go through onboarding.

### Try a full recording without a microphone

This turns a written role-play into audio with the Mac's built-in voices, then feeds it through the whole pipeline (transcription → speaker labels → audio deletion → note and reflection):

```bash
cd services/worker
~/.local/bin/uv run python tools/make_roleplay_audio.py ../../evals/sessions/02-mi-alcohol.json
~/.local/bin/uv run python tools/simulate_session.py --email demo@psych.test --client "Client B" --audio .data/roleplay/02-mi-alcohol --mode in_person --calibrate
```

Then open **Today** in the app — the session appears under "Being prepared", and is ready within a couple of minutes on a laptop.

To try real recording, add a client, record consent, and choose **Start session → In the room** (any browser) or **Online call** (Chrome or Edge: share the meeting tab with "Share tab audio" ticked).

---

## Turning on real AI drafting

Out of the box the AI is in **demo mode**: notes and reflections are clearly marked placeholders, so everything else can be tried without any account.

To use Claude for development (role-play data only):

1. Create an account at console.anthropic.com, set a monthly spending limit, and create an API key.
2. In `.env`, set `LLM_PROVIDER=anthropic` and paste the key into `ANTHROPIC_API_KEY=`.
3. Restart (`Ctrl+C`, then `npm run up`).

Before any **real** client data: switch to `LLM_PROVIDER=bedrock` (Claude on AWS in Frankfurt) — see ADR-3 — and complete the checklist at the end of `docs/privacy-architecture.md`.

---

## Live suggestions during a session (research experiment)

An experiment for Shurik and the Clinical Lead only (see `docs/decisions.md`, ADR-10). **Role-play sessions only.**

1. In `.env`, list the sign-in emails allowed to use it: `LIVE_RESEARCH_EMAILS=demo@psych.test,your.dad@example.com`. Restart (`npm run up`).
2. Start a session (**Online call** or **In the room**). Tick **Live suggestions during the session** before you start.
3. Every half a minute a short read appears next to the timer. After the session, the reads are listed at the bottom of the session page.

Without an AI key the reads are `[Demo]` placeholders. To try it without a microphone:

```bash
cd services/worker
~/.local/bin/uv run python tools/simulate_live.py --email demo@psych.test --client "Client A" --audio .data/roleplay/01-cbt-sleep-worry --mode online_call --seconds 90
```

---

## Useful commands

| Command | What it does |
|---|---|
| `npm run up` | Start everything (database, website, worker) |
| `npm run db:seed` | Reset the demo account with five role-play sessions |
| `npm test` | Run all automated checks (security, consent, deletion, evidence, speaker labels) |
| `npm run eval` | Run the five role-play sessions through the AI and create a rating report in `evals/reports/` for the Clinical Lead |
| `npm run signups` | Save demo requests and waiting-list sign-ups to `.data/signups.csv` |

---

## What's where

```
apps/web/              the website and app (Next.js)
  messages/            all wording, English (en.json) and Russian (ru.json)
  src/app/(marketing)  public pages: landing, privacy, consent template, legal
  src/app/(app)        the signed-in app: Today, Clients, Sessions, Supervision, Settings
services/worker/       background worker (Python): speech-to-text, speaker labels, AI steps
  prompts/             AI instructions (versioned; clinical review needed)
packages/shared/       modality rubrics (CBT, MI, person-centred, ...) — clinical review needed
db/migrations/         database structure, security rules and the consent gate
evals/                 role-play sessions, forbidden terms, rating reports
docs/                  decisions (ADRs), privacy architecture, sub-processors, clinical review list
reference/prototype/   place the Clinical Lead's original prototype here (not published)
```

## Documents

- `docs/decisions.md` — every significant choice and why (ADR-1 to ADR-9)
- `docs/privacy-architecture.md` — data flows and protections (input for the DPIA)
- `docs/subprocessors.md` — companies that would process data
- `docs/clinical-review.md` — everything the Clinical Lead needs to review
