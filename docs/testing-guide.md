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
3. Optional: **Record for notes** (needs consent; it never starts by itself). Try **Pause**, **Resume** and **Finish recording**: the call goes on and the note starts being prepared. Then **End session**.
4. If the client uses the app, they get an email when you join first ("… is waiting"), and you get one when they join first.
5. On a computer, either of you clicks **Share screen** and picks a window, a tab or the whole screen. The other person sees it big, with **Full screen**. To share a video's sound, pick a Chrome tab and leave "Share tab audio" on. Phones can watch a shared screen but can't share their own.
6. During the call, open **Clients** (or any other page): the call carries on in a small window in the corner. Use **Back to the call** to return. Recording and an open tool should be just as you left them.
7. Click **Background** and try **Soft blur**, **Strong blur**, a picture, and **Your picture**. Ask the client what they see.
8. After ending, open the one-time link again: it should say the link no longer works.

**Tell us:** Was the picture and sound clear? Was it obvious how to join? Was the shared screen readable?

## F2b. Saving a video call to your computer
1. In a video call with your client, click **Save to my computer**. The client gets a question; try **No, thank you** once, then ask again and **I agree**.
2. Talk for a minute, share your screen for a bit, then click **Stop and save**. A video file appears in your Downloads folder: play it.
3. Try again and let the client press **Stop** on their side.

**Tell us:** Was the client's question clear? Is the video and sound good enough to review later?

## F4. Tools in a video session
1. In a video session with your client (or a second device using the one-time link), click **Tools** and open each one: **Scale 0–10**, **Wheel of balance**, **Emotion wheel**, **Associative cards**, **Drawing board**. In the cards, try each **Deck**, and draw a picture, then switch to **Words** and draw a word to go with it. Draw as many cards as you like: all face-down cards and the cards on the table should fit on the screen without scrolling. Tap a card on the table to look closer and zoom in. Write a word under a card, open another tool and come back: the word is still there.
2. In **Settings → Card decks**, make a deck of your own with a few pictures, then use it in a call.
3. On the client's side, answer: choose a number, rate the areas, tap feeling words, pick a face-down card and write a word for it, draw a line.
4. Click **Save to card** after each one, then open the client's page: everything is under **From sessions**.

**Tell us:** Was it easy for the client on a phone? Which questions, life areas, feeling words or cards would you change?

## F5. Messages
1. Therapist: **Messages** → your client → write something. Client (on a phone): an email arrives without the text; open the app → **Messages** and reply.
2. The therapist sees a number next to **Messages** until they read it.

**Tell us:** Is the notice for clients clear? Would you want "office hours" for replies?

## F3. The apps for Mac, Windows and Android
1. On the homepage, go to **HavenSpace on all your devices** and tap **Download** for your device. **First time opening it?** shows the one-time steps (these are test versions without a paid signature yet).
2. Sign in. Start a video session and try **Share screen**: on a computer you can pick the whole screen or any app window.
3. On Android, check that there's no browser address bar at the top, and that the app looks right when you turn the phone sideways.
4. In the apps you should never see the homepage: the app opens on sign-in, and **HavenSpace website ↗** opens the website in your browser.

**Tell us:** Did it install without confusion? Does anything look cut off or too small on your screen?

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
