// Downloadable apps for Mac, Windows and Android (ADR-20), built, checked and
// published as a GitHub release by .github/workflows/apps.yml. "latest" always
// points at the newest release, so these links never need changing.
export const APPS_PUBLISHED = false;

const RELEASE = "https://github.com/Shur1ken4/havenspace/releases/latest/download";

export const appDownloads: Partial<Record<"mac" | "windows" | "android", string>> = APPS_PUBLISHED
  ? { mac: `${RELEASE}/HavenSpace-Mac.dmg`, windows: `${RELEASE}/HavenSpace-Windows-Setup.exe`, android: `${RELEASE}/HavenSpace-Android.apk` }
  : {};
