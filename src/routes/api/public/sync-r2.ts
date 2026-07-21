/**
 * Cron endpoint: syncs feed from Supabase to R2. Protected by X-Sync-Secret.
 * Configure external cron (cron-job.org or Supabase pg_cron) to POST/GET here
 * every 5-10 minutes.
 */
import { createFileRoute } from "@tanstack/react-router";

async function handle(request: Request) {
  const secret = request.headers.get("x-sync-secret");
  const expected = process.env.ADMIN_SYNC_TOKEN;
  if (!expected) {
    return Response.json({ error: "ADMIN_SYNC_TOKEN not configured" }, { status: 500 });
  }
  if (!secret || secret !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const { syncFeedToR2Core } = await import("@/lib/r2-sync.functions");
    const result = await syncFeedToR2Core();
    return Response.json({ ok: true, ...result });
  } catch (e: any) {
    console.error("[sync-r2] error:", e);
    return Response.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/sync-r2")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      GET: async ({ request }) => handle(request),
    },
  },
});
