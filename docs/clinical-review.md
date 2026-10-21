# Clinical review list

Everything below was drafted by the engineering team and must be reviewed by
the Clinical Lead before real clients. In code, these places are marked
`CLINICAL-REVIEW`.

| # | What | Where | Status |
|---|---|---|---|
| 1 | Shared AI boundaries (no diagnosis, no risk rating, faithful documentation) | `services/worker/prompts/system.md` | Draft |
| 2 | Note-writing instructions, incl. how safety statements are recorded | `services/worker/prompts/draft_note.md` and `SECTION_GUIDE` in `services/worker/worker/agent/steps.py` | Draft |
| 3 | Reflection instructions (tone, 3 strengths / 2 openings / 1 try) | `services/worker/prompts/reflect.md` | Draft |
| 4 | Client timeline instructions | `services/worker/prompts/update_timeline.md` | Draft |
| 5 | Supervision pack instructions | `services/worker/prompts/supervision_pack.md` | Draft |
| 6 | Modality rubrics: CBT, MI, person-centred, solution-focused, DBT, common factors | `packages/shared/modalities/*.json` | Draft — our own anchors, inspired by (not copied from) CTRS/CTS-R and MITI |
| 7 | Which modalities fall back to the common-factors pack | `packages/shared/modalities/map.json` | Draft |
| 8 | Forbidden terms (diagnosis / risk language), EN + RU | `evals/forbidden_terms.txt` | Draft |
| 9 | Client consent wording (in-app and free template) | `apps/web/messages/en.json` → `consent.text*` (and `ru.json`); version in `apps/web/src/lib/consent.ts` | Draft |
| 10 | Eval role-plays, expected note facts and "expert" reflections | `evals/sessions/*.json` | Placeholders — please replace with your own role-plays |
| 11 | Wording shown to therapists about reflection ("supervisor-style", "openings you might revisit") | `apps/web/messages/*.json` → `review.*`, `landing.*` | Draft |
| 12 | Russian translation of all clinical wording | `apps/web/messages/ru.json` | Draft — please check terminology |
| 13 | **Live research mode** instructions (in-session reads; experiment only, ADR-10) and the wording on the recording screen | `services/worker/prompts/live_insight.md`; `apps/web/messages/*.json` → `live.*` | Draft — please decide whether the boundaries are right |
| 14 | **Arch, the companion**: its moods (listening / writing / ready / resting), what it says to therapists, and the rule that it never reacts to client content | `apps/web/src/components/arch.tsx`; `apps/web/messages/*.json` → `arch.*` | Draft — please check that Arch feels like a calm colleague, not a toy or a therapist |
| 15 | **Client app wording**: invite screen, what the therapist sees vs. what stays private, homework and diary prompts | `apps/web/messages/*.json` → `join.*`, `me.*`, `clientApp.*` | Draft |
| 16 | **Crisis signpost shown to clients** (112/999, Samaritans 116 123) on every client page and the invite screen. The app does not monitor or flag anything | `apps/web/src/app/me/layout.tsx`; `me.crisis`, `join.notMonitored` | Draft — please confirm the numbers and wording for IE/UK |
| 17 | **Mood diary scale** (5 faces, "Very low" … "Very good"), shared by default per entry, never scored or analysed | `apps/web/src/components/mood-face.tsx`; `me.mood*` | Draft — is "shared by default" right? |

## How to review
1. Run `npm run eval` (with an AI key in `.env`) and open the report in `evals/reports/`.
2. Rate every item 1–5 and click **Download ratings**. The M4 goal is an average of 4 or more.
3. Edit any of the files above (or send comments) — prompts carry a `version:` line; bump it when you change them.

## 18. Arch, the AI practice agent (ADR-19)
File: `apps/web/src/lib/arch/prompt.ts`. Please review:
- the role description and tone;
- the limits: no diagnosis or speculation, no risk rating, no treatment decisions, general textbook information allowed;
- **the rule that Arch never volunteers safety-related content the therapist didn't ask about** (to stay clear of risk alerts), and the wording when asked;
- whether proposing homework is acceptable, given the therapist approves every item.

## 19. Therapy tools in video sessions (ADR-21)
Wording: `apps/web/messages/ru.json` and `en.json`, section `tools`; lists in `apps/web/src/lib/tools/model.ts`. Please review:
- **scale questions** (0–10): distress, anxiety, mood, importance, confidence, readiness, goal — the questions and what 0 and 10 mean. No risk or suicide scale on purpose;
- **wheel of balance**: the eight default life areas (the therapist can rename them in a session);
- **emotion wheel**: the seven families and their 41 words (our own list, not a copy of a published wheel) — are these the right words in Russian and English, and the right family for each?
- **art cards**: the 56 paintings in `apps/web/public/cards/art` (public domain, Cleveland Museum of Art) — remove any you'd not use with clients — and the seven questions shown to the therapist;
- whether the client should get a copy of saved results in their app (today: only the therapist's card, with a notice to the client that it was saved).

