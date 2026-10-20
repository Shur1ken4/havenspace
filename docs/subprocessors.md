# Sub-processors

Companies that would process personal data on our behalf. **Planned for the
pilot** — the final list is confirmed (and contracts/DPAs signed) before
`ALLOW_REAL_CLIENT_DATA=true`. Shown to users at `/legal/subprocessors`
(keep both in sync).

| Company | What they do | Where | Data they see | Status |
|---|---|---|---|---|
| Vercel Inc. (US company) | Hosts the web app; server functions pinned to Frankfurt (`fra1`) | EU (Frankfurt) | Requests pass through while in use; nothing stored | Planned |
| LiveKit Inc. (US company) — LiveKit Cloud | Carries in-app video calls between a therapist and their client (ADR-17) | EU (Frankfurt project region) | Live audio/video passes through while the call runs; nothing recorded by LiveKit; agent observability switched off | Pilot (role-play only) |
| EU managed Postgres (choose: Supabase Postgres Frankfurt, Scaleway, OVH or Hetzner) | Database | EU | All app data, encrypted at rest | To choose (ADR-5) |
| EU S3-compatible object storage (choose: Scaleway, Hetzner, OVH or AWS eu-central-1) | Short-lived audio | EU | Audio for minutes (or 7 days if the therapist chooses) | To choose |
| Hetzner Online GmbH (German company) | GPU server running our speech-to-text and worker | Germany / Finland | Audio and transcripts while processing | Planned |
| Amazon Web Services EMEA SARL — Amazon Bedrock (Claude by Anthropic) | AI drafting of notes and reflections | EU region (Frankfurt) | Transcript text with pseudonyms; not stored; not used for training | Planned (ADR-3) |
| Brevo (Sendinblue SAS, French company) | Sign-in emails | France | Email address only | Planned |

## Development only (never real client data)

| Company | Use |
|---|---|
| Anthropic PBC | Claude API for development with synthetic / role-play sessions only |
| Hugging Face | One-time download of open speech models (no user data sent) |
