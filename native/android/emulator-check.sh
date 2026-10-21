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
  if ! echo "$top" | grep -q "com.android.chrome/.*CustomTabActivity"; then
    echo "PROBLEM $1: HavenSpace wasn't the app in front" >> "$SUMMARY"
    problems=$((problems + 1))
  fi
}

dims() { file "$1" | grep -oE '[0-9]+ x [0-9]+' | tr -d ' '; }

# A quarter turn. Tablets follow the rotation setting; phones may ignore it, so
# then the virtual phone itself is turned, as a person would, with auto-rotate on.
EMU_TURNED=0
turn() {
  adb shell settings put system accelerometer_rotation 0
  adb shell settings put system user_rotation 1
  adb shell wm user-rotation lock 1 > /dev/null 2>&1 || true
  sleep 4
  adb exec-out screencap -p > "$OUT/.probe.png"
  if [ "$(dims "$OUT/.probe.png")" = "${W}x${H}" ]; then
    adb shell wm user-rotation free > /dev/null 2>&1 || true
    adb shell settings put system accelerometer_rotation 1
    adb emu rotate
    EMU_TURNED=1
    sleep 6
  fi
  rm -f "$OUT/.probe.png"
}
turn_back() {
  if [ "$EMU_TURNED" = 1 ]; then adb emu rotate; adb emu rotate; adb emu rotate; fi
  adb shell wm user-rotation lock 0 > /dev/null 2>&1 || true
  adb shell settings put system user_rotation 0
  sleep 3
}

# The page must show one of the words in $2 and none in $3 (from the screen's text).
expect_text() {
  local xml
  xml=$(ui)
  if ! echo "$xml" | grep -qE "(text|content-desc)=\"[^\"]*($2)"; then
    echo "PROBLEM $1: expected to see $2" >> "$SUMMARY"; problems=$((problems + 1))
  fi
  if [ -n "${3:-}" ] && echo "$xml" | grep -qE "(text|content-desc)=\"[^\"]*($3)"; then
    echo "PROBLEM $1: shouldn't show $3 in the app" >> "$SUMMARY"; problems=$((problems + 1))
  fi
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

START=$(dims "$OUT/01-open.png")
W=${START%x*}; H=${START#*x}
echo "upright: ${W}x${H}" >> "$SUMMARY"

# HavenSpace shows only the platform in the app: even the homepage address leads to sign-in.
open_page "/" 02-homepage-address
expect_text 02-homepage-address "Sign in|Войти" "Be with your client|Будьте с клиентом"
open_page "/signup" 03-signup
open_page "/join" 04-join-code
open_page "/v/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" 05-video-link
open_page "/privacy" 06-privacy
expect_text 06-privacy "Back to HavenSpace|Вернуться в HavenSpace" "Get started|Начать"

# Dark mode
adb shell cmd uimode night yes
sleep 3
open_page "/login" 07-login-dark
open_page "/signup" 08-signup-dark
adb shell cmd uimode night no

# Turned a quarter: landscape on phones, portrait on tablets.
turn
# Did the device itself turn? (Android's Settings app always follows.)
adb shell am start -a android.settings.SETTINGS > /dev/null
sleep 4
adb exec-out screencap -p > "$OUT/09-settings-turned.png"
DEVICE=$(dims "$OUT/09-settings-turned.png")
echo "device turned (Settings app): $DEVICE" >> "$SUMMARY"
open_page "/login" 10-login-turned
open_page "/signup" 11-signup-turned
open_page "/join" 12-join-turned
TURNED=$(dims "$OUT/10-login-turned.png")
echo "app turned: $TURNED" >> "$SUMMARY"
if [ "$DEVICE" = "${W}x${H}" ]; then
  echo "NOTE: this virtual device couldn't be turned, so the turned layout wasn't checked here" >> "$SUMMARY"
elif [ "$TURNED" != "$DEVICE" ]; then
  echo "PROBLEM: the device turned but HavenSpace stayed upright ($TURNED)" >> "$SUMMARY"
  problems=$((problems + 1))
fi
turn_back

# Any crash while testing?
adb logcat -d -b crash > "$OUT/crashes.txt" 2>/dev/null || true
if grep -qE "app.havenspace|com.android.chrome" "$OUT/crashes.txt"; then
  echo "PROBLEM: a crash was logged (crashes.txt)" >> "$SUMMARY"
  problems=$((problems + 1))
fi

echo "problems: $problems" >> "$SUMMARY"
cat "$SUMMARY"
[ "$problems" -eq 0 ]
