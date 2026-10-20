"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Video } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** Client app: shows a Join button as soon as the therapist opens a video room. */
export function VideoJoinBanner({ therapist }: { therapist: string }) {
  const t = useTranslations("video");
  const [roomId, setRoomId] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    const check = async () => {
      const res = await fetch("/api/video/active", { cache: "no-store" }).catch(() => null);
      const data = res?.ok ? await res.json() : null;
      if (!stop) setRoomId(data?.roomId ?? null);
    };
    // Check now, every 15 seconds while the page is open, and on coming back to it.
    void check();
    const id = setInterval(() => { if (!document.hidden) void check(); }, 15_000);
    const onShow = () => { if (!document.hidden) void check(); };
    document.addEventListener("visibilitychange", onShow);
    return () => { stop = true; clearInterval(id); document.removeEventListener("visibilitychange", onShow); };
  }, []);

  if (!roomId) return null;
  return (
    <Card className="fade-up flex flex-col gap-4 border-primary sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong"><Video size={20} aria-hidden /></span>
        <p className="text-lg text-ink">{t("ready", { name: therapist })}</p>
      </div>
      <Link href={`/me/video/${roomId}`} className={buttonClass("primary", "lg")}>{t("joinNow")}</Link>
    </Card>
  );
}
