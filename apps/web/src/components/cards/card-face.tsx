"use client";
import { useState } from "react";
import { useLocale } from "next-intl";
import { Sprout } from "lucide-react";
import { cardView, pick } from "@/lib/tools/decks";
import { cn } from "@/components/ui/cn";

/**
 * The face of one card from any deck: a picture, or a word card drawn in our own
 * style. `fit` = "contain" shows the whole picture (a drawn card), "cover" fills
 * a tile (a grid of cards to choose from).
 */
export function CardFace({ refId, keys, fit = "contain", className, showWordQuestion = false }: {
  refId: string; keys?: Record<string, string>; fit?: "contain" | "cover"; className?: string;
  /** Inner-resources cards: also show the question (the therapist's view). */
  showWordQuestion?: boolean;
}) {
  const locale = useLocale();
  const card = cardView(refId, keys);
  const [broken, setBroken] = useState(false);
  // Fill the width unless the caller sets one.
  const width = /(^|\s)(max-)?w-/.test(className ?? "") ? "" : "w-full";
  if (!card || broken) return <span className={cn("flex aspect-[2/3] items-center justify-center rounded-inner bg-surface-2 text-muted", width, className)}>?</span>;
  if (card.kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element -- card art: static files or our own private route
    return <img src={card.src} alt={pick(card.alt, locale)} loading="lazy" draggable={false} onError={() => setBroken(true)}
      className={cn("rounded-inner bg-surface-2", fit === "cover" ? "aspect-[2/3] object-cover" : "object-contain", width, className)} />;
  }
  const word = pick(card.word, locale);
  return (
    <span role="img" aria-label={word}
      className={cn("relative flex aspect-[2/3] flex-col [container-type:inline-size] items-center justify-center gap-2 overflow-hidden rounded-inner p-[6%] text-center",
        card.tone === "words" ? "bg-[#F4EEE4] text-[#2F3A35]" : "bg-[#E6EEE9] text-[#2F3A35]", width, className)}
      style={{ backgroundImage: card.tone === "words"
        ? "radial-gradient(circle at 20% 15%, rgba(201,163,138,.28), transparent 45%), radial-gradient(circle at 85% 90%, rgba(143,169,184,.25), transparent 50%)"
        : "radial-gradient(circle at 80% 10%, rgba(107,143,123,.25), transparent 50%), radial-gradient(circle at 10% 95%, rgba(227,193,111,.25), transparent 45%)" }}>
      {card.tone === "resources" && <Sprout aria-hidden className="h-[18%] w-[18%] text-[#4A6D5B]" />}
      {/* Sized to the card and to the longest word, so words never break in the middle. */}
      <span lang={locale.startsWith("ru") ? "ru" : "en"} className="font-serif leading-tight hyphens-auto"
        style={{ fontSize: `clamp(0.6rem, calc(150cqw / ${Math.max(6, ...word.split(" ").map((w) => w.length))}), 2.2rem)` }}>{word}</span>
      {showWordQuestion && card.question && <span className="text-[clamp(0.6rem,3.6cqw,0.85rem)] leading-snug text-[#4F5B55]">{pick(card.question, locale)}</span>}
    </span>
  );
}
