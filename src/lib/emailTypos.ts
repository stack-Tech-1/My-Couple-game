/**
 * Catches common slips in email domains ("gmail.co", "gmial.com", "yahoo.con") before a sign-in
 * link is sent somewhere it can never arrive. Only suggests: the person can always keep what they typed.
 */
const COMMON = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "live.com",
  "ymail.com",
  "aol.com",
  "protonmail.com",
  "me.com",
  "msn.com",
  "googlemail.com",
  "yahoo.co.uk",
  "hotmail.co.uk",
];

/** Edit distance (with adjacent swaps counting as one), stopping early past 2. */
function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
    }
  }
  return d[a.length]![b.length]!;
}

/** "ada@gmail.co" → "ada@gmail.com". Null when it looks right, or when nothing is close enough to be sure. */
export function suggestEmail(email: string): string | null {
  const at = email.trim().lastIndexOf("@");
  if (at < 1) return null;
  const local = email.trim().slice(0, at);
  const domain = email.trim().slice(at + 1).toLowerCase();
  if (!domain || COMMON.includes(domain)) return null;
  let best: string | null = null;
  let bestD = 3;
  for (const c of COMMON) {
    const dist = distance(domain, c);
    if (dist < bestD) {
      best = c;
      bestD = dist;
    }
  }
  // Short domains need a closer match, or "me.co" would turn into almost anything.
  if (!best || bestD > (domain.length <= 6 ? 1 : 2)) return null;
  return `${local}@${best}`;
}
