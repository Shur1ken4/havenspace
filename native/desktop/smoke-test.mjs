// Start-up check for the built desktop app (run by .github/workflows/apps.yml):
// it opens, shows HavenSpace's sign-in page, and the camera, microphone and
// screen sharing are available to the page. Saves a screenshot.
//   node smoke-test.mjs <path to the app's program> <screenshot.png>
import { _electron as electron } from "playwright-core";

const [exe, shotPath] = process.argv.slice(2);
const app = await electron.launch({ executablePath: exe, timeout: 90_000 });
let failed = 0;
const check = (ok, what) => { console.log(ok ? "PASS" : "FAIL", what); if (!ok) failed++; };
try {
  const win = await app.firstWindow();
  await win.waitForURL(/havenspace-app\.vercel\.app\/(login|today)/, { timeout: 90_000 });
  await win.waitForLoadState("networkidle").catch(() => {});
  check(true, `opens HavenSpace: ${win.url()}`);
  check(await win.locator("input[type=email]").first().isVisible(), "sign-in form is showing");
  const info = await win.evaluate(async () => ({
    size: [innerWidth, innerHeight],
    displayMedia: typeof navigator.mediaDevices?.getDisplayMedia === "function",
    camera: (await navigator.permissions.query({ name: "camera" })).state,
    microphone: (await navigator.permissions.query({ name: "microphone" })).state,
  }));
  console.log(JSON.stringify(info));
  check(info.size[0] >= 1000 && info.size[1] >= 600, "window opens at a comfortable size");
  check(info.displayMedia, "screen sharing is available");
  check(info.camera !== "denied" && info.microphone !== "denied", "camera and microphone aren't blocked");
  // Links to other sites must open in the person's browser, not inside the app.
  const before = win.url();
  await win.evaluate(() => { location.href = "https://example.com/"; });
  await win.waitForTimeout(2000);
  check(win.url() === before, "other sites don't open inside the app");
  await win.screenshot({ path: shotPath });
} finally {
  await app.close().catch(() => {});
}
if (failed) { console.log(`${failed} FAILED`); process.exit(1); }
console.log("ALL PASSED");
