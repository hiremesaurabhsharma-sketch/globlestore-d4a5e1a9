/**
 * Server functions for YouTube channel tracking + video sync.
 * Load .server helpers only inside handlers (client-reachable module graph).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const HandleInput = z.object({ handle: z.string().min(1) });
const AdminInput = z.object({ admin_token: z.string().min(1) });

function normalizeHandle(input: string): string {
  // Accept "@name", "name", or full URL like "https://youtube.com/@name"
  const trimmed = input.trim();
  const match = trimmed.match(/@([A-Za-z0-9._-]+)/);
  if (match) return `@${match[1]}`;
  return `@${trimmed.replace(/^@/, "")}`;
}

function requireAdmin(token: string) {
  const expected = process.env.ADMIN_SYNC_TOKEN;
  if (!expected) throw new Error("ADMIN_SYNC_TOKEN not configured");
  if (token !== expected) throw new Error("Unauthorized");
}

/**
 * Add a channel by handle: resolves via YouTube API and stores in tracked_channels.
 */
export const addTrackedChannel = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ admin_token: z.string(), handle: z.string() }).parse(input)
  )
  .handler(async ({ data }) => {
    requireAdmin(data.admin_token);
    const { resolveChannelByHandle } = await import("@/lib/youtube-api.server");
    const { getSupabaseAdmin } = await import("@/lib/supabase-admin.server");

    const handle = normalizeHandle(data.handle);
    const resolved = await resolveChannelByHandle(handle);
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from("tracked_channels").upsert(
      {
        handle,
        channel_id: resolved.channel_id,
        channel_name: resolved.channel_name,
        uploads_playlist_id: resolved.uploads_playlist_id,
        is_active: true,
      },
      { onConflict: "handle" }
    );
    if (error) throw new Error(`DB upsert failed: ${error.message}`);
    return { ok: true, ...resolved, handle };
  });

/**
 * Import ALL videos from a channel (initial one-time import).
 * Paginates the uploads playlist and inserts videos in batches.
 */
export const importChannelHistory = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ admin_token: z.string(), handle: z.string() }).parse(input)
  )
  .handler(async ({ data }) => {
    requireAdmin(data.admin_token);
    const { listPlaylistVideoIds, fetchVideoDetails } = await import("@/lib/youtube-api.server");
    const { getSupabaseAdmin } = await import("@/lib/supabase-admin.server");

    const handle = normalizeHandle(data.handle);
    const supabase = getSupabaseAdmin();

    const { data: channel, error: chErr } = await supabase
      .from("tracked_channels")
      .select("uploads_playlist_id, channel_name")
      .eq("handle", handle)
      .maybeSingle();
    if (chErr || !channel) throw new Error(`Channel not found in DB: ${handle}`);

    // Full pagination — up to 100 pages = 5000 videos max
    const items = await listPlaylistVideoIds(channel.uploads_playlist_id, 100);
    if (items.length === 0) return { ok: true, imported: 0, skipped: 0, handle };

    // Skip already-present videos to save quota
    const ids = items.map((i) => i.video_id);
    const { data: existing } = await supabase
      .from("videos")
      .select("youtube_video_id")
      .in("youtube_video_id", ids);
    const existingSet = new Set((existing ?? []).map((r: any) => r.youtube_video_id));
    const missing = ids.filter((id) => !existingSet.has(id));

    if (missing.length === 0) {
      await markSynced(supabase, handle);
      return { ok: true, imported: 0, skipped: ids.length, handle };
    }

    const details = await fetchVideoDetails(missing);
    const playable = details.filter(
      (d) => d.embeddable && !d.region_blocked && d.privacy_status === "public"
    );
    const { parseISODuration } = await import("@/lib/duration");
    const rows = playable.map((d) => ({
      youtube_video_id: d.video_id,
      title: d.title,
      channel_id: d.channel_name, // legacy column stores name
      thumbnail_url: d.thumbnail_url,
      is_live: d.is_live,
      description: d.description || null,
      published_at: d.published_at || null,
      duration_seconds: parseISODuration(d.duration) || null,
    }));


    // Bulk insert with conflict-do-nothing
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200);
      const { error, count } = await supabase
        .from("videos")
        .upsert(batch, { onConflict: "youtube_video_id", ignoreDuplicates: true, count: "exact" });
      if (error) throw new Error(`Insert failed: ${error.message}`);
      inserted += count ?? batch.length;
    }

    await markSynced(supabase, handle);
    return { ok: true, imported: inserted, skipped: existingSet.size, handle };
  });

async function markSynced(supabase: any, handle: string) {
  await supabase
    .from("tracked_channels")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("handle", handle);
}

/**
 * Incremental sync: for each active channel, fetch latest 50 uploads,
 * insert only the new ones. Called by cron every 30 min.
 */
export async function syncAllChannelsCore(): Promise<{
  channels: number;
  new_videos: number;
  errors: string[];
}> {
  const { listPlaylistVideoIds, fetchVideoDetails } = await import("@/lib/youtube-api.server");
  const { getSupabaseAdmin } = await import("@/lib/supabase-admin.server");

  const supabase = getSupabaseAdmin();
  const { data: channels, error } = await supabase
    .from("tracked_channels")
    .select("handle, uploads_playlist_id, channel_name")
    .eq("is_active", true);
  if (error) throw new Error(`Failed to load channels: ${error.message}`);

  let totalNew = 0;
  const errors: string[] = [];

  for (const ch of channels ?? []) {
    try {
      const items = await listPlaylistVideoIds(ch.uploads_playlist_id, 1); // just latest 50
      const ids = items.map((i) => i.video_id);
      if (ids.length === 0) continue;

      const { data: existing } = await supabase
        .from("videos")
        .select("youtube_video_id")
        .in("youtube_video_id", ids);
      const existingSet = new Set((existing ?? []).map((r: any) => r.youtube_video_id));
      const missing = ids.filter((id) => !existingSet.has(id));

      if (missing.length > 0) {
        const details = await fetchVideoDetails(missing);
        const playable = details.filter(
          (d) => d.embeddable && !d.region_blocked && d.privacy_status === "public"
        );
        const { parseISODuration } = await import("@/lib/duration");
        const rows = playable.map((d) => ({
          youtube_video_id: d.video_id,
          title: d.title,
          channel_id: d.channel_name,
          thumbnail_url: d.thumbnail_url,
          is_live: d.is_live,
          description: d.description || null,
          published_at: d.published_at || null,
          duration_seconds: parseISODuration(d.duration) || null,
        }));

        const { error: insErr, count } = await supabase
          .from("videos")
          .upsert(rows, { onConflict: "youtube_video_id", ignoreDuplicates: true, count: "exact" });
        if (insErr) throw new Error(insErr.message);
        totalNew += count ?? rows.length;
      }

      await markSynced(supabase, ch.handle);
    } catch (e: any) {
      errors.push(`${ch.handle}: ${e.message ?? String(e)}`);
    }
  }

  // Also backfill up to 500 missing durations each run so thumbnails
  // always show MM:SS overlay without needing a manual admin click.
  try {
    const { parseISODuration } = await import("@/lib/duration");
    const { data: missingRows } = await supabase
      .from("videos")
      .select("youtube_video_id")
      .or("duration_seconds.is.null,duration_seconds.eq.0")
      .limit(500);
    const missingIds = (missingRows ?? []).map((r: any) => r.youtube_video_id).filter(Boolean);
    for (let i = 0; i < missingIds.length; i += 50) {
      const chunk = missingIds.slice(i, i + 50);
      const details = await fetchVideoDetails(chunk);
      for (const d of details) {
        const secs = parseISODuration(d.duration);
        if (!secs) continue;
        await supabase.from("videos").update({ duration_seconds: secs }).eq("youtube_video_id", d.video_id);
      }
    }
  } catch (e: any) {
    errors.push(`backfill: ${e.message ?? String(e)}`);
  }

  // Auto-mirror to R2 so home feed sees new videos immediately (unlimited free egress)
  try {
    const { syncFeedToR2Core } = await import("./r2-sync.functions");
    await syncFeedToR2Core();
  } catch (e: any) {
    errors.push(`r2_sync: ${e.message ?? String(e)}`);
  }

  return { channels: channels?.length ?? 0, new_videos: totalNew, errors };
}

/**
 * Admin-callable server fn version of the sync (for manual trigger from admin UI).
 */
export const syncAllChannelsFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AdminInput.parse(input))
  .handler(async ({ data }) => {
    requireAdmin(data.admin_token);
    return await syncAllChannelsCore();
  });

/**
 * List tracked channels (admin dashboard).
 */
export const listTrackedChannels = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AdminInput.parse(input))
  .handler(async ({ data }) => {
    requireAdmin(data.admin_token);
    const { getSupabaseAdmin } = await import("@/lib/supabase-admin.server");
    const supabase = getSupabaseAdmin();
    const { data: rows, error } = await supabase
      .from("tracked_channels")
      .select("handle, channel_name, channel_id, last_synced_at, is_active, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/**
 * Toggle active status of a channel.
 */
export const setChannelActive = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ admin_token: z.string(), handle: z.string(), is_active: z.boolean() }).parse(input)
  )
  .handler(async ({ data }) => {
    requireAdmin(data.admin_token);
    const { getSupabaseAdmin } = await import("@/lib/supabase-admin.server");
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("tracked_channels")
      .update({ is_active: data.is_active })
      .eq("handle", data.handle);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Public: get channel avatar URL by channel name (as stored on videos.channel_id).
 * Looks up tracked_channels for the YouTube channel_id, then fetches avatar
 * from the YouTube Data API. Cached client-side via React Query.
 */
export const getChannelAvatar = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ channel_name: z.string().min(1) }).parse(input)
  )
  .handler(async ({ data }) => {
    const { fetchChannelAvatar } = await import("@/lib/youtube-api.server");
    const { getSupabaseAdmin } = await import("@/lib/supabase-admin.server");
    const supabase = getSupabaseAdmin();
    const { data: row } = await supabase
      .from("tracked_channels")
      .select("channel_id")
      .eq("channel_name", data.channel_name)
      .maybeSingle();
    if (!row?.channel_id) return { avatar_url: "", video_count: 0 };
    try {
      const res = await fetchChannelAvatar(row.channel_id);
      return res;
    } catch {
      return { avatar_url: "", video_count: 0 };
    }

  });

/**
 * Public: fetch a video's full description from YouTube API on-demand.
 * Used by watch page when a freshly-synced video has an empty description
 * (creators sometimes publish first and add description minutes later).
 * Updates the DB row so subsequent loads are instant. 1 YT API unit.
 */
export const getVideoDescription = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ video_id: z.string().regex(/^[A-Za-z0-9_-]{11}$/) }).parse(input)
  )
  .handler(async ({ data }) => {
    const { fetchVideoDetails } = await import("@/lib/youtube-api.server");
    const { getSupabaseAdmin } = await import("@/lib/supabase-admin.server");
    try {
      const details = await fetchVideoDetails([data.video_id]);
      const d = details[0];
      if (!d) return { description: "" };
      const desc = d.description || "";
      if (desc) {
        const supabase = getSupabaseAdmin();
        await supabase
          .from("videos")
          .update({ description: desc })
          .eq("youtube_video_id", data.video_id);
      }
      return { description: desc };
    } catch {
      return { description: "" };
    }
  });

/**
 * Scan the videos table and delete rows for videos that cannot be embedded
 * (embed disabled by creator, region-blocked for IN, private/deleted, or
 * removed from YouTube entirely). One YouTube API unit per 50 videos.
 */
export const cleanupBlockedVideos = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AdminInput.parse(input))
  .handler(async ({ data }) => {
    requireAdmin(data.admin_token);
    const { fetchVideoDetails } = await import("@/lib/youtube-api.server");
    const { getSupabaseAdmin } = await import("@/lib/supabase-admin.server");
    const supabase = getSupabaseAdmin();

    // Page through all videos (Supabase capped at 1000 per range request).
    const allIds: string[] = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data: rows, error } = await supabase
        .from("videos")
        .select("youtube_video_id")
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      if (!rows || rows.length === 0) break;
      for (const r of rows as any[]) if (r.youtube_video_id) allIds.push(r.youtube_video_id);
      if (rows.length < PAGE) break;
    }

    let checked = 0;
    let deleted = 0;
    const toDelete: string[] = [];

    for (let i = 0; i < allIds.length; i += 50) {
      const chunk = allIds.slice(i, i + 50);
      const details = await fetchVideoDetails(chunk);
      const alive = new Set(details.map((d) => d.video_id));
      // Videos returned but not playable
      for (const d of details) {
        if (!d.embeddable || d.region_blocked || d.privacy_status !== "public") {
          toDelete.push(d.video_id);
        }
      }
      // Videos NOT returned by the API = deleted / privated on YouTube
      for (const id of chunk) if (!alive.has(id)) toDelete.push(id);
      checked += chunk.length;
    }

    // Delete in batches of 200
    for (let i = 0; i < toDelete.length; i += 200) {
      const batch = toDelete.slice(i, i + 200);
      const { error } = await supabase
        .from("videos")
        .delete()
        .in("youtube_video_id", batch);
      if (error) throw new Error(error.message);
      deleted += batch.length;
    }

    return { ok: true, checked, deleted };
  });

/**
 * Delete every video whose channel is NOT in the tracked_channels list.
 * Removes leftovers from old JSON/GitHub imports so only admin-managed
 * channels remain. Also refreshes the R2 mirror when done.
 */
export const pruneUntrackedVideos = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AdminInput.parse(input))
  .handler(async ({ data }) => {
    requireAdmin(data.admin_token);
    const { getSupabaseAdmin } = await import("@/lib/supabase-admin.server");
    const supabase = getSupabaseAdmin();

    const { data: chRows, error: chErr } = await supabase
      .from("tracked_channels")
      .select("channel_name");
    if (chErr) throw new Error(chErr.message);
    const trackedNames = Array.from(
      new Set((chRows ?? []).map((r: any) => r.channel_name).filter(Boolean)),
    );
    if (trackedNames.length === 0) {
      throw new Error("No tracked channels found — refusing to delete everything.");
    }

    // Page through videos and collect ids to delete (channel_id column stores the channel display name).
    const toDelete: string[] = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data: rows, error } = await supabase
        .from("videos")
        .select("youtube_video_id, channel_id")
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      if (!rows || rows.length === 0) break;
      for (const r of rows as any[]) {
        if (!trackedNames.includes(r.channel_id)) toDelete.push(r.youtube_video_id);
      }
      if (rows.length < PAGE) break;
    }

    let deleted = 0;
    for (let i = 0; i < toDelete.length; i += 200) {
      const batch = toDelete.slice(i, i + 200);
      const { error } = await supabase
        .from("videos")
        .delete()
        .in("youtube_video_id", batch);
      if (error) throw new Error(error.message);
      deleted += batch.length;
    }

    // Refresh R2 mirror so the home feed reflects the cleanup immediately.
    try {
      const { syncFeedToR2Core } = await import("./r2-sync.functions");
      await syncFeedToR2Core();
    } catch {
      // non-fatal
    }

    return { ok: true, kept_channels: trackedNames.length, deleted };
  });


/**
 * Backfill duration_seconds for existing videos that have NULL / 0 in that
 * column. Batches YouTube API calls in chunks of 50 IDs (1 quota unit per
 * chunk). Safe to re-run: only touches rows still missing a duration.
 */
export const backfillDurations = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ admin_token: z.string(), limit: z.number().int().positive().max(5000).optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    requireAdmin(data.admin_token);
    const { fetchVideoDetails } = await import("@/lib/youtube-api.server");
    const { getSupabaseAdmin } = await import("@/lib/supabase-admin.server");
    const { parseISODuration } = await import("@/lib/duration");
    const supabase = getSupabaseAdmin();

    const cap = data.limit ?? 2000;
    // Grab rows with missing duration.
    const { data: rows, error } = await supabase
      .from("videos")
      .select("youtube_video_id")
      .or("duration_seconds.is.null,duration_seconds.eq.0")
      .limit(cap);
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((r: any) => r.youtube_video_id).filter(Boolean);
    if (ids.length === 0) return { ok: true, checked: 0, updated: 0 };

    let updated = 0;
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      const details = await fetchVideoDetails(chunk);
      for (const d of details) {
        const secs = parseISODuration(d.duration);
        if (!secs) continue;
        const { error: upErr } = await supabase
          .from("videos")
          .update({ duration_seconds: secs })
          .eq("youtube_video_id", d.video_id);
        if (!upErr) updated++;
      }
    }
    return { ok: true, checked: ids.length, updated };
  });
