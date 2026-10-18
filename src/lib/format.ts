const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86_400],
  ["month", 30 * 86_400],
  ["week", 7 * 86_400],
  ["day", 86_400],
  ["hour", 3600],
  ["minute", 60],
];
const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" });

export function timeAgo(iso: string | Date | null | undefined, now = Date.now()): string {
  if (!iso) return "never";
  const secs = Math.round((new Date(iso).getTime() - now) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(secs) >= size) return rtf.format(Math.round(secs / size), unit);
  }
  return "just now";
}

export function shortDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dubai" });
}

export function compact(n: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const TZ = "Asia/Dubai";
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });

/** "Today", "Yesterday", "Thu 15 Oct", or "Thu 15 Oct 2025" outside the current year. */
export function dayLabel(iso: string | Date, now = new Date()): string {
  const d = new Date(iso);
  const key = dayKey(d);
  if (key === dayKey(now)) return "Today";
  if (key === dayKey(new Date(now.getTime() - 86_400_000))) return "Yesterday";
  const sameYear = key.slice(0, 4) === dayKey(now).slice(0, 4);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: TZ,
  });
}
