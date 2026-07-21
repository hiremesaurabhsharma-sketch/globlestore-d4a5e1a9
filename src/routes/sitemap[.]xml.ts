import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { supabase, VIDEOS_TABLE } from "@/lib/supabase";

const BASE_URL = "https://purepadhai.lovable.app";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

// Percent-encode a channel name for a URL path segment.
function encodeSegment(s: string) {
  return encodeURIComponent(s).replace(/'/g, "%27");
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "daily", priority: "1.0" },
        ];

        try {
          // Fetch all videos (video_id, channel_name, added_at). Supabase
          // caps rows per request — pull a generous slice.
          const { data: videos } = await supabase
            .from(VIDEOS_TABLE)
            .select("video_id, channel_name, added_at")
            .limit(5000);

          if (videos && videos.length > 0) {
            const channelLatest = new Map<string, string | undefined>();
            for (const v of videos) {
              const videoId = (v as { video_id?: string }).video_id;
              const channel = (v as { channel_name?: string }).channel_name;
              const addedAt = (v as { added_at?: string | null }).added_at ?? undefined;

              if (videoId) {
                entries.push({
                  path: `/watch/${encodeSegment(videoId)}`,
                  changefreq: "weekly",
                  priority: "0.7",
                  lastmod: addedAt ? addedAt.slice(0, 10) : undefined,
                });
              }

              if (channel) {
                const existing = channelLatest.get(channel);
                if (!existing || (addedAt && addedAt > existing)) {
                  channelLatest.set(channel, addedAt);
                }
              }
            }

            for (const [channel, lastmod] of channelLatest) {
              entries.push({
                path: `/channel/${encodeSegment(channel)}`,
                changefreq: "weekly",
                priority: "0.6",
                lastmod: lastmod ? lastmod.slice(0, 10) : undefined,
              });
            }
          }
        } catch (err) {
          console.error("[sitemap] Supabase fetch failed:", err);
          // Fall back to just the home entry.
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${escapeXml(BASE_URL + e.path)}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
