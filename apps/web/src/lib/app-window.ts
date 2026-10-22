// HavenSpace in its own app window (ADR-20): the Mac or Windows app, the Android
// app, or HavenSpace installed from the browser. There it shows only the platform;
// the website's pages (home, pricing, privacy, legal) open in the person's browser.

/** Website pages, as opposed to the platform. */
export const WEBSITE_PAGES = /^\/(?:$|privacy(?:\/|$)|resources\/|legal\/)/;

/**
 * Runs before the page paints: marks an app window (<html data-app="1">) and
 * sends it from the homepage straight into HavenSpace. Remembered per window
 * (sessionStorage), never in a cookie, so the same person's ordinary browser
 * tabs still show the website. Each time the app opens (a fresh load, not one
 * that follows leaving another of our pages a moment ago; our pages send no
 * referrer, so that's remembered on "pagehide") it shows the opening screen (components/app-splash.tsx)
 * as the loading page: at least ~2.3 s, and until the page has finished loading.
 */
export const APP_WINDOW_SCRIPT = `(function(){try{
var d=document.documentElement,s=sessionStorage;
var app=/Electron\\//.test(navigator.userAgent)||matchMedia("(display-mode: standalone)").matches||document.referrer.indexOf("android-app://")===0||s.getItem("hs-app")==="1";
if(!app)return;
s.setItem("hs-app","1");d.dataset.app="1";
var nav=performance.getEntriesByType&&performance.getEntriesByType("navigation")[0];
var inside=Date.now()-Number(s.getItem("hs-left")||0)<10000;
addEventListener("pagehide",function(){try{s.setItem("hs-left",String(Date.now()));}catch(e){}});
var opened=s.getItem("hs-splash-next")==="1"||((!nav||nav.type==="navigate")&&!inside);
s.removeItem("hs-splash-next");
if(location.pathname==="/"){if(opened)s.setItem("hs-splash-next","1");d.style.visibility="hidden";location.replace("/today");return;}
if(!opened)return;
d.dataset.splash="on";
var r=matchMedia("(prefers-reduced-motion: reduce)").matches,t0=Date.now();
function done(){setTimeout(function(){d.dataset.splash="out";setTimeout(function(){delete d.dataset.splash;},700);},Math.max(0,(r?900:2300)-(Date.now()-t0)));}
if(document.readyState==="complete")done();else addEventListener("load",done);
}catch(e){}})();`;

export function isAppWindow() {
  return typeof document !== "undefined" && document.documentElement.dataset.app === "1";
}
