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

## How to review
1. Run `npm run eval` (with an AI key in `.env`) and open the report in `evals/reports/`.
2. Rate every item 1–5 and click **Download ratings**. The M4 goal is an average of 4 or more.
3. Edit any of the files above (or send comments) — prompts carry a `version:` line; bump it when you change them.
