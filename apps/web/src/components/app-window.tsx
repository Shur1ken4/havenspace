"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { WEBSITE_PAGES, isAppWindow } from "@/lib/app-window";

/**
 * In an app window (see lib/app-window.ts): the homepage leads into HavenSpace,
 * and links to other website pages open in the browser instead of the app.
 */
export function AppWindow() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isAppWindow() && pathname === "/") router.replace("/today");
  }, [pathname, router]);

  useEffect(() => {
    if (!isAppWindow()) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || !WEBSITE_PAGES.test(url.pathname)) return;
      e.preventDefault();
      e.stopPropagation();
      // The logo and "home" links stay in HavenSpace; the website opens in the browser.
      if (url.pathname === "/" && a.target !== "_blank") router.push("/today");
      else window.open(url.href, "_blank", "noopener");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  return null;
}
