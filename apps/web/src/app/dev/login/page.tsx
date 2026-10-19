import { notFound } from "next/navigation";
import { devLoginEnabled } from "@/lib/dev-login";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { devSignIn } from "./actions";

// Local development only: one click to be any kind of test user.
const PERSONAS = [
  { email: "demo@psych.test", title: "Demo therapist", body: "Approved, admin, with role-play clients and sessions. Run `npm run seed` first." },
  { email: "pending@psych.test", title: "Waiting for approval", body: "Finished onboarding; sees the waiting page until an admin approves them." },
  { email: "client@psych.test", title: "Client of the demo therapist", body: "The client app: homework, next session, mood diary. Run `npm run seed` first." },
  { email: "new", title: "Brand-new therapist", body: "A fresh email each time: walks through onboarding like a real first visit." },
];

export default function DevLogin() {
  if (!devLoginEnabled()) notFound();
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div className="space-y-2">
        <h1 className="text-3xl">Test accounts</h1>
        <p className="text-muted">Local only. This page doesn&apos;t exist on the live website. Synthetic data only.</p>
        <p className="text-muted">To try a real client invite: sign in as the demo therapist, open a client, press &ldquo;Invite to the client app&rdquo;, then open the link in a private window.</p>
      </div>
      <ul className="grid gap-4">
        {PERSONAS.map((p) => (
          <li key={p.email}>
            <Card className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="font-medium text-ink">{p.title}</p>
                <p className="text-sm text-muted">{p.body}</p>
                {p.email !== "new" && <p className="text-sm text-muted">{p.email}</p>}
              </div>
              <form action={devSignIn}>
                <input type="hidden" name="email" value={p.email} />
                <button className={buttonClass("primary")}>Sign in</button>
              </form>
            </Card>
          </li>
        ))}
      </ul>
      <Card>
        <form action={devSignIn} className="flex flex-wrap items-center gap-3">
          <label htmlFor="email" className="text-sm text-muted">Any other email</label>
          <Input id="email" name="email" type="email" required placeholder="someone@psych.test" className="min-w-0 flex-1" />
          <button className={buttonClass("secondary")}>Sign in</button>
        </form>
      </Card>
    </main>
  );
}
