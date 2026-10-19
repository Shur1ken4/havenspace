"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/components/ui/cn";

const items = [
  { href: "/today", key: "today" },
  { href: "/clients", key: "clients" },
  { href: "/supervision", key: "supervision" },
  { href: "/settings", key: "settings" },
] as const;

export function AppNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const t = useTranslations("nav");
  const path = usePathname();
  return (
    <nav aria-label="App" className="flex gap-1 overflow-x-auto">
      {[...items, ...(isAdmin ? [{ href: "/admin", key: "admin" } as const] : [])].map((it) => {
        const active = path === it.href || path.startsWith(it.href + "/");
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-[10px] px-3 py-2 text-[15px]",
              active ? "bg-primary-soft text-primary-strong" : "text-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            {t(it.key)}
          </Link>
        );
      })}
    </nav>
  );
}
