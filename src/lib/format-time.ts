/** Format an ISO timestamp as a YouTube-style relative time, e.g. "3 days ago". */
export function timeAgo(iso: string | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.max(1, Math.floor((Date.now() - then) / 1000));

  const units: Array<[label: string, sec: number]> = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
  ];
  for (const [label, sec] of units) {
    const value = Math.floor(diffSec / sec);
    if (value >= 1) return `${value} ${label}${value === 1 ? "" : "s"} ago`;
  }
  return "just now";
}

/** Format an ISO timestamp as a full readable date, e.g. "Jul 19, 2026". */
export function formatFullDate(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Parse a publication date that may arrive as:
 *   - YYYYMMDD (yt-dlp's `upload_date`)
 *   - YYYY-MM-DD
 *   - ISO timestamp
 * Returns a Date, or null if unparseable.
 */
export function parsePublishedAt(value: string | undefined | null): Date | null {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  // YYYYMMDD
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (m) {
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format published_at as "DD-MM-YYYY". */
export function formatPublishedDate(value: string | undefined | null): string {
  const d = parsePublishedAt(value);
  if (!d) return "";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/** Relative time for published_at (accepts YYYYMMDD too). */
export function publishedTimeAgo(value: string | undefined | null): string {
  const d = parsePublishedAt(value);
  if (!d) return "";
  return timeAgo(d.toISOString());
}
