# HavenSpace in Russia: infrastructure, costs and price

Draft, 2026-11-02. Not legal advice. Prices come from public pages checked on this date, include Russian VAT unless noted, and use €1 ≈ 95 ₽ (the last rate found was 94.5 ₽ on 2 Oct 2026). Items marked *estimate* have no published price behind them.

## The short version

1. **Build one codebase with two completely separate installations.** The product stays the same. Servers, database, accounts and domain are separate, and no data moves between them.
2. **Put everything on Yandex Cloud.** It is the one Russian provider I found that offers servers, database, storage, email, speech and AI models under one contract, and it publicly states a UZ-1 attestation for personal data, the level health data will likely need.
3. **Don't use Claude or GPT for the Russian installation, even through Polza.** A VPN was never the main problem (details below).
4. **Polza is useful for testing models now.** For real sessions it needs written answers first. Yandex AI Studio is the default until then.
5. **Budget about 13,000 ₽ a month at 0 clients, 26,000–31,000 ₽ at 5 and 38,000–47,000 ₽ at 10.** Launch at **3,490 ₽ a month**. Break-even is about 12–20 clients. These are the figures for real sessions, without accounting for now. For role-play testing, [one server](#starting-cheaper-one-server-for-testing) costs about 6,800 ₽ a month.
6. **Get a sanctions opinion before spending money.** An Irish company may not be allowed to run this at all.

## Why Claude through an aggregator doesn't work

- **Anthropic's rules.** Anthropic's [supported regions policy](https://www.anthropic.com/supported-countries) does not list Russia. It says the limits also cover Claude "offered through cloud platforms and authorized resellers" and "use by persons while physically located in an unsupported region". A Russian aggregator removes the need for a VPN, but this use still breaks the policy. It could also put your EU Anthropic account at risk (my judgement, not a stated rule).
- **OpenAI.** I didn't check OpenAI's list in this research. As far as I recall it doesn't support Russia either, so check before relying on GPT.
- **Russian law.** VseLLM says its gateway [routes traffic to foreign data centres](https://vsellm.ru/), and Claude itself doesn't run in Russia. So a session transcript, which is health data, would leave the country on every call. Cross-border transfer [isn't directly banned](https://www.lidings.com/media/legalupdates/localization_pd_update/), but it has its own rules, and as I understand them that includes a notice to Roskomnadzor. That is hard to defend for therapy content, and the lawyer should confirm it.
- **The lawyer's case is different.** The lawyers' service your contact built may handle a different kind of data, or may simply carry this risk. Their setup doesn't settle it for us.

This is my recommendation, and it has a real cost: Russian-hosted models may write weaker notes and reflections than Opus. That is the main product risk, so step 2 of the plan tests it before anything else is built.

## The three aggregators

| | Polza | RouterAI | VseLLM |
|---|---|---|---|
| Company shown | Not shown on the pages I read | ООО «Интер», registered data operator no. 70-25-018432 | Sole trader in the footer, "legal entity" in the text; conflicting |
| Russian hosting | A ["Данные в РФ" filter](https://polza.ai/models) exists; I couldn't see which models it returns | [Some models hosted in Russia "for 152-FZ"](https://routerai.ru/) | Routes abroad |
| Stored data | [Says requests and replies aren't stored](https://polza.ai/docs/osobennosti/privacy.md) | Not stated | Zero-log claim |
| 152-FZ / processing agreement | Privacy page mentions neither | 152-FZ claim only | Not named |
| Can foreign routes be blocked? | [Yes per provider: `only` plus `allow_fallbacks=false`](https://polza.ai/docs/gaidy/provider-selection.md) | Not checked | No |
| Invoice for a company | Yes | Yes | Yes |
| Sample price per 1M tokens (in/out) | DeepSeek V4.1 Flash 5.75/22 ₽ | DeepSeek V4 Pro 99/176 ₽ | Not comparable |

**Polza's own privacy page** lists Anthropic and OpenAI as keeping data for up to 30 days, and DeepSeek's own service as "potentially unsafe" because it may train on data. Its very low prices may be for those foreign routes.

**Polza has to answer four questions in writing (business@polza.ai):**
1. Which models run on servers in Russia, and at which named provider?
2. Will you sign a 152-FZ data processing instruction (поручение) that covers health data?
3. Does `only` with `allow_fallbacks=false` guarantee a request never leaves Russia?
4. What is your legal entity?

If any answer is no, real sessions go to Yandex directly. The code is the same either way, because both can be reached with the same type of connection (to be confirmed for Yandex when we build it).

## Tool by tool: EU today and Russia

| Job | EU today | Russia | Monthly cost | Work needed |
|---|---|---|---|---|
| Website and app | Vercel | Yandex server running our app in Docker | Shared server, 6,640 ₽ | New deploy script |
| Database | Neon | Yandex Managed PostgreSQL (2 CPU, 8 GB) | ~6,080 ₽ | Run the same migrations |
| Audio storage | Hetzner S3 | Yandex Object Storage ([~2.4 ₽/GB](https://yandex.cloud/ru/docs/storage/pricing)) | ~50 ₽ | Settings only |
| Speech-to-text | Hetzner server, Whisper | Yandex server, same Whisper | 6,640–12,190 ₽ | Include the model in the install |
| Backup speech-to-text | None | [Yandex SpeechKit](https://aistudio.yandex.ru/docs/ru/speechkit/pricing), ~30 ₽ per 50 minutes | Pay per use | Optional |
| AI model | Anthropic (Bedrock planned) | Yandex AI Studio, or Polza if it passes | 22–45 ₽ per session | New AI connection in the worker and Lumi; re-check prompts |
| Video calls | LiveKit Cloud | LiveKit on our own server (open source) | Shared server; [traffic 1.68 ₽/GB](https://yandex.cloud/ru/docs/storage/pricing) after 100 GB (Yandex's storage example; confirm for servers) | Settings; connection testing |
| Call fallback | None | A Yandex Telemost link, if tests show problems | Free tier not checked | Small |
| Save video to computer | In the browser | Same, nothing leaves the device | 0 | None |
| Email | Gmail (Brevo planned) | [Yandex Postbox](https://yandex.cloud/ru/docs/postbox/pricing), first 2,000 a month free | ~0 ₽ | Settings; needs domain |
| Payments | Stripe planned | [YooKassa](https://yookassa.ru/en/fees), 2.8% + 1% for receipts + VAT, ~4.3–4.6% | % of revenue | Not built yet; needs a Russian company |
| Domain | vercel.app link | A .ru domain, no Cloudflare | ~30 ₽ | Buy it |
| Android / desktop apps | GitHub downloads | RuStore and downloads from our own storage | 0 | A build pointed at the RU address |
| Analytics | Off | Off | 0 | None |

**Cloudflare:** Russian carriers [have throttled it since June 2025](https://therecord.media/cloudflare-russia-restricting-access-crackdown), so it stays out. A search of the app's code found no Cloudflare, Google Fonts or Sentry.

**Biggest technical risk: video calls.** Russia has [blocked calls in WhatsApp and Telegram](https://www.currenttime.tv/a/roskomnadzor-priznal-nachalo-blokirovok-zvonkov-v-inostrannyh-messendzherah/33502172.html) and has a [history of interfering with WebRTC traffic](https://corpus.lantern.io/findings/2025-vilalonga-extended__turn-rendezvous-webrtc-unblockability/), the technology our calls use. I found nothing on self-hosted LiveKit there in 2026. A Russian server and [TLS on port 443](https://kb.livekit.io/articles/1724892785-establishing-media-connection-firewall-troubleshooting) should help, but this has to be tested on MTS, Beeline, MegaFon and Tele2, on both home and mobile internet. Mobile internet shutdowns may also affect access.

**Code that has to change:**
- [providers.py:192](../services/worker/worker/agent/providers.py:192) refuses real data on anything except Bedrock. It needs a clear Russia rule.
- A new AI connection is needed for the worker.
- [The Lumi route](../apps/web/src/app/api/arch/route.ts:65) uses Anthropic directly and needs the same connection, including its tools and streaming.
- The Russian installation needs its own deploy script.

Estimate: about 1–2 weeks of building, not counting legal work or model testing.

**Avoid Sber-linked services:** GigaChat, SaluteSpeech and possibly Cloud.ru. As far as I know Sberbank is under EU asset-freeze sanctions, which makes dealing with it, or companies it controls, a problem for any EU person. ADR-23 mentioned GigaChat; I've corrected that. The lawyer should confirm this and also check Yandex and whichever bank we use.

## Monthly costs

"Client" means one paying therapist recording 40 sessions a month. The price is 3,490 ₽. Accounting and bank fees are left out for now, at Shurik's request (2026-11-03). My estimate is about 8,000 ₽ a month once a Russian company exists, which would move break-even back to about 15–25 clients.

| | 0 clients | 5 clients | 10 clients |
|---|---|---|---|
| App + video server (4 CPU, 8 GB) | 6,640 ₽ | 6,640 ₽ | 6,640 ₽ |
| Speech server | 0 ₽ | 6,640 ₽ (4 CPU) | 12,190 ₽ (8 CPU) |
| Database | 6,080 ₽ | 6,080 ₽ | 6,080 ₽ |
| Storage, domain | 150 ₽ | 150 ₽ | 150 ₽ |
| **Fixed total** | **12,870 ₽** | **19,510 ₽** | **25,060 ₽** |
| AI at 22–45 ₽ per session | 0 ₽ | 4,400–9,000 ₽ | 8,800–18,000 ₽ |
| Payment fees and 6% tax | 0 ₽ | ~1,800 ₽ | ~3,600 ₽ |
| Video traffic | 0 ₽ | ~200 ₽ | ~570 ₽ |
| **Variable total** | **0 ₽** | **6,400–11,000 ₽** | **13,000–22,200 ₽** |
| **Total cost** | **~12,900 ₽ (€135)** | **~25,900–30,500 ₽ (€273–321)** | **~38,000–47,200 ₽ (€400–497)** |
| Revenue | 0 ₽ | 17,450 ₽ | 34,900 ₽ |
| **Result** | **−12,900 ₽** | **−8,500 to −13,100 ₽** | **−3,100 to −12,300 ₽** |

**Break-even is about 12 clients with the cheapest model, or about 20 with the mid-priced one.** The low end of each range assumes the cheapest model (Qwen) is good enough, which isn't tested yet.

**How solid these numbers are:**
- **AI usage is my estimate:** about 100,000 tokens in and 7,000 out per 50-minute session. The live database has no usage data yet, because the `llm_usage` table (migration 0024) hasn't been applied. Applying it and running real sessions would replace this guess.
- **Disk price is assumed:** 15 ₽/GB a month; Yandex's page didn't show the SSD price.
- **Server prices** are built from Yandex's published examples, so the calculator may differ slightly. Selectel may be cheaper, but its price tables didn't load for comparison.
- **The speech server** at 10 clients handles the load, but evening sessions may queue: about 25 minutes to process each 50-minute session, the same as EU today. A [GPU server from 56,900 ₽ a month](https://selectel.ru/services/gpu/) isn't worth it until about 40–50 clients (*estimate*).

**AI price per 50-minute session** ([Yandex prices](https://aistudio.yandex.ru/docs/ru/ai-studio/pricing)):

| Model | Cost per session |
|---|---|
| Qwen3.6 35B | 22 ₽ |
| gpt-oss-120b | 32 ₽ |
| Alice AI LLM, delayed mode | 32 ₽ |
| DeepSeek V4.1 Flash | 34 ₽ |
| YandexGPT 5.1 Pro, delayed mode | 44 ₽ |
| Alice AI LLM, instant mode | 58 ₽ |
| YandexGPT 5.1 Pro, instant mode | 86 ₽ |

Notes are generated after the session, so delayed mode is fine there, if Yandex's delay is short enough. Lumi chat needs instant mode. Reusing the transcript across steps through caching could lower the DeepSeek and Qwen costs further.

**One-time costs (*estimates*, get quotes):**

| Item | Cost |
|---|---|
| Irish sanctions opinion | €1,000–3,000 |
| Russian lawyer: consent forms, privacy policy, Roskomnadzor notice, contracts | 50,000–150,000 ₽ |
| Security assessment for high protection levels ([unofficial figure](https://toolfox.ru/services/hosting/hosting-152-fz)) | 50,000–200,000 ₽ |
| Company registration | Around 4,000 ₽ |

Together that is roughly €2,000–6,000. This matters more than the servers at this stage.

## Starting cheaper: one server for testing

The monthly table above is the setup for real sessions. Until then, one server can run the website, database, video calls and speech-to-text together. **Use it for role-plays and testers only, never for real client data.**

| | Testing, no testers yet | Testing with 3–5 testers | Real sessions, 0 clients |
|---|---|---|---|
| Server | 4 CPU, 8 GB: 6,640 ₽ | 8 CPU, 16 GB: 12,190 ₽ | App 6,640 ₽ |
| Database | On the same server | On the same server | Managed: 6,080 ₽ |
| Storage, domain | 150 ₽ | 150 ₽ | 150 ₽ |
| **Total** | **~6,800 ₽ (€72)** | **~12,300 ₽ (€130)** | **~12,900 ₽ (€135)** |

AI comes on top at 22–45 ₽ per session, so 50 role-play sessions in a month add about 1,100–2,250 ₽.

**What you give up:**
- **Backups.** Nothing is managed for us. A nightly copy of the database to Object Storage is cheap and would be part of the deploy script, but nobody is watching it the way a managed service does.
- **Reliability.** If the server fails, the website, database and calls all stop together.
- **Speed.** Speech-to-text and video calls share the same processors, so long sessions take longer than the ~25 minutes above while a call is running, and calls could suffer too. This is why testers need the larger server. We'd measure it in step 6.

**Things to check:**
- **Who holds the Yandex account.** A Russian contract likely needs a company, and I haven't checked whether Yandex would accept a personal account for this. If it needs a company, step 4 has to come before testing, and accounting costs start then.
- **Website and video on one address.** Both want TLS on port 443. The server can split them by domain name, or a second public address costs about 190 ₽ a month. The main plan has the same issue, because it also shares this server.
- **Moving to the full setup.** This is small work, about a settings change and a fresh database, because role-play data doesn't need to be carried over. Do it before step 7.

## Price for Russia

**Launch with one plan: 3,490 ₽ a month, including 40 sessions, plus 3 free sessions to try.**

Why this price:
- **It's about one session's fee.** An average hour-long consultation in Russia is [about 3,000–3,500 ₽](https://robokassa.com/blog/news/psikhologi-stali-odnim-iz-samykh-bystrorastushchikh-segmentov-malogo-biznesa/). Moscow [averaged 3,850 ₽ in 2024](https://finance.mail.ru/article/v-rossii-podorozhali-uslugi-psihologov-63987406/).
- **It matches EU pricing in spirit.** €39 is about 3,700 ₽.
- **It's affordable for full-time therapists.** Median monthly turnover for small mental-health businesses was [reported at 201,700 ₽](https://robokassa.com/blog/news/psikhologi-stali-odnim-iz-samykh-bystrorastushchikh-segmentov-malogo-biznesa/) in early 2026. That sample is small and comes from one bank's customers, and the price is less comfortable for part-timers.
- **Below about 2,500 ₽ the margin gets thin** on the mid-priced model.

Later, when real usage is known, split it into two plans:

| Plan | Price | Sessions | Margin (45 ₽ / 22 ₽ AI) |
|---|---|---|---|
| Solo | 2,990 ₽ | 30 | 45% / 68% |
| Practice | 4,490 ₽ | 60 | 30% / 60% |

**Cap sessions on every plan.** Unlike in a pure software product, each session costs real money.

I found no Russian competitor with a public price. One [Novosibirsk product](https://hi-tech.mail.ru/news/118599-sozdan-virtualnyij-pomoschnik-dlya-psihologov/) exists, without pricing. So this price is reasoned, not market-tested. Ask 10 Russian therapists before fixing it. Anton is well placed to do this.

## Legal questions to settle first

**Status 2026-11-02:** Shurik confirmed this step is cleared and the plan is legal. The opinion itself isn't in this repo, so add it to the project files if it can be kept here. The questions below are kept as the record of what was asked.

**EU sanctions.** The January 2026 EU guidance [added access to hosted AI models, including through APIs, as a banned service category under article 5n](https://www.squirepattonboggs.com/insights/publications/eu-sanctions-update-revised-restrictions-on-the-provision-of-services-to-russia/). [EU operators also can't provide listed services to Russian-established entities, directly or through intermediaries](https://celnisprava.gov.cz/cz/Documents/2026-01-26--FAQs-sanctions-Russia-Services-provision_en.pdf). I couldn't confirm how this treats individual therapists or a Russian company with EU-resident owners. This could block the whole plan as described, so it comes first.

Questions for the sanctions lawyer:
1. Can the Irish company, or Shurik personally, own, license to, run or give technical support to a Russian HavenSpace?
2. Does the answer change if the customers are individuals, sole traders or companies?
3. Does Shurik working on the code himself count?
4. How could any money lawfully move? Dividends to [owners from "unfriendly" countries have restrictions](https://spmag.ru/articles/vyplata-dividendov-nerezidentam-v-2023-godu-sp).

**Investors and grants.** Mention this to NDRC, Enterprise Ireland and investors before it surprises them in due diligence. Ukrainian-speaking therapists are a target group too, so the link between the two products matters. I'd assume a separate brand and owner may be needed.

**Russian law.** For the Russian lawyer:
- **Storage in Russia.** Since 1 July 2025, [collecting and storing Russian citizens' data through foreign databases is banned](https://www.lidings.com/media/legalupdates/localization_pd_update/).
- **Fines.** Up to [6 million ₽ for a first breach and 18 million ₽ for a repeat](https://www.lidings.com/media/legalupdates/localization_pd_update/). [Duolingo was fined 2 million ₽](https://www.fontanka.ru/2026/03/26/76332626/) in March 2026, and such a fine [can lead towards blocking](https://moskvichmag.ru/?p=487318).
- **Other questions.** Who is the data operator, the therapist or us? What consent do clients give? What protection level applies? Is [the cloud's own attestation enough](https://yandex.cloud/ru/security/standards/152-fz), given Yandex says part of the requirements stay with the customer?
- **Psychologists.** Does the health-data exception for medical workers apply to them? I found no clear answer.

**Company.** YooKassa's offer targets Russian companies and sole traders, and a Russian contract with Yandex likely needs one too. Tell us who could own it: someone in Russia, with no EU ties, gives the cleanest structure, but ask the lawyer first.

## Plan

| Step | What | Who | Time | Cost |
|---|---|---|---|---|
| 1 | Sanctions opinion, then Russian law consult. **Go or stop here** | Shurik, lawyers | 2–3 weeks | €1,000–3,000+ |
| 2 | Test models on our evaluation role-plays through Polza, using Russian-hosted or open models only; Anton rates them | Claude, Anton | 1 week | ~3,000 ₽ |
| 3 | Ask Polza the four questions; choose Polza or Yandex | Shurik | Days | 0 |
| 4 | Create the Russian company and Yandex account; buy the domain | Shurik or partner | 1–2 weeks | ~10,000 ₽ |
| 5 | Build it: AI connection, deploy script, LiveKit, email | Claude | 1–2 weeks | One server, ~6,800 ₽/month |
| 6 | Test calls and uploads with 3–5 therapists in different cities on all carriers, role-play only | Anton's colleagues | 2 weeks | Larger server, ~12,300 ₽/month |
| 7 | Move to the full setup; sign legal documents; add YooKassa; open to real sessions | Lawyer, Claude | 2–3 weeks | Legal budget; full setup from ~12,900 ₽/month |

Step 2 uses only made-up sessions and tells us whether the product is good enough in Russia at all. It can run alongside step 1, but ask the lawyer whether paying a Russian service from Ireland is a problem before topping up Polza.

## Sources

Polza [site](https://polza.ai/), [models](https://polza.ai/models), [privacy](https://polza.ai/docs/osobennosti/privacy.md), [provider selection](https://polza.ai/docs/gaidy/provider-selection.md) · [RouterAI](https://routerai.ru/) · [VseLLM](https://vsellm.ru/) · [Anthropic supported regions](https://www.anthropic.com/supported-countries) · Yandex [AI Studio](https://aistudio.yandex.ru/docs/ru/ai-studio/pricing), [SpeechKit](https://aistudio.yandex.ru/docs/ru/speechkit/pricing), [Compute](https://yandex.cloud/ru/docs/compute/pricing), [PostgreSQL](https://yandex.cloud/ru/docs/managed-postgresql/pricing), [network](https://yandex.cloud/ru/docs/vpc/pricing), [storage](https://yandex.cloud/ru/docs/storage/pricing), [Postbox](https://yandex.cloud/ru/docs/postbox/pricing), [152-FZ](https://yandex.cloud/ru/security/standards/152-fz) · Selectel [servers](https://selectel.ru/services/cloud/servers/), [GPU](https://selectel.ru/services/gpu/) · [YooKassa fees](https://yookassa.ru/en/fees) · [Euro rate](https://ppt.ru/currencies/eur/02-10-2026)
