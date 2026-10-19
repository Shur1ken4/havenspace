# Pilot setup: accounts to create

To put HavenSpace online for pilot testers you create **five accounts** (about 45 minutes in total). Claude does everything else: database tables, security rules, the speech-to-text server and the website settings.

**Where to put what you copy:** open the file `.env.production` in the project folder and paste each value next to its name. That file stays on your Mac and is never uploaded to GitHub. **Never paste keys or passwords into the chat.**

| # | Account | What it's for | Cost |
|---|---|---|---|
| 1 | Gmail (new) | Sends the sign-in emails | Free |
| 2 | Neon | The database: accounts, clients, transcripts, notes (Frankfurt) | Free to start, ~$19/month later |
| 3 | Hetzner | Speech-to-text server + short-lived audio storage (Germany) | ~€30–40/month |
| 4 | Anthropic | Claude writes notes, reflections and live suggestions | Pay as you go (set a €20–50 limit) |
| 5 | Vercel | The website and its link | Free to try; Pro $20/month for real users |

---

## 1. Gmail account for sign-in emails (10 min)

1. Create a new Gmail account just for the app, for example `havenspace.pilot@gmail.com`. Don't use your personal one.
2. Open **myaccount.google.com → Security** and turn on **2-Step Verification**.
3. Open **myaccount.google.com/apppasswords**, type the name `HavenSpace` and click **Create**.
4. Copy the 16-letter password into `.env.production` as `GMAIL_APP_PASSWORD`, and the email address as `GMAIL_ADDRESS`.

Gmail can send up to ~500 emails a day, which is plenty for a pilot. When you buy a domain later (e.g. `havenspace.app`), we switch to an EU email service.

## 2. Neon database in Frankfurt (5 min)

1. Sign up at **neon.tech** (you can use your GitHub account).
2. **Create project:** name `havenspace`, Postgres version **17**, region **AWS Europe Central 1 (Frankfurt)**. The region can't be changed later, so please double-check it.
3. On the project dashboard click **Connect**, then **copy** the connection string (it starts with `postgresql://`).
4. Paste it into `.env.production` as `NEON_OWNER_URL`.

## 3. Hetzner: server + audio storage (15 min)

1. Sign up at **hetzner.com/cloud**. Hetzner may ask for ID verification; that's normal.
2. Create a project called `HavenSpace`.
3. **Object Storage → Create bucket**: location **Falkenstein (fsn1)**, name e.g. `havenspace-audio-<something unique>`, visibility **Private**.
   - Then go to **Security → S3 credentials → Generate credentials**. Copy the **Access key** and **Secret key** into `.env.production`, and the bucket name into `S3_BUCKET`.
4. **Servers → Add server**:
   - Location: **Falkenstein** or **Nuremberg** (Germany)
   - Image: **Ubuntu 24.04**
   - Type: **Dedicated vCPU → CCX23** (4 vCPU, 16 GB RAM)
   - SSH key: click **Add SSH key**, paste the line below, name it `havenspace-deploy`:
     ```
     ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBb5T+6LP2oGnBmQe1XlSjTQGKAwWUCmbAY1qCZMUON2 havenspace-deploy
     ```
   - Name: `havenspace-worker`, then click **Create & Buy now**.
5. Copy the server's **IPv4 address** into `.env.production` as `WORKER_SERVER_IP`.

(This server transcribes a 50-minute session in roughly 10–15 minutes. When there are more testers, we can upgrade to a GPU server and that drops to 1–3 minutes.)

## 4. Anthropic key (5 min)

1. **console.anthropic.com** → sign up → **Billing**: add a card, buy €20 of credit, and set a **monthly limit**.
2. **API Keys → Create key** named `havenspace-pilot`, and paste it as `ANTHROPIC_API_KEY`.

## 5. Vercel (after Claude says the app is ready to deploy)

Claude prepares a settings block for you to paste. Then:

1. **vercel.com → Add New → Project → Import** the GitHub repository `psych-copilot`.
2. **Root Directory:** `apps/web`.
3. **Environment Variables:** paste the block Claude gives you.
4. Click **Deploy**. Copy the link you get (e.g. `https://havenspace-xyz.vercel.app`) into `.env.production` as `APP_URL`, and tell Claude.

---

## 6. Who can get in (after deploying)

Claude makes you (and your dad, if you like) **admins**. Then:

- A therapist opens the link, signs in with their email and fills in their profile, including professional body and registration number.
- You get an email: "a new access request is waiting". Open **Admin** in the app, click **Check register** to confirm their number, and click **Approve**. They get an email saying their account is ready.
- People on the **waiting list** (from the website form) appear on the same page with an **Invite** button.

## Rules for the pilot

- **Role-play sessions only.** Testers must not record real clients until the privacy review (DPIA) is done and the EU AI setup is switched on. The app shows this in a banner.
- Data is stored in **Frankfurt** (database) and **Germany** (audio, deleted right after transcription). The conversation text is sent to Anthropic to write notes. That's fine for role-plays, not for real clients.
