/** Five calm faces for the mood diary (1 = very low … 5 = very good).
 *  Soft colours only; a low mood is never shown as an alarm. CLINICAL-REVIEW: the scale. */
const MOUTH = ["M11 22 q5 -5 10 0", "M11 21.5 q5 -2.5 10 0", "M11 21 h10", "M11 20 q5 3 10 0", "M10.5 19.5 q5.5 5 11 0"];
const FILL = ["var(--calm-blue-soft)", "var(--calm-blue-soft)", "var(--surface-2)", "var(--primary-soft)", "var(--primary-soft)"];

export function MoodFace({ mood, className }: { mood: number; className?: string }) {
  const i = Math.min(5, Math.max(1, Math.round(mood))) - 1;
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="14.5" fill={FILL[i]} stroke="var(--border)" />
      <circle cx="11.5" cy="13" r="1.6" fill="var(--ink)" />
      <circle cx="20.5" cy="13" r="1.6" fill="var(--ink)" />
      <path d={MOUTH[i]} fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
