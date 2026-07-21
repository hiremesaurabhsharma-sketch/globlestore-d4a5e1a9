export type Video = {
  title: string;
  video_id: string;
  thumbnail_url: string;
  channel_name: string;
  is_live?: boolean;
  /** ISO timestamp of when the video was added to EliteFree. */
  added_at?: string;
  /** Description text from YouTube (may contain URLs). */
  description?: string;
  /** Original upload date from YouTube (YYYYMMDD from yt-dlp, or ISO). */
  published_at?: string;
  /** Video length in seconds (0 or missing for live streams / unknown). */
  duration_seconds?: number;
};
