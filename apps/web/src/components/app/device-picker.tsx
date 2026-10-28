"use client";
import { useCallback, useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Mic, Video } from "lucide-react";
import { Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { saveDevice, savedDevice, type DeviceKind } from "@/lib/client/devices";

/** Choose a microphone or camera, e.g. an external mic in the middle of the table.
 *  Browsers only name devices after access is allowed, so until then we offer a button. */
export function DevicePicker({ kind, onChange }: { kind: DeviceKind; onChange?: (deviceId: string) => void }) {
  const t = useTranslations("mediaDevices");
  const id = useId();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [chosen, setChosen] = useState("");
  const [asked, setAsked] = useState(false);

  const load = useCallback(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return Promise.resolve();
    return navigator.mediaDevices.enumerateDevices().then((list) => {
      const all = list.filter((d) => d.kind === kind);
      setDevices(all);
      const saved = savedDevice(kind);
      setChosen(saved && all.some((d) => d.deviceId === saved) ? saved : all[0]?.deviceId ?? "");
    });
  }, [kind]);

  useEffect(() => {
    // A mic plugged in or out while this screen is open shows up straight away.
    navigator.mediaDevices?.enumerateDevices?.().then(() => load());
    navigator.mediaDevices?.addEventListener?.("devicechange", load);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", load);
  }, [load]);

  async function allow() {
    setAsked(true);
    try {
      const s = await navigator.mediaDevices.getUserMedia(kind === "audioinput" ? { audio: true } : { video: true });
      s.getTracks().forEach((x) => x.stop());
    } catch { /* the recorder shows its own message if access stays blocked */ }
    await load();
  }

  function choose(deviceId: string) {
    setChosen(deviceId);
    saveDevice(kind, deviceId);
    onChange?.(deviceId);
  }

  const Icon = kind === "audioinput" ? Mic : Video;
  const label = kind === "audioinput" ? t("microphone") : t("camera");
  const named = devices.some((d) => d.label);

  if (!named) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <Icon size={16} aria-hidden />
        <span>{label}: {t("default")}</span>
        {!asked && <Button variant="ghost" size="sm" onClick={allow}>{kind === "audioinput" ? t("chooseMic") : t("chooseCamera")}</Button>}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium text-ink"><Icon size={16} aria-hidden /> {label}</label>
      <Select id={id} value={chosen} onChange={(e) => choose(e.target.value)}>
        {devices.map((d, i) => (
          <option key={d.deviceId || i} value={d.deviceId}>{d.label || `${label} ${i + 1}`}</option>
        ))}
      </Select>
    </div>
  );
}
