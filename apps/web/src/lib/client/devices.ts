// The microphone and camera each person chose, remembered on this device only.
// Used by the recorder, the voice check, dictation and video calls.

export type DeviceKind = "audioinput" | "videoinput";

const KEYS: Record<DeviceKind, string> = { audioinput: "hs-microphone", videoinput: "hs-camera" };

export function savedDevice(kind: DeviceKind): string | undefined {
  try { return localStorage.getItem(KEYS[kind]) || undefined; } catch { return undefined; }
}

export function saveDevice(kind: DeviceKind, deviceId: string) {
  try {
    if (deviceId && deviceId !== "default") localStorage.setItem(KEYS[kind], deviceId);
    else localStorage.removeItem(KEYS[kind]);
  } catch { /* private window: the choice lasts for this page only */ }
}

/** Audio settings with the chosen microphone. "ideal" so an unplugged mic falls back to the default instead of failing. */
export function micConstraints(base: MediaTrackConstraints = {}): MediaTrackConstraints {
  const id = savedDevice("audioinput");
  return id ? { ...base, deviceId: { ideal: id } } : base;
}

/** Opens the chosen microphone (or the default one). */
export function openMic(base: MediaTrackConstraints = {}): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio: micConstraints(base) });
}
