// How much of the AI's note the therapist changed before approving: the share of
// words that differ (0 = approved as drafted, 1 = fully rewritten). Saved as one
// number; the text itself is not kept (migration 0025).

type Sections = { sections?: { text?: string }[] } | null | undefined;

const words = (note: Sections) =>
  (note?.sections ?? []).map((s) => s.text ?? "").join(" ").toLowerCase().split(/\s+/).filter(Boolean);

export function editShare(draft: Sections, approved: Sections): number | null {
  const a = words(draft);
  const b = words(approved);
  if (!a.length) return null;
  // Words kept in order (longest common subsequence), one row at a time.
  let prev = new Array<number>(b.length + 1).fill(0);
  for (const word of a) {
    const row = [0];
    for (let j = 1; j <= b.length; j++) row[j] = word === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], row[j - 1]);
    prev = row;
  }
  const kept = prev[b.length];
  return Math.min(1, Math.max(0, 1 - (2 * kept) / (a.length + b.length)));
}
