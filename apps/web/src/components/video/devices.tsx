"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Settings2 } from "lucide-react";
import { useMediaDeviceSelect } from "@livekit/components-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { saveDevice, type DeviceKind } from "@/lib/client/devices";

function DeviceSelect({ kind, label }: { kind: DeviceKind; label: string }) {
  const id = useId();
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({ kind });
  if (devices.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">{label}</label>
      <Select id={id} value={activeDeviceId} onChange={(e) => {
        saveDevice(kind, e.target.value);
        void setActiveMediaDevice(e.target.value);
      }}>
        {devices.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `${label} ${i + 1}`}</option>)}
      </Select>
    </div>
  );
}

/** In the call: switch microphone or camera without leaving. */
export function DeviceButton() {
  const t = useTranslations("mediaDevices");
  const [shown, setShown] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!shown) return;
    const away = (e: Event) => { if (!box.current?.contains(e.target as Node)) setShown(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setShown(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [shown]);

  return (
    <div ref={box} className="relative">
      <Button variant="secondary" onClick={() => setShown(!shown)} aria-expanded={shown} aria-haspopup="true">
        <Settings2 size={18} aria-hidden /> <span className="sr-only sm:not-sr-only">{t("title")}</span>
      </Button>
      {shown && (
        <div role="group" aria-label={t("title")}
          className="fade-up absolute bottom-full left-1/2 z-30 mb-2 w-[min(92vw,340px)] -translate-x-1/2 space-y-3 rounded-card border border-line bg-surface p-3 shadow-[var(--shadow)]">
          <DeviceSelect kind="audioinput" label={t("microphone")} />
          <DeviceSelect kind="videoinput" label={t("camera")} />
        </div>
      )}
    </div>
  );
}
