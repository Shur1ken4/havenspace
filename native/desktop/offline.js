// Shown when HavenSpace can't be reached; goes back as soon as the connection returns.
const params = new URLSearchParams(location.search);
const target = params.get("url");
if (params.get("lang") === "ru") {
  document.documentElement.lang = "ru";
  document.getElementById("title").textContent = "Нет связи с HavenSpace";
  document.getElementById("body").textContent = "Проверьте подключение к интернету. HavenSpace переподключится сам, как только связь появится.";
  document.getElementById("retry").textContent = "Попробовать снова";
}
const retry = () => { if (target && target.startsWith("https://")) location.href = target; };
document.getElementById("retry").addEventListener("click", retry);
window.addEventListener("online", retry);
