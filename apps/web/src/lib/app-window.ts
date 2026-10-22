// HavenSpace in its own app window (ADR-20): the Mac or Windows app, the Android
// app, or HavenSpace installed from the browser. There it shows only the platform;
// the website's pages (home, pricing, privacy, legal) open in the person's browser.

/** Website pages, as opposed to the platform. */
export const WEBSITE_PAGES = /^\/(?:$|privacy(?:\/|$)|resources\/|legal\/)/;

/**
 * Runs before the page paints: marks an app window (<html data-app="1">) and
 * sends it from the homepage straight into HavenSpace. Remembered per window
 * (sessionStorage), never in a cookie, so the same person's ordinary browser
 * tabs still show the website. Once per app launch it also shows the opening
 * screen (components/app-splash.tsx): sessionStorage is fresh each time the app opens.
 */
export const APP_WINDOW_SCRIPT = `(function(){try{
var d=document.documentElement,s=sessionStorage;
var app=/Electron\\//.test(navigator.userAgent)||matchMedia("(display-mode: standalone)").matches||document.referrer.indexOf("android-app://")===0||s.getItem("hs-app")==="1";
if(!app)return;
s.setItem("hs-app","1");d.dataset.app="1";
if(location.pathname==="/"){d.style.visibility="hidden";location.replace("/today");return;}
if(!s.getItem("hs-splash")){s.setItem("hs-splash","1");d.dataset.splash="on";
var r=matchMedia("(prefers-reduced-motion: reduce)").matches;
setTimeout(function(){d.dataset.splash="out";},r?900:2300);
setTimeout(function(){delete d.dataset.splash;},r?1600:3000);}
}catch(e){}})();`;

export function isAppWindow() {
  return typeof document !== "undefined" && document.documentElement.dataset.app === "1";
}
