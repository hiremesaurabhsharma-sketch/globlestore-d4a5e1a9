/**
 * Sync the home feed from Supabase to Cloudflare R2 as a static feed.json.
 * Runs on cron; frontend reads from R2's public URL (unlimited egress, free).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AwsClient } from "aws4fetch";
import { createClient } from "@supabase/supabase-js";

const AdminInput = z.object({ admin_token: z.string().min(1) });

const SELECT_COLS =
  "video_id:youtube_video_id, title, thumbnail_url, channel_name:channel_id, is_live, added_at:created_at, published_at, duration_seconds";

const SUPABASE_URL = "https://sysxryxguqjjwqdydmkd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_zJsY2l-NP38i15X8QymP7A_J2kUzbbb";
const FULL_FEED_SCOPE = "all-videos-v1";

function makeSupabaseClient() {
  const patchedFetch: typeof fetch = (input, init) => {
    const h = new Headers(init?.headers);
    if (h.get("Authorization") === `Bearer ${SUPABASE_PUBLISHABLE_KEY}`) {
      h.delete("Authorization");
    }
    h.set("apikey", SUPABASE_PUBLISHABLE_KEY);
    return fetch(input, { ...init, headers: h });
  };
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: patchedFetch },
  });
}

async function fetchFeedFromSupabase() {
  const supabase = makeSupabaseClient();
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
    if (error) throw new Error(`Supabase feed fetch failed: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }

  return rows
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
        typeof row.duration_seconds === "number" ? row.duration_seconds : undefined,
    }));
}

/**
 * Core sync: pulls feed from Supabase, uploads feed.json to R2.
 * Returns basic stats.
 */
export async function syncFeedToR2Core(): Promise<{
  videos: number;
  bytes: number;
  public_url: string;
}> {
  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT;
  const bucket = process.env.R2_BUCKET;
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!accessKey || !secretKey || !endpoint || !bucket || !publicUrl) {
    throw new Error("R2 env vars not configured");
  }

  const videos = await fetchFeedFromSupabase();
  const body = JSON.stringify({
    feed_scope: FULL_FEED_SCOPE,
    videos,
    synced_at: new Date().toISOString(),
  });

  const client = new AwsClient({
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
    service: "s3",
    region: "auto",
  });

  const url = `${endpoint.replace(/\/$/, "")}/${bucket}/feed.json`;
  const res = await client.fetch(url, {
    method: "PUT",
    body,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`R2 upload failed [${res.status}]: ${txt}`);
  }

  return {
    videos: videos.length,
    bytes: body.length,
    public_url: `${publicUrl.replace(/\/$/, "")}/feed.json`,
  };
}

/**
 * Admin-callable version (from /admin page).
 */
export const syncFeedToR2Fn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AdminInput.parse(input))
  .handler(async ({ data }) => {
    const expected = process.env.ADMIN_SYNC_TOKEN;
    if (!expected) throw new Error("ADMIN_SYNC_TOKEN not configured");
    if (data.admin_token !== expected) throw new Error("Unauthorized");
    return await syncFeedToR2Core();
  });
