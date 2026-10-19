/** Round profile photo, or the person's initials on a soft background. */
export function Avatar({ name, email, image, size = 36 }: { name?: string | null; email?: string | null; image?: string | null; size?: number }) {
  const source = (name || email || "?").trim();
  const initials = source.includes("@") ? source[0] : source.split(/\s+/).slice(0, 2).map((w) => w[0]).join("");
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element -- a tiny inline data: photo, nothing to optimise
    <img src={image} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden className="flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-medium uppercase text-ink"
      style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {initials}
    </span>
  );
}
