"use client";
import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { MessagesSquare } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { sendFeedback } from "@/app/(app)/feedback-action";

export function FeedbackWidget() {
  const t = useTranslations("app");
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <button
        onClick={() => { setOpen(true); setDone(false); }}
        aria-label={t("feedback")}
        className="no-print fixed bottom-4 right-4 z-30 inline-flex h-11 w-11 items-center justify-center gap-2 rounded-full border border-line bg-surface text-sm text-ink shadow-soft hover:bg-surface-2 sm:bottom-5 sm:right-5 sm:h-auto sm:w-auto sm:px-4 sm:py-2.5"
      >
        <MessagesSquare size={16} aria-hidden /> <span className="hidden sm:inline">{t("feedback")}</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen} title={t("feedbackTitle")} description={t("feedbackBody")}>
        {done ? (
          <p className="text-ink">{t("feedbackThanks")}</p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => { await sendFeedback({ page: path.replace(/[0-9a-f-]{36}/g, ":id"), rating, message }); setDone(true); });
            }}
          >
            <fieldset>
              <legend className="mb-2 text-[15px] font-medium">{t("feedbackRating")}</legend>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    type="button" key={n} aria-pressed={rating === n} onClick={() => setRating(n)}
                    className={`h-10 w-10 rounded-full border ${rating === n ? "border-primary bg-primary-soft text-primary-strong" : "border-line"}`}
                  >{n}</button>
                ))}
              </div>
            </fieldset>
            <label className="block space-y-1.5">
              <span className="text-[15px] font-medium">{t("feedbackMessage")}</span>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} />
            </label>
            <Button type="submit" disabled={pending || (!rating && !message.trim())}>{t("feedbackSend")}</Button>
          </form>
        )}
      </Dialog>
    </>
  );
}
