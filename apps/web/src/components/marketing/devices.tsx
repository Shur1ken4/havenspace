"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Check, Download, Laptop, Monitor, Smartphone, TabletSmartphone } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";

type Platform = "mac" | "windows" | "iphone" | "android";
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

function detect(): Platform | null {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "iphone";
  if (/Android/i.test(ua)) return "android";
  if (/Windows/i.test(ua)) return "windows";
  if (/Macintosh|Mac OS X/i.test(ua)) return "mac";
  return null;
}
const noop = () => () => {};

/**
 * "HavenSpace on all your devices": installs the web app (it opens in its own
 * window, from the Dock, Start menu or home screen). Where the browser offers
 * one-click install we use it; otherwise we show the two or three steps.
 * Desktop and Android download files appear here once they're published.
 */
export function Devices({ downloads }: { downloads: Partial<Record<Platform, string>> }) {
  const t = useTranslations("devices");
  const mine = useSyncExternalStore(noop, detect, () => null);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [open, setOpen] = useState<Platform | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as InstallPrompt); };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  async function install(p: Platform) {
    if (prompt && p === mine && p !== "iphone") {
      await prompt.prompt();
      const choice = await prompt.userChoice.catch(() => null);
      if (choice?.outcome === "accepted") setInstalled(true);
      setPrompt(null);
      return;
    }
    setOpen(open === p ? null : p);
  }

  const tiles: { p: Platform; icon: typeof Monitor; name: string }[] = [
    { p: "mac", icon: Laptop, name: "Mac" },
    { p: "windows", icon: Monitor, name: "Windows" },
    { p: "iphone", icon: Smartphone, name: "iPhone / iPad" },
    { p: "android", icon: TabletSmartphone, name: "Android" },
  ];

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map(({ p, icon: Icon, name }) => (
        <li key={p} className={`flex flex-col gap-3 rounded-card border bg-surface p-5 ${p === mine ? "border-primary" : "border-line"}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary-strong"><Icon size={24} aria-hidden /></span>
            {p === mine && <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs text-primary-strong">{t("thisDevice")}</span>}
          </div>
          <p className="font-serif text-2xl">{name}</p>
          <p className="text-sm text-muted">{t(`${p}Line`)}</p>
          <div className="mt-auto flex flex-wrap gap-2">
            {downloads[p] && (
              <a href={downloads[p]} className={buttonClass("primary", "sm")} download><Download size={15} aria-hidden /> {t("download")}</a>
            )}
            {p === mine && installed ? (
              <span className="flex items-center gap-1.5 text-sm text-primary-strong"><Check size={16} aria-hidden /> {t("installed")}</span>
            ) : (
              <Button size="sm" variant={downloads[p] ? "ghost" : p === mine ? "primary" : "secondary"} onClick={() => install(p)} aria-expanded={open === p}>
                {p === "iphone" ? t("howTo") : t("install")}
              </Button>
            )}
          </div>
          {open === p && (
            <ol className="fade-up list-decimal space-y-1 pl-5 text-sm text-ink">
              {[1, 2, 3].map((n) => t.has(`${p}Step${n}`) && <li key={n}>{t(`${p}Step${n}`)}</li>)}
            </ol>
          )}
        </li>
      ))}
    </ul>
  );
}
