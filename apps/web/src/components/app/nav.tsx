"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/components/ui/cn";

const items = [
  { href: "/today", key: "today" },
  { href: "/clients", key: "clients" },
  { href: "/messages", key: "messages" },
  { href: "/supervision", key: "supervision" },
  { href: "/settings", key: "settings" },
] as const;

export function AppNav({ isAdmin = false, unread = 0 }: { isAdmin?: boolean; unread?: number }) {
  const t = useTranslations("nav");
  const path = usePathname();
  return (
    <nav aria-label="App" className="flex gap-0.5 overflow-x-auto sm:gap-1">
      {[...items, ...(isAdmin ? [{ href: "/admin", key: "admin" } as const] : [])].map((it) => {
        const active = path === it.href || path.startsWith(it.href + "/");
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-inner px-2 py-2 text-sm sm:px-3 sm:text-ui",
              active ? "bg-primary-soft text-primary-strong" : "text-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            {t(it.key)}
            {it.key === "messages" && unread > 0 && (
              <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary-strong px-1.5 text-xs font-medium text-on-primary">
                {unread > 99 ? "99+" : unread}<span className="sr-only"> {t("unread")}</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
