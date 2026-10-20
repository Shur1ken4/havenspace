# HavenSpace: testing guide

For pilot testers. **Role-play only:** never use real client details, names or sessions.

You need two browsers or devices: one for the **therapist** and one for the **client**. A phone works well for the client, or use a private or incognito window.

---

## A. Therapist: sign up (≈5 min)
1. Open the website and click **Get started**, then **I'm a therapist**. Enter your name, email and a password, then type the 6-digit code from your inbox to confirm your email. Add a photo or skip.
2. Fill in the 4 short steps:
   - your profession and full name;
   - your registration number (optionally, a photo of your licence);
   - your approach;
   - your note format.
3. You'll see "We're reviewing your request". *(The admin approves you, and you get an email.)*

**Tell us:** Was anything unclear? Did the code email arrive quickly? Did it land in spam?

## B. Admin (Shurik): approve
1. Sign in, then go to **Admin**.
2. Check the name, the number (use the "Check register" link) and the document.
3. Click **Approve**. The therapist gets a "You're in" email.

## C. Therapist: first client
1. **Clients → Add**. Use a code name such as "Client A" (no real names).
2. Record consent. Choose "verbal in session" for the role-play.
3. On the client's page, under **Client app**, click **Invite to the client app**.
4. Send the link to your "client" (copy the message, or show the QR code).
5. Add a piece of homework and set the next session date.

## D. Client: join (≈2 min, on a phone)
1. Open the link, or go to **/join** and type the code.
2. Read the short screen and tick the box. Enter your name, an email *(different from the therapist's)* and a password.
3. Type the 6-digit code from your inbox, add a photo or skip. You're in.
4. Mark the homework done, write a short reply, and add a mood diary entry. Try one entry that is shared and one that isn't.

**Tell us:** Did you understand what your therapist can see? Was anything confusing or too long?

## E. Therapist: see the client's side
1. Refresh the client's page. You should see the homework marked **Done**, the reply, and only the **shared** diary entry.
2. Optional: click **Disconnect**. The client's app should then say it was closed.

## F. Therapist: a session (role-play)
1. **Start session**. Choose an online call (Chrome) or in person, then record 5–10 minutes of role-play.
2. **End session**. Wait for the note and reflection, about 2–3 minutes.
3. Review the note, check the reflection's quotes against the transcript, and approve.

**Tell us:** Was the note accurate? Was the reflection useful, or did it feel generic?

## F2. Therapist and client: a video session
1. **Start session**, choose the client, then **Video call in HavenSpace**. Click **Join** and allow the camera and microphone.
2. The client either opens their app (a **Join now** button appears within about 15 seconds) or opens a **one-time link** you create under "How … joins" and send them.
3. Optional: **Record for notes** (needs consent), talk for a few minutes, then **End session**. The note is prepared as usual.
4. After ending, open the one-time link again: it should say the link no longer works.

**Tell us:** Was the picture and sound clear? Was it obvious how to join?

## G. Things to try to break
- Use an old or used invite link. You should get a clear "can't be used" message.
- As the client, open `/today` or `/clients`. You should land back in your own space.
- Enter a wrong sign-in code, or ask for many codes quickly. You should get a polite message.
- Sign out, then sign in with your password. Then try **Forgot password?**.
- Try to create a second account with the same email. The screen looks normal; the email owner gets a "you already have an account" message.

## Reporting
Use the **Pilot feedback** button in the app, or write to Shurik with:
- what you did;
- what you expected;
- what happened;
- a screenshot.

---

### For Shurik: testing on your laptop
Run `npm run seed` once. Then open **http://localhost:3210/dev/login**: one click signs you in as:
- the demo therapist (admin);
- a therapist waiting for approval;
- a client of the demo therapist;
- a brand-new therapist.
