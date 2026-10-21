#!/usr/bin/env bash
# Android check on a virtual phone (run by .github/workflows/apps.yml):
# installs the app, opens HavenSpace's main pages and saves screenshots in light,
# dark and landscape, plus a summary. Fails if the app shows Chrome's address bar
# (that would mean the site's assetlinks.json doesn't match the app's signature).
set -u
APK="$1"
OUT="$2"
SITE="https://havenspace-app.vercel.app"
PKG="app.havenspace"
mkdir -p "$OUT"
SUMMARY="$OUT/summary.txt"
problems=0

ui() { adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1; adb exec-out cat /sdcard/ui.xml; }

# Taps the first element whose text contains $1 (Chrome's welcome and permission screens).
tap_text() {
  local b x1 y1 x2 y2
  b=$(ui | grep -oE "text=\"[^\"]*$1[^\"]*\"[^>]*bounds=\"\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]\"" | head -1 | grep -oE '\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]')
  [ -z "$b" ] && return 1
  read -r x1 y1 x2 y2 <<< "$(echo "$b" | tr -c '0-9' ' ')"
  adb shell input tap $(((x1 + x2) / 2)) $(((y1 + y2) / 2))
  sleep 3
}

clear_prompts() {
  for t in "Accept" "No thanks" "Use without an account" "Got it" "Don.t allow"; do tap_text "$t" || true; done
}

shot() {
  sleep "${2:-8}"
  [ "${3:-}" = "first" ] && clear_prompts
  adb exec-out screencap -p > "$OUT/$1.png"
  local xml
  xml=$(ui)
  if echo "$xml" | grep -q 'resource-id="com.android.chrome:id/url_bar"\|resource-id="com.android.chrome:id/title_bar"'; then
    echo "PROBLEM $1: Chrome's address bar is showing (app not verified)" >> "$SUMMARY"
    problems=$((problems + 1))
  fi
  local top
  top=$(adb shell dumpsys activity activities | grep -m1 -E "topResumedActivity|mResumedActivity" | tr -s ' ')
  echo "$1: $top" >> "$SUMMARY"
}

open_page() {
  adb shell am start -a android.intent.action.VIEW -d "$SITE$1" "$PKG" > /dev/null
  shot "$2" "${3:-8}"
}

{
  echo "screen: $(adb shell wm size | tr -d '\r') $(adb shell wm density | tr -d '\r')"
  echo "android: $(adb shell getprop ro.build.version.release | tr -d '\r')"
  echo "chrome: $(adb shell dumpsys package com.android.chrome | grep -m1 versionName | tr -d ' \r')"
} >> "$SUMMARY"

# A fresh test phone: skip Chrome's welcome screens, as on a phone that's been set up.
adb shell am set-debug-app --persistent com.android.chrome
adb shell 'echo "_ --disable-fre --no-default-browser-check --no-first-run" > /data/local/tmp/chrome-command-line'
adb shell am force-stop com.android.chrome

adb install -r "$APK" || { echo "PROBLEM: install failed" >> "$SUMMARY"; exit 1; }
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1
shot 01-open 20 first

open_page "/" 02-home
adb shell input swipe 500 1600 500 400 400
shot 03-home-scrolled 3
open_page "/#devices" 04-home-devices
open_page "/login" 05-login
open_page "/signup" 06-signup
open_page "/join" 07-join-code
open_page "/v/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" 08-video-link
open_page "/privacy" 09-privacy

# Dark mode
adb shell cmd uimode night yes
open_page "/login" 10-login-dark
open_page "/" 11-home-dark
adb shell cmd uimode night no

# Landscape
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 1
open_page "/login" 12-login-landscape
open_page "/" 13-home-landscape
adb shell settings put system user_rotation 0

echo "problems: $problems" >> "$SUMMARY"
cat "$SUMMARY"
[ "$problems" -eq 0 ]
