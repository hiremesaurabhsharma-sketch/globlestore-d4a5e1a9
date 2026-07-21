/**
 * YouTube Data API v3 helpers. Server-only — reads YOUTUBE_API_KEY from env.
 */

const API_BASE = "https://www.googleapis.com/youtube/v3";

function apiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY is not set");
  return key;
}

async function ytFetch<T = any>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams({ ...params, key: apiKey() });
  const res = await fetch(`${API_BASE}/${path}?${qs.toString()}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`YouTube API ${path} failed [${res.status}]: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

export interface ResolvedChannel {
  channel_id: string;
  channel_name: string;
  uploads_playlist_id: string;
  avatar_url: string;
}

/**
 * Resolve a channel handle (like "@parmarssc") to its channel ID and
 * uploads playlist ID. One API unit.
 */
export async function resolveChannelByHandle(handle: string): Promise<ResolvedChannel> {
  const clean = handle.replace(/^@/, "");

  // 1) Try forHandle with the original case
  const tryForHandle = async (h: string) => {
    const data = await ytFetch<any>("channels", {
      part: "snippet,contentDetails",
      forHandle: `@${h}`,
    });
    return data.items?.[0];
  };

  let item = await tryForHandle(clean);

  // 2) Fallback: try lowercased handle (YT API is case-sensitive for forHandle)
  if (!item && clean !== clean.toLowerCase()) {
    item = await tryForHandle(clean.toLowerCase());
  }

  // 3) Fallback: search API (costs 100 units but reliable) — resolve to channelId, then fetch details
  if (!item) {
    const search = await ytFetch<any>("search", {
      part: "snippet",
      q: `@${clean}`,
      type: "channel",
      maxResults: "5",
    });
    const candidate =
      search.items?.find(
        (it: any) =>
          it.snippet?.customUrl?.toLowerCase() === `@${clean.toLowerCase()}` ||
          it.snippet?.channelTitle?.toLowerCase().replace(/\s+/g, "") ===
            clean.toLowerCase()
      ) ?? search.items?.[0];
    const channelId = candidate?.snippet?.channelId ?? candidate?.id?.channelId;
    if (channelId) {
      const data = await ytFetch<any>("channels", {
        part: "snippet,contentDetails",
        id: channelId,
      });
      item = data.items?.[0];
    }
  }

  if (!item) throw new Error(`Channel not found for handle @${clean}`);
  const thumbs = item.snippet?.thumbnails ?? {};
  const avatar_url =
    thumbs.high?.url || thumbs.medium?.url || thumbs.default?.url || "";
  return {
    channel_id: item.id,
    channel_name: item.snippet.title,
    uploads_playlist_id: item.contentDetails.relatedPlaylists.uploads,
    avatar_url,
  };
}

/**
 * Fetch avatar URL and total public video count for a channel. One API unit.
 */
export async function fetchChannelAvatar(
  channelId: string
): Promise<{ avatar_url: string; video_count: number }> {
  const data = await ytFetch<any>("channels", {
    part: "snippet,statistics",
    id: channelId,
  });
  const item = data.items?.[0];
  const thumbs = item?.snippet?.thumbnails ?? {};
  const avatar_url =
    thumbs.high?.url || thumbs.medium?.url || thumbs.default?.url || "";
  const video_count = Number(item?.statistics?.videoCount ?? 0) || 0;
  return { avatar_url, video_count };
}


export interface PlaylistItem {
  video_id: string;
  published_at: string;
}

/**
 * List video IDs from an uploads playlist. Paginated. 1 unit per page (50 items).
 * Pass maxPages to cap; use large number for initial import, small number (1) for sync.
 */
export async function listPlaylistVideoIds(
  playlistId: string,
  maxPages: number = 100
): Promise<PlaylistItem[]> {
  const items: PlaylistItem[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const params: Record<string, string> = {
      part: "contentDetails",
      playlistId,
      maxResults: "50",
    };
    if (pageToken) params.pageToken = pageToken;
    const data = await ytFetch<any>("playlistItems", params);
    for (const it of data.items ?? []) {
      const vid = it.contentDetails?.videoId;
      if (vid) {
        items.push({
          video_id: vid,
          published_at: it.contentDetails.videoPublishedAt ?? "",
        });
      }
    }
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return items;
}

export interface VideoDetail {
  video_id: string;
  title: string;
  channel_name: string;
  channel_id: string;
  published_at: string;
  description: string;
  thumbnail_url: string;
  is_live: boolean;
  duration: string;
  view_count: number;
  embeddable: boolean;
  privacy_status: string;
  region_blocked: boolean;
}

/**
 * Fetch full metadata for up to 50 video IDs per call. 1 unit per call.
 * Includes `status` part so we can detect non-embeddable / region-blocked
 * videos (they show the "Video unavailable" screen inside our player).
 */
export async function fetchVideoDetails(videoIds: string[]): Promise<VideoDetail[]> {
  const out: VideoDetail[] = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    const data = await ytFetch<any>("videos", {
      part: "snippet,contentDetails,liveStreamingDetails,statistics,status",
      id: chunk.join(","),
    });
    for (const item of data.items ?? []) {
      const sn = item.snippet ?? {};
      const cd = item.contentDetails ?? {};
      const stats = item.statistics ?? {};
      const status = item.status ?? {};
      const thumbs = sn.thumbnails ?? {};
      const thumb =
        thumbs.maxres?.url ||
        thumbs.standard?.url ||
        thumbs.high?.url ||
        `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`;
      // Region restriction: if `blocked` includes "IN" (or the list is huge),
      // the embed will fail for our users. Treat any non-empty `blocked`
      // list containing IN as blocked; also treat `allowed` lists that
      // exclude IN as blocked.
      const region = cd.regionRestriction ?? {};
      const blocked: string[] = region.blocked ?? [];
      const allowed: string[] | undefined = region.allowed;
      const region_blocked =
        blocked.includes("IN") ||
        (Array.isArray(allowed) && !allowed.includes("IN"));
      out.push({
        video_id: item.id,
        title: sn.title ?? "",
        channel_name: sn.channelTitle ?? "",
        channel_id: sn.channelId ?? "",
        published_at: sn.publishedAt ?? "",
        description: sn.description ?? "",
        thumbnail_url: thumb,
        is_live: sn.liveBroadcastContent === "live",
        duration: cd.duration ?? "",
        view_count: Number(stats.viewCount ?? 0),
        embeddable: status.embeddable !== false,
        privacy_status: status.privacyStatus ?? "public",
        region_blocked,
      });
    }
  }
  return out;
}

