// Tab-audio capture works in Chromium browsers (Chrome, Edge) on desktop.
export function canCaptureTabAudio(): boolean {
  if (typeof navigator === "undefined") return true;
  if (!navigator.mediaDevices?.getDisplayMedia) return false;
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|Mobile/i.test(ua)) return false;
  const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands ?? [];
  const chromium = brands.some((b) => /Chromium|Google Chrome|Microsoft Edge/.test(b.brand)) || /Chrome\/|Edg\//.test(ua);
  return chromium && !/Firefox\//.test(ua);
}

export const isMac = () => typeof navigator !== "undefined" && /Mac OS X|Macintosh/.test(navigator.userAgent);
