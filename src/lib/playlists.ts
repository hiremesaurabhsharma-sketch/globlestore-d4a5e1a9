// Deterministic "series playlists" derived from video titles.
// A playlist = all videos from a channel whose title share the same
// leading token (split on : | - – —), e.g. "Current Affairs", "NCERT".
// Cost = ₹0: purely client-side, uses the already-loaded feed data.

import type { Video } from "@/lib/videos";

export const SERIES_PREFIX = "series:";
const KEY_LEN = 48;

export function playlistKeyFromTitle(title: string): string {
  const first = (title.split(/[|:\-–—]/)[0] || title).trim();
  return first.slice(0, KEY_LEN);
}

export function slugify(input: string): string {
  return (input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function seriesListId(channel: string, slug: string): string {
  return `${SERIES_PREFIX}${slugify(channel)}::${slug}`;
}

/** Build a playlist { id, name, videoIds } from a channel + slug. */
export function derivePlaylist(
  allVideos: Video[],
  channelName: string,
  slug: string,
): { id: string; name: string; videoIds: string[]; items: Video[] } | null {
  const channelSlug = slugify(channelName);
  const matches = allVideos.filter(
    (v) => slugify(v.channel_name) === channelSlug &&
      slugify(playlistKeyFromTitle(v.title)) === slug,
  );
  if (matches.length === 0) return null;
  // Sort chronologically ascending — playlists play oldest → newest.
  matches.sort((a, b) => {
    const ta = Date.parse(a.published_at || a.added_at || "") || 0;
    const tb = Date.parse(b.published_at || b.added_at || "") || 0;
    return ta - tb;
  });
  const name = playlistKeyFromTitle(matches[0].title);
  return {
    id: seriesListId(channelName, slug),
    name,
    videoIds: matches.map((v) => v.video_id),
    items: matches,
  };
}

/** All channel-scoped playlists, sorted by size desc. */
export function channelPlaylists(
  channelVideos: Video[],
  minSize = 3,
): Array<{ slug: string; name: string; items: Video[] }> {
  const groups = new Map<string, Video[]>();
  for (const v of channelVideos) {
    const name = playlistKeyFromTitle(v.title);
    if (name.length < 4) continue;
    const slug = slugify(name);
    if (!slug) continue;
    const arr = groups.get(slug) || [];
    arr.push(v);
    groups.set(slug, arr);
  }
  const out: Array<{ slug: string; name: string; items: Video[] }> = [];
  for (const [slug, items] of groups) {
    if (items.length < minSize) continue;
    items.sort((a, b) => {
      const ta = Date.parse(a.published_at || a.added_at || "") || 0;
      const tb = Date.parse(b.published_at || b.added_at || "") || 0;
      return ta - tb;
    });
    out.push({ slug, name: playlistKeyFromTitle(items[0].title), items });
  }
  return out.sort((a, b) => b.items.length - a.items.length);
}

/** Parse a series list id back to { channelSlug, slug }. */
export function parseSeriesListId(listId: string):
  | { channelSlug: string; slug: string }
  | null {
  if (!listId.startsWith(SERIES_PREFIX)) return null;
  const rest = listId.slice(SERIES_PREFIX.length);
  const [channelSlug, slug] = rest.split("::");
  if (!channelSlug || !slug) return null;
  return { channelSlug, slug };
}
