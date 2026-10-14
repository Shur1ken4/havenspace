import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

const control =
  "w-full rounded-[12px] border border-line bg-surface px-4 text-ink placeholder:text-muted/70 " +
  "focus:border-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props }, ref) {
  return <input ref={ref} className={cn(control, "h-11", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props }, ref) {
  return <textarea ref={ref} className={cn(control, "py-3 min-h-28 leading-relaxed", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, ...props }, ref) {
  return <select ref={ref} className={cn(control, "h-11 appearance-auto", className)} {...props} />;
});

export function Field({ label, hint, htmlFor, children, error }: {
  label: ReactNode; hint?: ReactNode; htmlFor: string; children: ReactNode; error?: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[15px] font-medium text-ink">{label}</label>
      {children}
      {hint && !error && <p className="text-sm text-muted">{hint}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
