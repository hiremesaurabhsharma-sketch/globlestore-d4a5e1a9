import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Slim columns — no description, no channel avatar, no extra fields.
const SELECT_COLS =
  "video_id:youtube_video_id, title, thumbnail_url, channel_name:channel_id, is_live, added_at:created_at, published_at, duration_seconds";

// Publishable (client-safe) key — same one shipped to the browser.
const SUPABASE_URL = "https://sysxryxguqjjwqdydmkd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_zJsY2l-NP38i15X8QymP7A_J2kUzbbb";
const R2_FEED_URL = "https://pub-543449ee08604439909c555eadac79a6.r2.dev/feed.json";
const FULL_FEED_SCOPE = "all-videos-v1";

const patchedFetch: typeof fetch = (input, init) => {
  const h = new Headers(init?.headers);
  if (h.get("Authorization") === `Bearer ${SUPABASE_PUBLISHABLE_KEY}`) {
    h.delete("Authorization");
  }
  h.set("apikey", SUPABASE_PUBLISHABLE_KEY);
  return fetch(input, { ...init, headers: h });
};

export const Route = createFileRoute("/api/public/feed")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const bust = Math.floor(Date.now() / (5 * 60_000));
          const r2Res = await fetch(`${R2_FEED_URL}?v=${bust}`, {
            headers: { Accept: "application/json" },
          });
          if (r2Res.ok) {
            const json = (await r2Res.json()) as { feed_scope?: string; videos?: any[] };
            if (json.feed_scope === FULL_FEED_SCOPE && Array.isArray(json.videos) && json.videos.length > 0) {
              return new Response(JSON.stringify({ videos: json.videos }), {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                  "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
                  "CDN-Cache-Control": "public, s-maxage=300",
                },
              });
            }
          }
        } catch {
          // R2 public URL can fail without CORS in browsers; server-side fallback keeps the feed working.
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { fetch: patchedFetch },
        });

        const PAGE_SIZE = 1000;
        const MAX_PAGES = 20;
        const rows: any[] = [];

        for (let page = 0; page < MAX_PAGES; page++) {
          const from = page * PAGE_SIZE;
          const to = from + PAGE_SIZE - 1;
          const { data, error } = await supabase
            .from("videos")
            .select(SELECT_COLS)
            .order("created_at", { ascending: false })
            .range(from, to);

          if (error) {
            return new Response(
              JSON.stringify({ error: error.message, videos: [] }),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                  // On errors serve empty for 30s so we retry soon.
                  "Cache-Control": "public, s-maxage=30",
                },
              },
            );
          }
          if (!data || data.length === 0) break;
          rows.push(...data);
          if (data.length < PAGE_SIZE) break;
        }

        const videos = rows
          .filter(
            (row: any) =>
              row.video_id &&
              row.title &&
              row.channel_name &&
              /^[A-Za-z0-9_-]{11}$/.test(row.video_id),
          )
          .map((row: any) => ({
            video_id: row.video_id,
            title: row.title,
            thumbnail_url: `https://i.ytimg.com/vi/${row.video_id}/hqdefault.jpg`,
            channel_name: row.channel_name,
            is_live: Boolean(row.is_live),
            added_at: row.added_at ?? undefined,
            published_at: row.published_at ?? undefined,
            duration_seconds:
              typeof row.duration_seconds === "number"
                ? row.duration_seconds
                : undefined,
          }));

        return new Response(JSON.stringify({ videos }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            // Edge-cached for 5 min; stale-while-revalidate serves stale
            // content for up to 24h while Cloudflare refreshes in background.
            // This means: 1 Supabase hit per 5 min per Cloudflare POP,
            // no matter how many students refresh.
            "Cache-Control":
              "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
            "CDN-Cache-Control": "public, s-maxage=300",
          },
        });
      },
    },
  },
});
