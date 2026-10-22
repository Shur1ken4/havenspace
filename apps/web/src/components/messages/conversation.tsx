"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Check, CheckCheck, SendHorizontal } from "lucide-react";
import { loadMessages, readUpTo, sendMessage, type ChatMessage } from "@/lib/messages";

const POLL_MS = 5000;

/**
 * One conversation between a therapist and a client. New messages arrive by
 * checking every few seconds while the page is open (no extra service needed).
 */
export function Conversation({ clientId, initial, initialReadUpTo, otherName }: {
  clientId: string; initial: ChatMessage[]; initialReadUpTo: string | null; otherName: string;
}) {
  const t = useTranslations("messages");
  const f = useFormatter();
  const [items, setItems] = useState(initial);
  const [readTo, setReadTo] = useState(initialReadUpTo);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const latest = useRef(initial.at(-1)?.at ?? null);

  const merge = useCallback((fresh: ChatMessage[]) => {
    if (!fresh.length) return;
    setItems((cur) => {
      const seen = new Set(cur.map((m) => m.id));
      return [...cur, ...fresh.filter((m) => !seen.has(m.id))];
    });
    latest.current = fresh.at(-1)!.at;
  }, []);

  // Check for new messages while the page is visible.
  useEffect(() => {
    let stop = false;
    async function tick() {
      if (document.visibilityState !== "visible") return;
      const [fresh, read] = await Promise.all([loadMessages(clientId, latest.current), readUpTo(clientId)]).catch(() => [[], null] as const);
      if (stop) return;
      merge([...fresh]);
      if (read) setReadTo(read);
    }
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => { stop = true; clearInterval(id); document.removeEventListener("visibilitychange", tick); };
  }, [clientId, merge]);

  // Stay at the newest message, unless the reader has scrolled up to read older ones.
  useLayoutEffect(() => {
    const el = list.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [items]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setFailed(false);
    const res = await sendMessage(clientId, text).catch(() => ({ ok: false as const }));
    setSending(false);
    if (!res.ok) { setFailed(true); return; }
    atBottom.current = true;
    setDraft("");
    merge([res.message]);
  }

  const day = (iso: string) => new Date(iso).toDateString();

  return (
    <div className="flex h-[min(70dvh,680px)] min-h-[420px] flex-col overflow-hidden rounded-panel border border-line bg-surface">
      <div ref={list} role="log" aria-live="polite" aria-label={t("conversationWith", { name: otherName })}
        onScroll={(e) => { const el = e.currentTarget; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; }}
        className="flex-1 space-y-2 overflow-y-auto px-3 py-4 sm:px-5">
        {items.length === 0 && <p className="mx-auto max-w-sm py-10 text-center text-muted">{t("empty", { name: otherName })}</p>}
        {items.map((m, i) => {
          const newDay = i === 0 || day(items[i - 1].at) !== day(m.at);
          const read = m.mine && (m.read || (readTo !== null && m.at <= readTo));
          return (
            <div key={m.id}>
              {newDay && <p className="py-2 text-center text-xs text-muted">{f.dateTime(new Date(m.at), { dateStyle: "medium" })}</p>}
              <div className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-card px-3.5 py-2 sm:max-w-[70%] ${m.mine ? "rounded-br-inner bg-primary-soft text-ink" : "rounded-bl-inner border border-line bg-surface-2 text-ink"}`}>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-muted">
                    {f.dateTime(new Date(m.at), { timeStyle: "short" })}
                    {m.mine && (read
                      ? <CheckCheck size={13} className="text-primary-strong" aria-label={t("read")} />
                      : <Check size={13} aria-label={t("sent")} />)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {failed && <p role="alert" className="border-t border-line bg-attention-soft px-4 py-2 text-sm text-ink">{t("failed")}</p>}
      <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex items-end gap-2 border-t border-line p-2 sm:p-3">
        <label htmlFor="message" className="sr-only">{t("placeholder")}</label>
        <textarea id="message" value={draft} rows={1} maxLength={4000} placeholder={t("placeholder")}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter makes a new line (phones keep their own Enter for new lines).
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) { e.preventDefault(); void send(); }
          }}
          className="max-h-40 min-h-11 flex-1 resize-none rounded-control border border-line bg-surface px-3 py-2.5 text-ink [field-sizing:content]" />
        <button type="submit" disabled={!draft.trim() || sending} aria-label={t("send")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-strong text-on-primary hover:bg-primary disabled:opacity-50">
          <SendHorizontal size={18} aria-hidden />
        </button>
      </form>
    </div>
  );
}
