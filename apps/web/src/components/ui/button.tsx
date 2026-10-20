import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "md" | "lg" | "sm";

const variants: Record<Variant, string> = {
  primary: "bg-primary-strong text-on-primary hover:bg-primary shadow-soft",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2",
  ghost: "text-primary-strong hover:bg-primary-soft",
  destructive: "bg-surface text-destructive border border-destructive/40 hover:bg-destructive hover:text-on-primary",
};
const sizes: Record<Size, string> = {
  // min-height, not height: a long label (often in Russian) may wrap on a narrow phone.
  sm: "min-h-9 px-3.5 py-1.5 text-sm",
  md: "min-h-11 px-5 py-2 text-ui",
  lg: "min-h-14 px-7 py-3 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex max-w-full items-center justify-center gap-2 rounded-control text-center font-medium leading-snug",
    "disabled:opacity-50 disabled:pointer-events-none",
    variants[variant],
    sizes[size],
    className,
  );
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }
>(function Button({ variant, size, className, ...props }, ref) {
  return <button ref={ref} className={buttonClass(variant, size, className)} {...props} />;
});
