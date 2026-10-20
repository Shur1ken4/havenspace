"use client";
import { useActionState, useRef, useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import QRCode from "qrcode";
import { CalendarClock, Check, Copy, Link2, Share2, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { MoodFace } from "@/components/mood-face";
import {
  addAssignment, archiveAssignment, clearNextSession, createInvite, disconnectClient, setNextSession,
} from "./client-app-actions";

export type ClientAppData = {
  link: { linked_at: string } | null;
  inviteExpires: string | null;
  assignments: { id: string; title: string; details: string; due_on: string | null; done_at: string | null; client_reply: string | null }[];
  nextSession: string | null;
  moods: { id: string; mood: number; note: string; created_at: string }[];
};

/** The therapist's view of the client app: invite, homework, next session, shared diary. */
export function ClientAppPanel({ clientId, active, data }: { clientId: string; active: boolean; data: ClientAppData }) {
  const t = useTranslations("clientApp");
  const tc = useTranslations("common");
  const f = useFormatter();
  const [pending, start] = useTransition();
  const [invite, setInvite] = useState<{ code: string; url: string; qr: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);

  function makeInvite() {
    setError(false);
    start(async () => {
      const res = await createInvite(clientId);
      if (!res.code || !res.expiresAt) { setError(true); return; }
      const url = `${window.location.origin}/join/${res.code}`;
      setInvite({ code: res.code, url, expiresAt: res.expiresAt, qr: await QRCode.toString(url, { type: "svg", margin: 1 }) });
      setCopied(false);
    });
  }
  const message = invite ? t("inviteMessage", { url: invite.url, code: invite.code }) : "";
  async function copy() {
    try { await navigator.clipboard.writeText(message); setCopied(true); } catch { setCopied(false); }
  }
  async function share() {
    try { await navigator.share({ text: message }); } catch { /* the person closed the share sheet */ }
  }

  return (
    <section aria-labelledby="client-app-title" className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="client-app-title" className="text-2xl">{t("title")}</h2>
        {data.link ? <Chip tone="sage">{t("connected")}</Chip> : data.inviteExpires ? <Chip tone="amber">{t("invited")}</Chip> : <Chip tone="plain">{t("notConnected")}</Chip>}
      </div>

      <Card className="space-y-4">
        {data.link ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted">{t("connectedSince", { date: f.dateTime(new Date(data.link.linked_at), { dateStyle: "medium" }) })}</p>
            {confirmOff ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="destructive" disabled={pending} onClick={() => start(async () => { await disconnectClient(clientId); setConfirmOff(false); })}>{t("disconnectConfirm")}</Button>
                <Button variant="ghost" onClick={() => setConfirmOff(false)}>{tc("cancel")}</Button>
              </div>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmOff(true)}>{t("disconnect")}</Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-muted">{t("inviteIntro")}</p>
            {data.inviteExpires && !invite && (
              <p className="text-sm text-muted">{t("inviteOutstanding", { date: f.dateTime(new Date(data.inviteExpires), { dateStyle: "medium" }) })}</p>
            )}
            {active ? (
              <Button onClick={makeInvite} disabled={pending}><Smartphone size={18} aria-hidden /> {data.inviteExpires || invite ? t("newInvite") : t("invite")}</Button>
            ) : (
              <Notice tone="attention">{t("archivedNoInvite")}</Notice>
            )}
            {error && <Notice tone="attention">{tc("somethingWrong")}</Notice>}
          </div>
        )}

        {invite && (
          <div className="grid gap-4 rounded-card border border-line bg-surface-2 p-4 sm:grid-cols-[auto_1fr] sm:items-center fade-up">
            <div className="mx-auto h-36 w-36 rounded-inner bg-white p-2" aria-label={t("qrLabel")} role="img" dangerouslySetInnerHTML={{ __html: invite.qr }} />
            <div className="min-w-0 space-y-2">
              <p className="text-sm text-muted">{t("codeLabel")}</p>
              <p className="font-serif text-3xl tracking-[0.15em] text-ink">{invite.code}</p>
              <p className="flex items-center gap-1.5 break-all text-sm text-muted"><Link2 size={14} aria-hidden className="shrink-0" />{invite.url}</p>
              <p className="text-sm text-muted">{t("inviteValid", { date: f.dateTime(new Date(invite.expiresAt), { dateStyle: "medium" }) })}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button variant="secondary" onClick={copy}>{copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />} {copied ? t("copied") : t("copyMessage")}</Button>
                {typeof navigator !== "undefined" && "share" in navigator && (
                  <Button variant="ghost" onClick={share}><Share2 size={16} aria-hidden /> {t("share")}</Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Homework clientId={clientId} items={data.assignments} />
        <div className="space-y-4">
          <NextSession clientId={clientId} startsAt={data.nextSession} />
          <Card className="space-y-3 p-5">
            <h3 className="text-xl">{t("diaryTitle")}</h3>
            {data.moods.length === 0 ? (
              <p className="text-sm text-muted">{data.link ? t("diaryEmpty") : t("diaryNotConnected")}</p>
            ) : (
              <ul className="space-y-3">
                {data.moods.map((m) => (
                  <li key={m.id} className="flex gap-3">
                    <MoodFace mood={m.mood} className="h-8 w-8 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-muted">{f.dateTime(new Date(m.created_at), { dateStyle: "medium", timeStyle: "short" })} · {t(`mood${m.mood}`)}</p>
                      {m.note && <p className="whitespace-pre-wrap text-ink">{m.note}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted">{t("diaryPrivacy")}</p>
          </Card>
        </div>
      </div>
    </section>
  );
}

function Homework({ clientId, items }: { clientId: string; items: ClientAppData["assignments"] }) {
  const t = useTranslations("clientApp");
  const f = useFormatter();
  const form = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<{ ok?: boolean; error?: boolean }, FormData>(async (prev, data) => {
    const res = await addAssignment(prev, data);
    if (res.ok) form.current?.reset();
    return res;
  }, {});
  const [, start] = useTransition();
  return (
    <Card className="space-y-4 p-5">
      <h3 className="text-xl">{t("homeworkTitle")}</h3>
      {items.length === 0 ? <p className="text-sm text-muted">{t("homeworkEmpty")}</p> : (
        <ul className="space-y-3">
          {items.map((a) => (
            <li key={a.id} className="rounded-control border border-line p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium text-ink">{a.title}</p>
                  {a.details && <p className="whitespace-pre-wrap text-sm text-muted">{a.details}</p>}
                  <div className="flex flex-wrap gap-1.5">
                    {a.done_at ? <Chip tone="sage">{t("done")}</Chip> : <Chip tone="plain">{t("notDone")}</Chip>}
                    {a.due_on && <Chip tone="plain">{t("due", { date: f.dateTime(new Date(`${a.due_on}T12:00:00`), { dateStyle: "medium" }) })}</Chip>}
                  </div>
                  {a.client_reply && <p className="mt-1 rounded-inner bg-surface-2 px-3 py-2 text-sm text-ink"><span className="text-muted">{t("reply")}: </span>{a.client_reply}</p>}
                </div>
                <button type="button" className="rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-ink" aria-label={t("archive")}
                  onClick={() => start(() => archiveAssignment(clientId, a.id))}><X size={16} aria-hidden /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form ref={form} action={action} className="space-y-3 border-t border-line pt-4">
        <input type="hidden" name="clientId" value={clientId} />
        <Field label={t("newHomework")} htmlFor="hw-title"><Input id="hw-title" name="title" required maxLength={120} placeholder={t("homeworkPlaceholder")} /></Field>
        <Field label={t("details")} htmlFor="hw-details"><Textarea id="hw-details" name="details" maxLength={2000} className="min-h-20" /></Field>
        <Field label={t("dueOptional")} htmlFor="hw-due"><Input id="hw-due" name="dueOn" type="date" /></Field>
        {state.error && <Notice tone="attention">{t("homeworkError")}</Notice>}
        <Button type="submit" disabled={pending}>{t("addHomework")}</Button>
      </form>
    </Card>
  );
}

function NextSession({ clientId, startsAt }: { clientId: string; startsAt: string | null }) {
  const t = useTranslations("clientApp");
  const f = useFormatter();
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!value) return;
    setError(false);
    start(async () => {
      const res = await setNextSession(clientId, new Date(value).toISOString());
      if (res.error) setError(true); else setValue("");
    });
  }
  return (
    <Card className="space-y-3 p-5">
      <h3 className="flex items-center gap-2 text-xl"><CalendarClock size={20} aria-hidden className="text-primary-strong" /> {t("nextSession")}</h3>
      {startsAt ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-ink">{f.dateTime(new Date(startsAt), { dateStyle: "full", timeStyle: "short" })}</p>
          <Button variant="ghost" disabled={pending} onClick={() => start(() => clearNextSession(clientId))}>{t("clear")}</Button>
        </div>
      ) : <p className="text-sm text-muted">{t("noNextSession")}</p>}
      <form onSubmit={save} className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <Field label={startsAt ? t("change") : t("setDate")} htmlFor="next-at">
            <Input id="next-at" type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} required />
          </Field>
        </div>
        <Button type="submit" variant="secondary" disabled={pending || !value}>{t("save")}</Button>
      </form>
      {error && <p className="text-sm text-attention-strong">{t("pastDate")}</p>}
      <p className="text-xs text-muted">{t("nextSessionHint")}</p>
    </Card>
  );
}
