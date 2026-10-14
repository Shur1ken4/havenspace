"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Copy, Download, FileText, Lock, Search, ArrowLeftRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Notice } from "@/components/ui/notice";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/field";
import { cn } from "@/components/ui/cn";
import type { NoteContent, ReflectionContent, ReflectionItem, Segment } from "@/lib/types";
import { approveNote, redraft, renameSpeakers, saveNote, swapSpeakers } from "./review-actions";

type Rubric = { id: string; label: string; description: string };

export type ReviewProps = {
  sessionId: string;
  isRecap: boolean;
  note: { status: "draft" | "approved"; approvedAt: string | null; content: NoteContent } | null;
  reflection: { content: ReflectionContent; modalityName: string; dimensions: Rubric[]; dropped: number } | null;
  segments: Segment[];
  speakerNames: Record<string, string>;
};

function msToClock(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Renders text with "[check]" markers as soft amber highlights. */
function WithChecks({ text }: { text: string }) {
  const parts = text.split(/(\[check[^\]]*\])/gi);
  return (
    <>
      {parts.map((p, i) =>
        /^\[check/i.test(p) ? <mark key={i} className="rounded bg-attention-soft px-1 text-ink">{p}</mark> : <span key={i}>{p}</span>,
      )}
    </>
  );
}

export function Review(props: ReviewProps) {
  const t = useTranslations("review");
  const [tab, setTab] = useState("note");
  const [highlight, setHighlight] = useState<number[]>([]);
  const transcriptRef = useRef<HTMLDivElement>(null);

  function showMoment(ids: number[]) {
    setHighlight(ids);
    setTab("transcript");
    requestAnimationFrame(() => {
      const el = transcriptRef.current?.querySelector(`[data-idx="${ids[0]}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      (el as HTMLElement | null)?.focus({ preventScroll: true });
    });
  }

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-6">
      <TabsList aria-label="Session">
        <TabsTrigger value="note">{t("tabNote")}</TabsTrigger>
        <TabsTrigger value="reflection">{t("tabReflection")}</TabsTrigger>
        <TabsTrigger value="transcript">{t("tabTranscript")}</TabsTrigger>
      </TabsList>
      <TabsContent value="note" className="fade-up">
        <NoteTab sessionId={props.sessionId} note={props.note} />
      </TabsContent>
      <TabsContent value="reflection" className="fade-up">
        {props.isRecap || !props.reflection ? (
          <Notice tone="info">{t("noReflectionRecap")}</Notice>
        ) : (
          <ReflectionTab reflection={props.reflection} segments={props.segments} onMoment={showMoment} />
        )}
      </TabsContent>
      <TabsContent value="transcript" className="fade-up" forceMount hidden={tab !== "transcript"}>
        <div ref={transcriptRef}>
          <TranscriptTab sessionId={props.sessionId} segments={props.segments} names={props.speakerNames} highlight={highlight} isRecap={props.isRecap} />
        </div>
      </TabsContent>
    </Tabs>
  );
}

// ── Note ──────────────────────────────────────────────────────────────────────
function NoteTab({ sessionId, note }: { sessionId: string; note: ReviewProps["note"] }) {
  const t = useTranslations("review");
  const tn = useTranslations("noteSections");
  const tc = useTranslations("common");
  const [sections, setSections] = useState(note?.content.sections ?? []);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  if (!note) return <p className="text-muted">{tc("loading")}</p>;
  const locked = note.status === "approved";
  const hasChecks = sections.some((s) => /\[check/i.test(s.text));
  const label = (key: string) => (tn.has(key) ? tn(key) : key);

  function save() {
    start(async () => { await saveNote(sessionId, sections); setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 2000); });
  }
  function asText() {
    return sections.map((s) => `${label(s.key)}\n${s.text}`).join("\n\n");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
      <Card className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {locked ? <Chip><Lock size={14} aria-hidden /> {t("approved", { date: new Date(note.approvedAt!).toLocaleDateString() })}</Chip> : <Chip tone="amber">{t("draft")}</Chip>}
          <span className="text-sm text-muted">{note.content.format}</span>
        </div>
        {!locked && <p className="text-sm text-muted">{t("aiDraft")}</p>}
        {hasChecks && !locked && <Notice tone="attention">{t("checkHint")}</Notice>}
        {sections.map((s, i) => (
          <section key={s.key} className="space-y-2">
            <h3 className="font-sans text-sm font-medium uppercase tracking-wider text-muted">{label(s.key)}</h3>
            {locked ? (
              <p className="whitespace-pre-wrap leading-relaxed"><WithChecks text={s.text} /></p>
            ) : (
              <Textarea
                aria-label={label(s.key)}
                value={s.text}
                rows={Math.max(3, Math.ceil(s.text.length / 80))}
                onChange={(e) => { const next = [...sections]; next[i] = { ...s, text: e.target.value }; setSections(next); setDirty(true); }}
                onBlur={() => dirty && save()}
              />
            )}
          </section>
        ))}
      </Card>
      <aside className="space-y-3">
        {!locked && (
          <Card className="space-y-3 p-5">
            <Button className="w-full" onClick={() => setConfirm(true)} disabled={pending}>{t("approve")}</Button>
            <p className="text-sm text-muted">{t("approveHint")}</p>
            {dirty ? <Button variant="secondary" className="w-full" onClick={save} disabled={pending}>{tc("save")}</Button> : saved ? <p className="text-sm text-muted">{tc("saved")}</p> : null}
            <Button variant="ghost" size="sm" className="w-full" onClick={() => start(() => redraft(sessionId))} disabled={pending}>{t("regenerate")}</Button>
          </Card>
        )}
        <Card className="flex flex-col gap-2 p-5">
          <a className={buttonClass("secondary", "sm")} href={`/api/sessions/${sessionId}/export?format=pdf`}><Download size={16} aria-hidden /> {t("exportPdf")}</a>
          <a className={buttonClass("secondary", "sm")} href={`/api/sessions/${sessionId}/export?format=docx`}><FileText size={16} aria-hidden /> {t("exportDocx")}</a>
          <Button variant="secondary" size="sm" onClick={async () => { await navigator.clipboard.writeText(asText()); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
            <Copy size={16} aria-hidden /> {copied ? t("copied") : t("copy")}
          </Button>
        </Card>
      </aside>
      <Dialog open={confirm} onOpenChange={setConfirm} title={t("approve")} description={t("approveConfirm")}>
        <div className="flex gap-2">
          <Button onClick={() => start(async () => { if (dirty) await saveNote(sessionId, sections); await approveNote(sessionId); setConfirm(false); })} disabled={pending}>{t("approve")}</Button>
          <Button variant="ghost" onClick={() => setConfirm(false)}>{tc("cancel")}</Button>
        </div>
      </Dialog>
    </div>
  );
}

// ── Reflection ────────────────────────────────────────────────────────────────
function ReflectionTab({ reflection, segments, onMoment }: {
  reflection: NonNullable<ReviewProps["reflection"]>; segments: Segment[]; onMoment: (ids: number[]) => void;
}) {
  const t = useTranslations("review");
  const startOf = (ids: number[]) => segments.find((s) => s.idx === ids[0])?.start_ms ?? 0;
  const c = reflection.content;

  const ItemCard = ({ item, tone }: { item: ReflectionItem; tone: "sage" | "blue" | "clay" }) => (
    <Card className="space-y-3 p-5">
      <p className="leading-relaxed text-ink">{item.text}</p>
      {item.quote && <blockquote className="border-l-2 border-accent pl-3 text-[15px] italic text-muted">“{item.quote}”</blockquote>}
      <Button variant="ghost" size="sm" onClick={() => onMoment(item.segment_ids)} className="-ml-2">
        <Chip tone={tone}>{msToClock(startOf(item.segment_ids))}</Chip> {t("seeMoment")}
      </Button>
    </Card>
  );

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-2xl">{t("strengths")}</h2>
        <div className="grid gap-3 md:grid-cols-3">{c.strengths.map((it, i) => <ItemCard key={i} item={it} tone="sage" />)}</div>
      </section>
      <section className="space-y-3">
        <h2 className="text-2xl">{t("openings")}</h2>
        <div className="grid gap-3 md:grid-cols-2">{c.missed_openings.map((it, i) => <ItemCard key={i} item={it} tone="blue" />)}</div>
      </section>
      <section className="space-y-3">
        <h2 className="text-2xl">{t("tryNext")}</h2>
        {c.try_next.map((it, i) => <ItemCard key={i} item={it} tone="clay" />)}
      </section>
      {reflection.dropped > 0 && <p className="text-sm text-muted">{t("reflectionDropped", { count: reflection.dropped })}</p>}
      {c.rubric.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-2xl">{t("rubric", { modality: reflection.modalityName })}</h2>
          <p className="text-sm text-muted">{t("rubricNote")}</p>
          <Card className="divide-y divide-line p-0">
            {c.rubric.map((r) => {
              const dim = reflection.dimensions.find((d) => d.id === r.dimension_id);
              return (
                <div key={r.dimension_id} className="grid gap-2 p-5 sm:grid-cols-[220px_1fr]">
                  <div>
                    <p className="font-medium text-ink">{dim?.label ?? r.dimension_id}</p>
                    <div className="mt-1 flex gap-1" aria-label={`${r.score} / 5`}>
                      {[1, 2, 3, 4, 5].map((n) => <span key={n} className={cn("h-2 w-6 rounded-full", n <= r.score ? "bg-primary" : "bg-surface-2")} />)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted">{r.rationale}</p>
                    {r.segment_ids.length > 0 && <Button variant="ghost" size="sm" className="-ml-3" onClick={() => onMoment(r.segment_ids)}>{t("seeMoment")} · {msToClock(startOf(r.segment_ids))}</Button>}
                  </div>
                </div>
              );
            })}
          </Card>
        </section>
      )}
    </div>
  );
}

// ── Transcript ────────────────────────────────────────────────────────────────
function TranscriptTab({ sessionId, segments, names, highlight, isRecap }: {
  sessionId: string; segments: Segment[]; names: Record<string, string>; highlight: number[]; isRecap: boolean;
}) {
  const t = useTranslations("review");
  const tc = useTranslations("common");
  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [draftNames, setDraftNames] = useState(names);
  const [pending, start] = useTransition();
  const speakers = useMemo(() => [...new Set(segments.map((s) => s.speaker))], [segments]);
  const nameOf = (sp: string) => names[sp] || (t.has(`speaker_${sp}`) ? t(`speaker_${sp}`) : sp);
  const q = query.trim().toLowerCase();
  const shown = q ? segments.filter((s) => s.text.toLowerCase().includes(q)) : segments;
  const color = (sp: string) => (sp === "therapist" ? "text-primary-strong" : sp === "client" ? "text-[color:var(--calm-blue)]" : "text-accent");

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative flex-1">
          <span className="sr-only">{t("searchTranscript")}</span>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <Input className="pl-9" placeholder={t("searchTranscript")} value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        {!isRecap && <Button variant="secondary" size="sm" onClick={() => setRenaming(true)}>{t("speakerRename")}</Button>}
        {!isRecap && speakers.includes("therapist") && speakers.includes("client") && (
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(() => swapSpeakers(sessionId, "therapist", "client"))}>
            <ArrowLeftRight size={16} aria-hidden /> {nameOf("therapist")} ⇄ {nameOf("client")}
          </Button>
        )}
      </div>
      <ol className="space-y-1">
        {shown.map((s) => (
          <li
            key={s.idx} data-idx={s.idx} tabIndex={-1}
            className={cn("grid grid-cols-[56px_1fr] gap-3 rounded-[10px] px-3 py-2.5 sm:grid-cols-[56px_110px_1fr]", highlight.includes(s.idx) && "highlight-moment")}
          >
            <span className="pt-0.5 text-sm tabular-nums text-muted">{msToClock(s.start_ms)}</span>
            <span className={cn("text-sm font-medium sm:pt-0.5", color(s.speaker))}>{nameOf(s.speaker)}</span>
            <p className="col-span-2 leading-relaxed sm:col-span-1">{s.text}</p>
          </li>
        ))}
      </ol>
      <Dialog open={renaming} onOpenChange={setRenaming} title={t("speakerRename")}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); start(async () => { await renameSpeakers(sessionId, draftNames); setRenaming(false); }); }}>
          {speakers.map((sp) => (
            <label key={sp} className="block space-y-1.5">
              <span className="text-[15px] font-medium">{t("speakerName", { speaker: t.has(`speaker_${sp}`) ? t(`speaker_${sp}`) : sp })}</span>
              <Input value={draftNames[sp] ?? ""} placeholder={nameOf(sp)} maxLength={30} onChange={(e) => setDraftNames({ ...draftNames, [sp]: e.target.value })} />
            </label>
          ))}
          <Button type="submit" disabled={pending}>{tc("save")}</Button>
        </form>
      </Dialog>
    </Card>
  );
}
