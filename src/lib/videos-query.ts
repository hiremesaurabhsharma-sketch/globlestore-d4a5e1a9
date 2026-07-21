import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { type Video } from "@/lib/videos";
import { supabase, VIDEOS_TABLE } from "@/lib/supabase";

// Slim column set for list/feed queries — description is heavy and only needed
// on the watch page, which fetches it separately per video.
const SELECT_COLS =
  "video_id:youtube_video_id, title, thumbnail_url, channel_name:channel_id, is_live, added_at:created_at, published_at, duration_seconds";

const R2_FEED_URL = "https://pub-543449ee08604439909c555eadac79a6.r2.dev/feed.json";
const FEED_ENDPOINT = "/api/public/feed";
const FULL_FEED_SCOPE = "all-videos-v1";
const LS_KEY = "gt.feed.v3";
const LS_TTL_MS = 10 * 60_000; // 10 min client-side cache

function readLocalCache(): Video[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; videos: Video[] };
    if (!parsed || typeof parsed.at !== "number" || !Array.isArray(parsed.videos)) return null;
    if (Date.now() - parsed.at > LS_TTL_MS) return null;
    return parsed.videos;
  } catch {
    return null;
  }
}

function writeLocalCache(videos: Video[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify({ at: Date.now(), videos }));
  } catch {
    // quota exceeded or private mode — ignore
  }
}

async function fetchFromR2(): Promise<Video[] | null> {
  try {
    // Cache-bust every 5 min so browsers/CDN pick up newly-synced feed.json
    const bust = Math.floor(Date.now() / (5 * 60_000));
    const res = await fetch(`${R2_FEED_URL}?v=${bust}`, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as { feed_scope?: string; videos?: Video[] };
    if (!json || json.feed_scope !== FULL_FEED_SCOPE || !Array.isArray(json.videos)) return null;
    return json.videos;
  } catch {
    return null;
  }
}

async function fetchFromEdge(): Promise<Video[] | null> {
  try {
    const res = await fetch(FEED_ENDPOINT, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as { videos?: Video[] };
    if (!json || !Array.isArray(json.videos)) return null;
    return json.videos;
  } catch {
    return null;
  }
}


async function fetchFromSupabase(): Promise<Video[]> {
  const PAGE_SIZE = 1000;
  const MAX_PAGES = 20;
  const rows: any[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from(VIDEOS_TABLE)
      .select(SELECT_COLS)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) {
      console.warn("[videos] Supabase fallback failed:", error.message);
      break;
    }
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows
    .filter((row) => row.video_id && row.title && /^[A-Za-z0-9_-]{11}$/.test(row.video_id))
    .map((row) => ({
      video_id: row.video_id,
      title: row.title,
      thumbnail_url: `https://i.ytimg.com/vi/${row.video_id}/hqdefault.jpg`,
      channel_name: row.channel_name ?? row.channel_id,
      is_live: Boolean(row.is_live),
      added_at: row.added_at ?? row.created_at ?? undefined,
      published_at: row.published_at ?? undefined,
      duration_seconds:
        typeof row.duration_seconds === "number" ? row.duration_seconds : undefined,
    }));
}

async function fetchVideos(): Promise<Video[]> {
  // 1) LocalStorage cache — instant, zero network for repeat visits within 10 min.
  const cached = readLocalCache();
  if (cached && cached.length > 0) {
    // Refresh from R2 in the background so the next visit has fresh data.
    fetchFromR2().then((fresh) => {
      if (fresh && fresh.length > 0) writeLocalCache(fresh);
    });
    return cached;
  }

  // 2) Same-origin edge endpoint — it reads the full R2 feed server-side
  // when available, avoiding browser CORS issues and Supabase egress.
  const edge = await fetchFromEdge();
  if (edge && edge.length > 0) {
    writeLocalCache(edge);
    return edge;
  }

  // 3) Direct Cloudflare R2 fallback — works when bucket CORS allows it.
  const r2 = await fetchFromR2();
  if (r2 && r2.length > 0) {
    writeLocalCache(r2);
    return r2;
  }

  // 4) Direct Supabase fallback — last resort.
  const direct = await fetchFromSupabase();
  if (direct.length > 0) writeLocalCache(direct);
  return direct;
}







/**
 * Fisher–Yates shuffle followed by a channel-aware interleave so the feed
 * doesn't show long streaks of the same channel (mimics YouTube's
 * diversified home feed).
 */
export function shuffleVideos<T extends { channel_name: string }>(list: readonly T[]): T[] {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const buckets = new Map<string, T[]>();
  for (const v of arr) {
    const b = buckets.get(v.channel_name);
    if (b) b.push(v);
    else buckets.set(v.channel_name, [v]);
  }
  const out: T[] = [];
  let last: string | null = null;
  while (out.length < arr.length) {
    let pick: string | null = null;
    let size = -1;
    for (const [k, b] of buckets) {
      if (b.length === 0 || k === last) continue;
      if (b.length > size) {
        size = b.length;
        pick = k;
      }
    }
    if (pick === null) {
      for (const [k, b] of buckets) {
        if (b.length > 0) { pick = k; break; }
      }
    }
    if (pick === null) break;
    out.push(buckets.get(pick)!.shift()!);
    last = pick;
  }
  return out;
}

function randomize<T>(list: readonly T[]): T[] {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function scatterIntoFirstBatch<T>(older: readonly T[], newest: readonly T[]): T[] {
  const batch = randomize(older).slice(0, Math.max(0, 24 - newest.length));
  const fresh = randomize(newest);
  for (let i = 0; i < fresh.length; i++) {
    const min = i < 4 ? i * 3 : 12 + (i - 4) * 2;
    const max = Math.min(batch.length, min + 3);
    const slot = Math.min(batch.length, min + Math.floor(Math.random() * Math.max(1, max - min + 1)));
    batch.splice(slot, 0, fresh[i]);
  }
  return batch;
}

function videoTime(video: { added_at?: string; published_at?: string }): number {
  const value = video.added_at || video.published_at || "";
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Home feed order — YouTube-like:
 * - Top 20–25 slots: videos published in the last 3 months (freshest first,
 *   diversified across channels).
 * - Then: rest of last-2-years videos (shuffled).
 * - Then: 2–3 year old videos (shuffled).
 * - Anything older than 3 years is excluded from the feed.
 */
const THREE_MONTHS_MS = 92 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;
const THREE_YEARS_MS = 3 * 365 * 24 * 60 * 60 * 1000;
const FRONT_FRESH_TARGET = 24; // 20–25 fresh videos up top

export function buildHomeFeedOrder<T extends { channel_name: string; added_at?: string; published_at?: string; duration_seconds?: number }>(list: readonly T[]): T[] {
  const now = Date.now();

  // Hard cut-off: drop anything published more than 3 years ago.
  const withinWindow = list.filter((v) => {
    const t = v.published_at ? Date.parse(v.published_at) : NaN;
    if (!Number.isFinite(t)) return false;
    return now - t <= THREE_YEARS_MS;
  });

  // Separate out "shorts" — very short clips (<90s). YouTube-style: they
  // should rarely surface in the main feed. Keep a tiny sample (~5%) mixed
  // into the tail so discovery still works, drop the rest.
  const isShort = (v: T) =>
    typeof v.duration_seconds === "number" && v.duration_seconds > 0 && v.duration_seconds < 90;
  const longform = withinWindow.filter((v) => !isShort(v));
  const shorts = withinWindow.filter(isShort);
  const shortsSample = randomize(shorts).slice(0, Math.max(2, Math.floor(shorts.length * 0.05)));

  if (longform.length <= FRONT_FRESH_TARGET) return shuffleVideos([...longform, ...shortsSample]);

  const fresh: T[] = []; // 1 day – 3 months
  const recent: T[] = []; // 3 months – 2 years
  const mid: T[] = []; // 2 – 3 years
  for (const v of longform) {
    const t = Date.parse(v.published_at || "");
    const age = now - t;
    if (age >= ONE_DAY_MS && age <= THREE_MONTHS_MS) fresh.push(v);
    else if (age <= TWO_YEARS_MS) recent.push(v);
    else mid.push(v);
  }

  const freshSorted = fresh
    .slice()
    .sort((a, b) => Date.parse(b.published_at || "") - Date.parse(a.published_at || ""));
  const byChannel = new Map<string, T[]>();
  for (const v of freshSorted) {
    const arr = byChannel.get(v.channel_name) || [];
    arr.push(v);
    byChannel.set(v.channel_name, arr);
  }
  const diversified: T[] = [];
  const queues = Array.from(byChannel.values());
  while (diversified.length < freshSorted.length) {
    for (const q of queues) {
      const next = q.shift();
      if (next) diversified.push(next);
    }
  }
  const frontFresh = diversified.slice(0, FRONT_FRESH_TARGET);
  const freshLeftover = diversified.slice(FRONT_FRESH_TARGET);

  return [
    ...frontFresh,
    ...shuffleVideos([...freshLeftover, ...recent]),
    ...shuffleVideos([...mid, ...shortsSample]),
  ];
}



export const videosQueryOptions = queryOptions<Video[]>({
  queryKey: ["videos"],
  queryFn: fetchVideos,
  staleTime: 0,
  gcTime: 10 * 60_000,
  refetchOnWindowFocus: false,
  refetchOnMount: true,
  refetchInterval: false,
});


export function useAllVideos(): Video[] {
  return useSuspenseQuery(videosQueryOptions).data;
}

