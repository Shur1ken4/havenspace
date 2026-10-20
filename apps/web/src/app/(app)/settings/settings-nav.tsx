"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/components/ui/cn";

export function SettingsNav() {
  const t = useTranslations("settings");
  const path = usePathname();
  const items = [
    { href: "/settings", label: t("profile") },
    { href: "/settings/account", label: t("account") },
    { href: "/settings/privacy", label: t("privacy") },
    { href: "/settings/security", label: t("security") },
  ];
  return (
    <nav aria-label={t("title")} className="flex max-w-full gap-1 overflow-x-auto rounded-card border border-line bg-surface-2 p-1 sm:inline-flex">
      {items.map((it) => (
        <Link key={it.href} href={it.href} aria-current={path === it.href ? "page" : undefined}
          className={cn("shrink-0 whitespace-nowrap rounded-inner px-3 py-2 text-sm sm:px-4 sm:text-ui", path === it.href ? "bg-surface text-ink shadow-soft" : "text-muted hover:text-ink")}>
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
