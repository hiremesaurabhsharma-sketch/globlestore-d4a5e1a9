-- Run this in your Supabase SQL Editor (dashboard.supabase.com → SQL Editor)
-- to enable YouTube API auto-sync.

CREATE TABLE IF NOT EXISTS public.tracked_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle text UNIQUE NOT NULL,
  channel_id text UNIQUE,
  channel_name text,
  uploads_playlist_id text,
  last_synced_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Server-only table: writes happen from server functions with the service role key.
ALTER TABLE public.tracked_channels ENABLE ROW LEVEL SECURITY;

-- No policies granted to anon/authenticated — service role bypasses RLS.
-- If you want to expose the channel list read-only to the browser, add:
-- CREATE POLICY "public read tracked_channels"
--   ON public.tracked_channels FOR SELECT TO anon USING (true);

CREATE INDEX IF NOT EXISTS tracked_channels_active_idx
  ON public.tracked_channels (is_active);

-- ---------------------------------------------------------------------------
-- Video duration overlay (YouTube-style timestamp on thumbnails)
-- ---------------------------------------------------------------------------
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

-- Speeds up filters like "hide shorts" or "long videos only" later.
CREATE INDEX IF NOT EXISTS videos_duration_seconds_idx
  ON public.videos (duration_seconds);

-- If get_random_videos() uses `SELECT *`, it already returns the new column.
-- If it declares an explicit RETURNS TABLE(...) list, re-create the function
-- with `duration_seconds INTEGER` appended to the return columns.
