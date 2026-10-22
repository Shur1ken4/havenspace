// Which of our languages to show, from the device's language list (the Accept-Language header).
export function pickLanguage(header: string | null): "en" | "ru" {
  const tags = (header ?? "").split(",").map((part, i) => {
    const [tag, ...params] = part.trim().split(";");
    const q = Number(params.find((p) => p.trim().startsWith("q="))?.trim().slice(2) ?? 1);
    return { lang: tag.split("-")[0].toLowerCase(), q: Number.isFinite(q) ? q : 0, i };
  }).filter((t) => t.lang && t.q > 0).sort((a, b) => b.q - a.q || a.i - b.i);
  const first = tags.find((t) => t.lang === "en" || t.lang === "ru");
  return first?.lang === "ru" ? "ru" : "en";
}
