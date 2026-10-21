// Screen picker for the desktop app (Windows, and macOS before 15): the whole
// screen or any app window, as in Zoom or Teams.
const TEXT = {
  en: {
    title: "Share your screen", hint: "Only what you pick is shown to the other person. You can stop at any time.",
    screens: "Entire screen", windows: "App windows", noWindows: "No other windows are open.",
    cancel: "Cancel", share: "Share",
    blocked: "Your Mac is blocking screen sharing for HavenSpace. Open System Settings → Privacy & Security → Screen & System Audio Recording, switch on HavenSpace, then reopen the app.",
  },
  ru: {
    title: "Показать экран", hint: "Собеседник увидит только то, что вы выберете. Остановить показ можно в любой момент.",
    screens: "Весь экран", windows: "Окна приложений", noWindows: "Других открытых окон нет.",
    cancel: "Отмена", share: "Показать",
    blocked: "Mac не разрешает HavenSpace показывать экран. Откройте Системные настройки → Конфиденциальность и безопасность → Запись экрана и системного звука, включите HavenSpace и откройте приложение заново.",
  },
};

const $ = (id) => document.getElementById(id);
let chosen = null;

function card(source, onPick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "source";
  b.setAttribute("aria-pressed", "false");
  b.dataset.id = source.id;
  const img = document.createElement("img");
  img.className = "thumb";
  img.alt = "";
  if (source.thumb) img.src = source.thumb;
  const name = document.createElement("span");
  name.className = "name";
  if (source.icon) { const i = document.createElement("img"); i.src = source.icon; i.alt = ""; name.append(i); }
  const label = document.createElement("span");
  label.textContent = source.name; // window titles come from other apps: text only
  name.append(label);
  b.append(img, name);
  b.addEventListener("click", () => onPick(source.id));
  b.addEventListener("dblclick", () => { onPick(source.id); window.picker.choose(source.id); });
  return b;
}

async function start() {
  const data = await window.picker.data();
  if (!data) return;
  const t = TEXT[data.lang] ?? TEXT.en;
  document.documentElement.lang = data.lang;
  $("title").textContent = t.title;
  $("hint").textContent = t.hint;
  $("screensTitle").textContent = t.screens;
  $("windowsTitle").textContent = t.windows;
  $("screens").setAttribute("aria-label", t.screens);
  $("windows").setAttribute("aria-label", t.windows);
  $("cancel").textContent = t.cancel;
  $("share").textContent = t.share;
  if (data.blocked) { $("blocked").textContent = t.blocked; $("blocked").hidden = false; }

  const pick = (id) => {
    chosen = id;
    document.querySelectorAll(".source").forEach((el) => el.setAttribute("aria-pressed", String(el.dataset.id === id)));
    $("share").disabled = false;
  };
  const screens = data.list.filter((s) => s.kind === "screen");
  const windows = data.list.filter((s) => s.kind === "window");
  screens.forEach((s, i) => $("screens").append(card({ ...s, name: screens.length > 1 ? `${t.screens} ${i + 1}` : t.screens }, pick)));
  windows.forEach((s) => $("windows").append(card(s, pick)));
  if (!windows.length) { const p = document.createElement("p"); p.textContent = t.noWindows; p.style.color = "var(--muted)"; $("windows").append(p); }
  if (screens.length === 1) pick(screens[0].id); // like Zoom: the screen is ready to share
  document.querySelector(".source")?.focus();
}

$("cancel").addEventListener("click", () => window.picker.choose(null));
$("share").addEventListener("click", () => { if (chosen) window.picker.choose(chosen); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") window.picker.choose(null);
  if (e.key !== "Enter") return;
  // Enter on a card shares that card; the Share and Cancel buttons handle Enter themselves.
  if (e.target instanceof HTMLElement && e.target.classList.contains("source")) { e.preventDefault(); window.picker.choose(e.target.dataset.id); }
  else if (e.target === document.body && chosen) window.picker.choose(chosen);
});
start();
