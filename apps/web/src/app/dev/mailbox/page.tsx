import { notFound } from "next/navigation";
import { devMailbox } from "@/lib/email";

// Local development only: shows emails that would have been sent.
export default function DevMailbox() {
  if (process.env.NODE_ENV === "production" || process.env.EMAIL_TRANSPORT !== "console") notFound();
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-10">
      <h1 className="text-3xl">Dev mailbox</h1>
      <p className="text-muted">Local only. Newest first. Nothing here is sent.</p>
      {devMailbox.length === 0 && <p>No emails yet.</p>}
      {devMailbox.map((m, i) => {
        const link = m.text.match(/https?:\/\/\S+/)?.[0];
        return (
          <article key={i} className="rounded-[14px] border border-line bg-surface p-5">
            <p className="text-sm text-muted">{m.at} · to {m.to}</p>
            <p className="font-medium">{m.subject}</p>
            {link && <a className="mt-2 inline-block break-all text-primary-strong underline" href={link}>{link}</a>}
          </article>
        );
      })}
    </main>
  );
}
