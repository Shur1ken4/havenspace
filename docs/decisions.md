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
Status: Proposed   Date: 2026-10-15   Deciders: Shurik, Clinical Lead

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
4. **No real-time path in code:** the worker only accepts jobs for sessions marked "ended". There is no streaming-analysis endpoint.
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
