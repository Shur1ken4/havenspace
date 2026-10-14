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
    { href: "/settings/privacy", label: t("privacy") },
    { href: "/settings/security", label: t("security") },
  ];
  return (
    <nav aria-label={t("title")} className="inline-flex gap-1 rounded-[14px] border border-line bg-surface-2 p-1">
      {items.map((it) => (
        <Link key={it.href} href={it.href} aria-current={path === it.href ? "page" : undefined}
          className={cn("rounded-[10px] px-4 py-2 text-[15px]", path === it.href ? "bg-surface text-ink shadow-soft" : "text-muted hover:text-ink")}>
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
