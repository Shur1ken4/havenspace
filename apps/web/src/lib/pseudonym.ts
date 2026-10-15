// Clients must be added by a code or initials. This catches the most common
// slip — typing a real "Firstname Lastname" — without being clever.
export function looksLikeFullName(value: string): boolean {
  const v = value.trim();
  if (/\d/.test(v)) return false;
  const words = v.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  const nameLike = words.filter((w) => /^\p{Lu}[\p{Ll}'’-]{2,}$/u.test(w));
  const generic = /^(client|patient|person|couple|family|group|mr|ms|mrs|dr|клиент|клиентка|пациент|пара|семья|группа)$/iu;
  return nameLike.length >= 2 && !words.some((w) => generic.test(w));
}
