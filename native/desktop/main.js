// HavenSpace for Mac and Windows (ADR-20).
// A window onto the live HavenSpace web app, on Chrome's engine, so calls, camera,
// recording and screen sharing behave exactly as in Chrome. The app stores no
// session data of its own; everything stays on HavenSpace's EU servers.
const { app, BrowserWindow, Menu, desktopCapturer, ipcMain, session, shell, systemPreferences } = require("electron");
const path = require("node:path");

const APP_URL = (!app.isPackaged && process.env.HAVENSPACE_URL) || "https://havenspace-app.vercel.app";
const ORIGIN = new URL(APP_URL).origin;
const BG = "#FAF8F5";

const isOurs = (url) => { try { return new URL(url).origin === ORIGIN; } catch { return false; } };
// The app shows only the platform; the website's pages open in the person's browser.
const WEBSITE_PAGES = /^\/(?:$|privacy(?:\/|$)|resources\/|legal\/)/;
const isWebsitePage = (url) => { try { return WEBSITE_PAGES.test(new URL(url).pathname); } catch { return false; } };
const russian = () => /^(ru|uk)/.test(app.getLocale());

// Links to anywhere else open in the person's own browser (web and email only).
function openOutside(url) {
  try {
    const u = new URL(url);
    if (["https:", "http:", "mailto:"].includes(u.protocol)) void shell.openExternal(u.href);
  } catch { /* not a link */ }
}

if (!app.requestSingleInstanceLock()) app.quit();

let main = null;

function createWindow() {
  main = new BrowserWindow({
    width: 1280, height: 860, minWidth: 380, minHeight: 560,
    title: "HavenSpace", backgroundColor: BG, show: false, autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: true },
  });
  main.once("ready-to-show", () => main.show());
  main.webContents.on("did-fail-load", (_e, code, _desc, _url, isMainFrame) => {
    // -3 is "aborted" (e.g. a redirect), not a real failure.
    if (isMainFrame && code !== -3) {
      void main.loadFile(path.join(__dirname, "offline.html"), { query: { lang: russian() ? "ru" : "en", url: `${ORIGIN}/today` } });
    }
  });
  main.on("closed", () => { main = null; });
  void main.loadURL(`${ORIGIN}/today`);
}

// Every page in the app: stay on the platform, send the website and other sites to the browser.
app.on("web-contents-created", (_e, contents) => {
  const leave = (e, url) => {
    if (isOurs(url) && !isWebsitePage(url)) return;
    e.preventDefault();
    if (isOurs(url) && new URL(url).pathname === "/") void contents.loadURL(`${ORIGIN}/today`);
    else openOutside(url);
  };
  contents.on("will-navigate", leave);
  contents.on("will-redirect", leave);
  contents.setWindowOpenHandler(({ url }) => {
    if (isOurs(url) && !isWebsitePage(url)) return { action: "allow", overrideBrowserWindowOptions: { autoHideMenuBar: true, backgroundColor: BG } };
    openOutside(url);
    return { action: "deny" };
  });
});

// ── Permissions: only HavenSpace may use the camera, microphone and screen ──
const ALLOWED = new Set(["media", "display-capture", "clipboard-sanitized-write", "fullscreen"]);

function setUpPermissions() {
  const ses = session.defaultSession;
  ses.setPermissionCheckHandler((_wc, permission, origin) => isOurs(origin) && ALLOWED.has(permission));
  ses.setPermissionRequestHandler(async (_wc, permission, callback, details) => {
    if (!isOurs(details.requestingUrl) || !ALLOWED.has(permission)) return callback(false);
    if (permission === "media" && process.platform === "darwin") {
      // macOS asks once per app ("HavenSpace would like to access the camera").
      for (const type of details.mediaTypes ?? []) {
        const kind = type === "video" ? "camera" : "microphone";
        if (systemPreferences.getMediaAccessStatus(kind) !== "granted" && !(await systemPreferences.askForMediaAccess(kind))) return callback(false);
      }
    }
    callback(true);
  });
  // Screen sharing, like Zoom or Teams: on macOS 15+ the system's own picker
  // (screens, windows, apps); elsewhere our picker with the same choices.
  ses.setDisplayMediaRequestHandler((request, callback) => {
    if (!isOurs(request.securityOrigin)) return callback(null);
    pickSource().then((source) => callback(source ? { video: source } : null), () => callback(null));
  }, { useSystemPicker: true });
}

// ── Screen picker ─────────────────────────────────────────────────────────
let picking = null; // { window, sources, data, resolve }

ipcMain.handle("picker:data", (e) => (picking && e.sender === picking.window.webContents ? picking.data : null));
ipcMain.on("picker:choose", (e, id) => {
  if (picking && e.sender === picking.window.webContents) finishPicking(typeof id === "string" ? id : null);
});

function finishPicking(id) {
  if (!picking) return;
  const { window, sources, resolve } = picking;
  picking = null;
  resolve(id ? sources.find((s) => s.id === id) ?? null : null);
  if (!window.isDestroyed()) window.close();
}

async function pickSource() {
  if (picking) return null; // one picker at a time
  const sources = await desktopCapturer.getSources({ types: ["screen", "window"], thumbnailSize: { width: 400, height: 250 }, fetchWindowIcons: true });
  // HavenSpace's own windows are left out, as in the browser.
  const own = new Set(BrowserWindow.getAllWindows().map((w) => w.getMediaSourceId()));
  const list = sources.filter((s) => !own.has(s.id)).map((s) => ({
    id: s.id,
    name: s.name,
    kind: s.id.startsWith("screen:") ? "screen" : "window",
    thumb: s.thumbnail && !s.thumbnail.isEmpty() ? s.thumbnail.toDataURL() : null,
    icon: s.appIcon && !s.appIcon.isEmpty() ? s.appIcon.toDataURL() : null,
  }));
  const blocked = process.platform === "darwin" && systemPreferences.getMediaAccessStatus("screen") === "denied";
  const window = new BrowserWindow({
    parent: main ?? undefined, modal: process.platform !== "darwin", width: 820, height: 600, minWidth: 480, minHeight: 400,
    title: russian() ? "Показать экран" : "Share your screen", backgroundColor: BG, show: false, autoHideMenuBar: true,
    minimizable: false, maximizable: false, fullscreenable: false,
    webPreferences: { preload: path.join(__dirname, "picker-preload.js"), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  return new Promise((resolve) => {
    picking = { window, sources, resolve, data: { lang: russian() ? "ru" : "en", platform: process.platform, blocked, list } };
    window.once("ready-to-show", () => window.show());
    window.on("closed", () => { if (picking?.window === window) finishPicking(null); });
    void window.loadFile(path.join(__dirname, "picker.html"));
  });
}

// ── Menu: the usual shortcuts (copy, paste, zoom, full screen) ──────────────
function setUpMenu() {
  const mac = process.platform === "darwin";
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(mac ? [{ role: "appMenu" }] : [{ role: "fileMenu" }]),
    { role: "editMenu" },
    { label: russian() ? "Вид" : "View", submenu: [
      { role: "reload" }, { type: "separator" },
      { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { type: "separator" },
      { role: "togglefullscreen" },
    ] },
    { role: "windowMenu" },
    { role: "help", submenu: [{ label: russian() ? "Сайт HavenSpace" : "HavenSpace website", click: () => openOutside(ORIGIN) }] },
  ]));
}

app.on("second-instance", () => {
  if (!main) return createWindow();
  if (main.isMinimized()) main.restore();
  main.focus();
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });

app.whenReady().then(() => {
  setUpPermissions();
  setUpMenu();
  createWindow();
});
