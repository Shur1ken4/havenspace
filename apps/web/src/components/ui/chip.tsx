import type { HTMLAttributes } from "react";
import { cn } from "./cn";

type Tone = "sage" | "clay" | "blue" | "amber" | "plain";
const tones: Record<Tone, string> = {
  sage: "bg-primary-soft text-primary-strong",
  clay: "bg-accent-soft text-ink",
  blue: "bg-calm-blue-soft text-ink",
  amber: "bg-attention-soft text-ink",
  plain: "bg-surface-2 text-muted",
};

export function Chip({ tone = "sage", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm leading-none", tones[tone], className)}
      {...props}
    />
  );
}
