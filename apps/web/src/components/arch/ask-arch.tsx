"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations, useFormatter } from "next-intl";
import { ArrowUp, CalendarClock, Check, ClipboardList, X } from "lucide-react";
import { Arch, type ArchMood } from "@/components/arch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Select } from "@/components/ui/field";
import { approveArchProposal } from "@/lib/arch/actions";
import type { Proposal } from "@/lib/arch/tools";
import { Answer } from "./answer";

type ProposalCard = Proposal & { key: string; state: "pending" | "approved" | "dismissed" | "error" };
type Msg = { role: "user" | "assistant"; content: string; cards?: ProposalCard[]; error?: string };

/** "Ask Arch" (ADR-19): the therapist's AI practice agent. */
export function AskArch({ clients, initialClientId, brief, enabled }: {
  clients: { id: string; pseudonym: string }[]; initialClientId?: string; brief?: boolean; enabled: boolean;
}) {
  const t = useTranslations("askArch");
  const format = useFormatter();
  const [clientId, setClientId] = useState(initialClientId ?? "");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [looking, setLooking] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const [, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const briefed = useRef(false);
  const client = clients.find((c) => c.id === clientId);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, looking]);

  const update = (fn: (last: Msg) => Msg) => setMessages((all) => [...all.slice(0, -1), fn(all[all.length - 1])]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const history = [...messages.filter((m) => m.content.trim()).map(({ role, content }) => ({ role, content })), { role: "user" as const, content: question }];
    setMessages((m) => [...m, { role: "user", content: question }, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    setLooking(t("thinking"));
    try {
      const res = await fetch("/api/arch", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-20), clientId: clientId || undefined, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      if (!res.ok || !res.body) {
        const code = res.status === 429 ? "limit" : res.status === 503 ? "notConfigured" : "failed";
        update((m) => ({ ...m, error: t(`error_${code}`) }));
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "text") { setLooking(null); setWriting(true); update((m) => ({ ...m, content: m.content + ev.text })); }
          else if (ev.type === "break") update((m) => ({ ...m, content: m.content && !m.content.endsWith("\n\n") ? `${m.content}\n\n` : m.content }));
          else if (ev.type === "tool") { setWriting(false); setLooking(t.has(`tool_${ev.name}`) ? t(`tool_${ev.name}`) : t("thinking")); }
          else if (ev.type === "proposal") update((m) => ({ ...m, cards: [...(m.cards ?? []), { ...ev.proposal, key: `${Date.now()}-${m.cards?.length ?? 0}`, state: "pending" }] }));
          else if (ev.type === "error") update((m) => ({ ...m, error: t(ev.error === "refusal" ? "error_refusal" : "error_failed") }));
        }
      }
    } catch {
      update((m) => ({ ...m, error: t("error_failed") }));
    } finally {
      setBusy(false);
      setLooking(null);
      setWriting(false);
    }
  }

  // "Brief me" from a client page: ask straight away.
  useEffect(() => {
    if (!brief || !client || !enabled || briefed.current) return;
    briefed.current = true;
    void Promise.resolve().then(() => send(t("briefPrompt", { name: client.pseudonym })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief, client, enabled]);

  function decide(msgIndex: number, key: string, approve: boolean) {
    const card = messages[msgIndex].cards?.find((c) => c.key === key);
    if (!card) return;
    const set = (state: ProposalCard["state"]) => setMessages((all) => all.map((m, i) => i !== msgIndex ? m : { ...m, cards: m.cards?.map((c) => c.key === key ? { ...c, state } : c) }));
    if (!approve) { set("dismissed"); return; }
    start(async () => {
      const res = await approveArchProposal(card.kind === "homework"
        ? { kind: "homework", clientId: card.clientId, title: card.title, details: card.details, dueOn: card.dueOn }
        : { kind: "next_session", clientId: card.clientId, startsAt: card.startsAt }).catch(() => ({ error: "invalid" as const }));
      set("ok" in res ? "approved" : "error");
    });
  }

  const mood: ArchMood = busy ? (writing ? "writing" : "thinking") : messages.some((m) => m.cards?.some((c) => c.state === "approved")) ? "done" : "idle";
  const suggestions = client
    ? [t("briefPrompt", { name: client.pseudonym }), t("sClientThemes", { name: client.pseudonym }), t("sClientHomework", { name: client.pseudonym })]
    : [t("sNext"), t("sHomework"), t("sHours"), t("sSleep")];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <section className="flex items-center gap-4">
        <Arch mood={mood} className="h-20 w-20 shrink-0 sm:h-24 sm:w-24" />
        <div className="min-w-0 space-y-1">
          <h1 className="text-3xl sm:text-4xl">{t("title")}</h1>
          <p className="text-muted">{t("subtitle")}</p>
        </div>
      </section>

      {!enabled && <Notice tone="attention">{t("error_notConfigured")}</Notice>}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor="arch-client" className="text-muted">{t("about")}</label>
        <Select id="arch-client" value={clientId} onChange={(e) => setClientId(e.target.value)} className="h-9 w-auto min-w-40 text-sm">
          <option value="">{t("allClients")}</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.pseudonym}</option>)}
        </Select>
      </div>

      {messages.length === 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {suggestions.map((s) => (
            <button key={s} type="button" disabled={!enabled} onClick={() => send(s)}
              className="rounded-card border border-line bg-surface px-4 py-3 text-left text-ink hover:border-primary hover:bg-primary-soft/40 disabled:opacity-50">
              {s}
            </button>
          ))}
        </div>
      )}

      <ol className="space-y-4" aria-live="polite">
        {messages.map((m, i) => (
          <li key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            {m.role === "user" ? (
              <p className="max-w-[85%] rounded-card rounded-br-sm bg-primary-soft px-4 py-2.5 text-ink">{m.content}</p>
            ) : (
              <div className="space-y-3">
                {(m.content || (busy && i === messages.length - 1)) && (
                  <Card className="p-4 sm:p-5">
                    {m.content ? <Answer text={m.content} /> : <p className="flex items-center gap-2 text-muted"><span className="breathing-dot !h-2.5 !w-2.5" /> {looking ?? t("thinking")}</p>}
                    {m.content && busy && i === messages.length - 1 && looking && <p className="mt-3 flex items-center gap-2 text-sm text-muted"><span className="breathing-dot !h-2 !w-2" /> {looking}</p>}
                  </Card>
                )}
                {m.cards?.map((c) => (
                  <Card key={c.key} className="space-y-3 border-primary p-4">
                    <p className="flex items-start gap-2 text-ink">
                      {c.kind === "homework" ? <ClipboardList size={18} className="mt-0.5 shrink-0 text-primary-strong" aria-hidden /> : <CalendarClock size={18} className="mt-0.5 shrink-0 text-primary-strong" aria-hidden />}
                      <span>
                        <span className="block text-sm text-muted">{c.kind === "homework" ? t("cardHomework", { name: c.client }) : t("cardBooking", { name: c.client })}</span>
                        <span className="font-medium">{c.kind === "homework" ? c.title : format.dateTime(new Date(c.startsAt), { dateStyle: "full", timeStyle: "short" })}</span>
                        {c.kind === "homework" && c.details && <span className="block text-sm text-muted">{c.details}</span>}
                        {c.kind === "homework" && c.dueOn && <span className="block text-sm text-muted">{t("due", { date: format.dateTime(new Date(`${c.dueOn}T12:00:00`), { dateStyle: "medium" }) })}</span>}
                      </span>
                    </p>
                    {c.state === "pending" && (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => decide(i, c.key, true)}><Check size={16} aria-hidden /> {t("approve")}</Button>
                        <Button size="sm" variant="ghost" onClick={() => decide(i, c.key, false)}><X size={16} aria-hidden /> {t("dismiss")}</Button>
                      </div>
                    )}
                    {c.state === "approved" && <p className="text-sm text-primary-strong">{t("approved")} <Link href={`/clients/${c.clientId}`} className="underline underline-offset-4">{t("openClient", { name: c.client })}</Link></p>}
                    {c.state === "dismissed" && <p className="text-sm text-muted">{t("dismissed")}</p>}
                    {c.state === "error" && <p className="text-sm text-attention-strong">{t("error_failed")}</p>}
                  </Card>
                ))}
                {m.error && <Notice tone="attention">{m.error}</Notice>}
              </div>
            )}
          </li>
        ))}
      </ol>
      <div ref={endRef} />

      <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="sticky bottom-3 space-y-2">
        <div className="flex items-end gap-2 rounded-card border border-line bg-surface p-2 shadow-[var(--shadow)]">
          <label htmlFor="arch-input" className="sr-only">{t("inputLabel")}</label>
          <textarea id="arch-input" rows={1} value={input} disabled={!enabled} maxLength={4000}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }}
            placeholder={client ? t("placeholderClient", { name: client.pseudonym }) : t("placeholder")}
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-ink placeholder:text-muted/80 focus:outline-none" />
          <Button type="submit" disabled={busy || !input.trim() || !enabled} aria-label={t("send")} className="h-11 w-11 shrink-0 !px-0"><ArrowUp size={18} aria-hidden /></Button>
        </div>
        <p className="px-1 text-xs text-muted">{t("disclaimer")}</p>
      </form>
    </div>
  );
}
