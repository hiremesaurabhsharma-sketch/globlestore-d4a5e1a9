/**
 * Parse an ISO 8601 duration string (e.g. "PT1H2M3S", "PT45S", "P0D") into
 * seconds. Returns 0 for empty / unparsable input or live-stream markers.
 */
export function parseISODuration(iso: string | null | undefined): number {
  if (!iso || typeof iso !== "string") return 0;
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!m) return 0;
  const h = Number(m[1] ?? 0);
  const min = Number(m[2] ?? 0);
  const s = Number(m[3] ?? 0);
  return h * 3600 + min * 60 + s;
}

/**
 * YouTube-style compact duration:
 *  - 45 → "0:45"
 *  - 125 → "2:05"
 *  - 3725 → "1:02:05"
 */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
