"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { deleteToolResult } from "@/app/(app)/video/tool-actions";

/** Delete a saved tool result, with a second tap to confirm. */
export function DeleteToolResult({ id }: { id: string }) {
  const t = useTranslations("tools");
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} aria-label={t("delete")} className="rounded-full p-2 text-muted hover:bg-surface-2 hover:text-ink">
        <Trash2 size={16} aria-hidden />
      </button>
    );
  }
  return (
    <span className="flex shrink-0 gap-1 text-sm">
      <button type="button" disabled={pending} onClick={() => start(() => deleteToolResult(id))} className="rounded-control bg-destructive px-2.5 py-1 text-on-primary">{t("deleteConfirm")}</button>
      <button type="button" onClick={() => setAsking(false)} className="rounded-control px-2 py-1 text-muted hover:text-ink">{t("cancel")}</button>
    </span>
  );
}
