"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Monitor, Moon, Sun } from "lucide-react";

export type Theme = "system" | "light" | "dark";
const OPTIONS: { value: Theme; icon: typeof Sun }[] = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
];

function applyTheme(next: Theme) {
  const root = document.documentElement;
  if (next === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", next);
  document.cookie = `theme=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

/** Light / Dark / Match my device. Remembered in a cookie so the server renders
 *  the right colours straight away (no flash). Not tied to an account. */
export function ThemeSwitch({ initial, compact = false }: { initial: Theme; compact?: boolean }) {
  const t = useTranslations("theme");
  const [theme, setTheme] = useState<Theme>(initial);
  function choose(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }
  return (
    <div role="radiogroup" aria-label={t("label")} className={compact ? "inline-flex shrink-0 rounded-full border border-line bg-surface p-1" : "inline-flex max-w-full flex-wrap rounded-card border border-line bg-surface p-1 sm:rounded-full"}>
      {OPTIONS.map(({ value, icon: Icon }) => (
        <button key={value} type="button" role="radio" aria-checked={theme === value} onClick={() => choose(value)}
          title={t(value)} aria-label={compact ? t(value) : undefined}
          className={`flex items-center gap-1.5 rounded-full ${compact ? "p-1.5" : "px-2.5 py-1.5 sm:px-3"} text-sm ${theme === value ? "bg-primary-soft text-primary-strong" : "text-muted hover:text-ink"}`}>
          <Icon size={15} aria-hidden />{!compact && t(value)}
        </button>
      ))}
    </div>
  );
}
