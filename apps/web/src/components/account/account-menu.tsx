"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogOut, UserRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Avatar } from "./avatar";

/** Top-right account button: photo or initials, with a small menu. */
export function AccountMenu({ name, email, image, accountHref }: { name: string; email: string; image: string | null; accountHref: string }) {
  const t = useTranslations("account");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" aria-label={t("menu")}
        className="flex items-center gap-2 rounded-full p-0.5 hover:ring-2 hover:ring-primary-soft">
        <Avatar name={name} email={email} image={image} size={36} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-64 rounded-[14px] border border-line bg-surface p-2 shadow-[var(--shadow)] fade-up">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar name={name} email={email} image={image} size={40} />
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">{name || t("noName")}</p>
              <p className="truncate text-sm text-muted">{email}</p>
            </div>
          </div>
          <div className="my-1 h-px bg-line" />
          <Link role="menuitem" href={accountHref} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-[10px] px-2 py-2 text-ink hover:bg-surface-2">
            <UserRound size={16} aria-hidden /> {t("account")}
          </Link>
          <button role="menuitem" type="button" onClick={async () => { await authClient.signOut(); router.push("/"); router.refresh(); }}
            className="flex w-full items-center gap-2 rounded-[10px] px-2 py-2 text-left text-ink hover:bg-surface-2">
            <LogOut size={16} aria-hidden /> {t("signOut")}
          </button>
        </div>
      )}
    </div>
  );
}
