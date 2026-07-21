/**
 * Public sync endpoint for cron. Protected by X-Sync-Secret header.
 * Call every 30 min from an external cron (cron-job.org, GitHub Action,
 * or Supabase pg_cron via pg_net).
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/sync-videos")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-sync-secret");
        const expected = process.env.ADMIN_SYNC_TOKEN;
        if (!expected) {
          return Response.json({ error: "ADMIN_SYNC_TOKEN not configured" }, { status: 500 });
        }
        if (!secret || secret !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const { syncAllChannelsCore } = await import("@/lib/youtube-sync.functions");
          const result = await syncAllChannelsCore();
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          console.error("[sync-videos] error:", e);
          return Response.json({ error: e.message ?? String(e) }, { status: 500 });
        }
      },
      GET: async ({ request }) => {
        // Header-only auth. Query-string secrets leak via server/proxy logs,
        // browser history, and Referer headers — never accept them here.
        const secret = request.headers.get("x-sync-secret");
        const expected = process.env.ADMIN_SYNC_TOKEN;
        if (!expected) {
          return Response.json({ error: "ADMIN_SYNC_TOKEN not configured" }, { status: 500 });
        }
        if (!secret || secret !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const { syncAllChannelsCore } = await import("@/lib/youtube-sync.functions");
          const result = await syncAllChannelsCore();
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          console.error("[sync-videos] error:", e);
          return Response.json({ error: e.message ?? String(e) }, { status: 500 });
        }
      },
    },
  },
});
