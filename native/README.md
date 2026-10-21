# HavenSpace apps for Mac, Windows and Android

These folders make the downloadable apps (ADR-20). Both open the live HavenSpace website,
so new features reach them without a new download.

- `desktop/`: the Mac and Windows app (Electron). `main.js` opens HavenSpace and handles
  the camera, microphone and screen-sharing permissions; `picker.*` is the "Share your screen"
  window; `offline.*` is shown when there's no internet.
- `android/`: the Android app settings (`twa-manifest.json`, built with Google's Bubblewrap).

The apps are built on GitHub's computers, not on your Mac (ADR-20, `.github/workflows/apps.yml`). These folders are kept apart from
the website's `apps/` so the website build doesn't download the desktop tools.

Checks: every build starts the Mac and Windows apps (`desktop/smoke-test.mjs`) and installs the
Android app on a virtual small phone, phone and tablet (`android/emulator-check.sh`, run by
`.github/workflows/android-check.yml`). Screenshots are under each run's artifacts on GitHub.
