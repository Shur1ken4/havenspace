import type { ReactNode } from "react";
import { cn } from "./cn";

// Calm, never alarming. "attention" is muted amber, not red.
export function Notice({ tone = "info", title, children, className }: {
  tone?: "info" | "attention" | "success"; title?: ReactNode; children?: ReactNode; className?: string;
}) {
  const styles = {
    info: "bg-calm-blue-soft border-calm-blue/40",
    attention: "bg-attention-soft border-attention/40",
    success: "bg-primary-soft border-primary/40",
  }[tone];
  return (
    <div role={tone === "attention" ? "status" : undefined} className={cn("rounded-card border px-5 py-4", styles, className)}>
      {title && <p className="font-medium text-ink">{title}</p>}
      {children && <div className="text-ui text-ink/90">{children}</div>}
    </div>
  );
}
