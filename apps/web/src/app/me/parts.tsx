"use client";
import { useActionState, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { MoodFace } from "@/components/mood-face";
import { addMood, deleteMood, leaveApp, setMoodShared, updateHomework, type FormResult } from "./actions";

type Homework = { id: string; title: string; details: string; due_label: string | null; done: boolean; reply: string };

export function HomeworkItem({ item }: { item: Homework }) {
  const t = useTranslations("me");
  const [reply, setReply] = useState(item.reply);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const save = (done: boolean) => start(async () => { await updateHomework(item.id, done, reply); setSaved(true); });
  return (
    <Card className={`space-y-3 p-5 ${item.done ? "opacity-80" : ""}`}>
      <label className="flex items-start gap-3">
        <input type="checkbox" className="mt-1.5 h-5 w-5 shrink-0 accent-[var(--primary-strong)]" checked={item.done} disabled={pending}
          onChange={(e) => save(e.target.checked)} />
        <span className="min-w-0 space-y-1">
          <span className={`block text-lg text-ink ${item.done ? "line-through decoration-muted" : ""}`}>{item.title}</span>
          {item.details && <span className="block whitespace-pre-wrap text-muted">{item.details}</span>}
          {item.due_label && <Chip tone="plain">{t("due", { date: item.due_label })}</Chip>}
        </span>
      </label>
      <div className="space-y-2 pl-8">
        <label htmlFor={`reply-${item.id}`} className="text-sm text-muted">{t("replyLabel")}</label>
        <Textarea id={`reply-${item.id}`} value={reply} maxLength={1000} className="min-h-20" onChange={(e) => { setReply(e.target.value); setSaved(false); }} />
        <div className="flex items-center gap-3">
          <Button variant="secondary" disabled={pending || reply === item.reply} onClick={() => save(item.done)}>{t("saveReply")}</Button>
          {saved && <span className="text-sm text-muted" aria-live="polite">{t("saved")}</span>}
        </div>
      </div>
    </Card>
  );
}

export function MoodCheckIn({ therapist }: { therapist: string }) {
  const t = useTranslations("me");
  const form = useRef<HTMLFormElement>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [state, action, pending] = useActionState<FormResult, FormData>(async (prev, data) => {
    const res = await addMood(prev, data);
    if (res.ok) { form.current?.reset(); setMood(null); }
    return res;
  }, {});
  return (
    <Card className="space-y-4 p-5">
      <form ref={form} action={action} className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-[15px] font-medium text-ink">{t("moodQuestion")}</legend>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((m) => (
              <label key={m} className={`flex cursor-pointer flex-col items-center gap-1 rounded-[14px] border px-3 py-2 ${mood === m ? "border-primary bg-primary-soft" : "border-line hover:border-primary/60"}`}>
                <input type="radio" name="mood" value={m} className="sr-only" required onChange={() => setMood(m)} />
                <MoodFace mood={m} className="h-10 w-10" />
                <span className="text-xs text-muted">{t(`mood${m}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="space-y-1.5">
          <label htmlFor="mood-note" className="text-[15px] font-medium text-ink">{t("noteLabel")}</label>
          <Textarea id="mood-note" name="note" maxLength={1000} className="min-h-20" placeholder={t("notePlaceholder")} />
        </div>
        <label className="flex items-start gap-3 text-[15px] text-ink">
          <input type="checkbox" name="shared" defaultChecked className="mt-1 h-4 w-4 accent-[var(--primary-strong)]" />
          <span>{t("shareWith", { name: therapist })}</span>
        </label>
        {state.error && <Notice tone="attention">{t("moodError")}</Notice>}
        <Button type="submit" disabled={pending || mood === null}>{t("saveMood")}</Button>
        {state.ok && <p className="text-sm text-muted" aria-live="polite">{t("moodSaved")}</p>}
      </form>
    </Card>
  );
}

export function MoodList({ items }: { items: { id: string; mood: number; note: string; shared: boolean; when: string }[] }) {
  const t = useTranslations("me");
  const [, start] = useTransition();
  if (items.length === 0) return null;
  return (
    <Card className="space-y-3 p-5">
      <h3 className="text-xl">{t("myDiary")}</h3>
      <ul className="divide-y divide-line">
        {items.map((m) => (
          <li key={m.id} className="flex gap-3 py-3">
            <MoodFace mood={m.mood} className="h-8 w-8 shrink-0" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm text-muted">{m.when} · {t(`mood${m.mood}`)}</p>
              {m.note && <p className="whitespace-pre-wrap text-ink">{m.note}</p>}
              <label className="flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" checked={m.shared} className="h-4 w-4 accent-[var(--primary-strong)]" onChange={(e) => start(() => setMoodShared(m.id, e.target.checked))} />
                {t("sharedToggle")}
              </label>
            </div>
            <button type="button" aria-label={t("deleteEntry")} className="self-start rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
              onClick={() => start(() => deleteMood(m.id))}><Trash2 size={16} aria-hidden /></button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function LeaveApp() {
  const t = useTranslations("me");
  const [word, setWord] = useState("");
  const [pending, start] = useTransition();
  return (
    <details className="rounded-[16px] border border-line bg-surface p-5">
      <summary className="cursor-pointer text-muted">{t("leaveTitle")}</summary>
      <div className="mt-4 space-y-3">
        <p className="text-muted">{t("leaveBody")}</p>
        <label htmlFor="leave-word" className="text-sm text-ink">{t("leaveType")}</label>
        <Input id="leave-word" value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" />
        <Button variant="destructive" disabled={pending || !["DELETE", "УДАЛИТЬ"].includes(word.trim().toUpperCase())}
          onClick={() => start(async () => { await leaveApp(word); })}>{t("leaveButton")}</Button>
      </div>
    </details>
  );
}
