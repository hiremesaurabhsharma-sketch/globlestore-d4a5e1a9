import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ThumbsUp, ListPlus, X, Plus, Check, ListVideo, Play, ChevronDown } from "lucide-react";
import { Fragment, memo, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { type Video } from "@/lib/videos";
import { videosQueryOptions, useAllVideos, shuffleVideos } from "@/lib/videos-query";
import { formatFullDate, timeAgo, formatPublishedDate, publishedTimeAgo } from "@/lib/format-time";
import { Thumbnail } from "@/lib/thumbnail";
import { formatDuration } from "@/lib/duration";
import { linkify } from "@/lib/linkify";
import { categoriesFor } from "@/lib/categories";


import { useLibrary } from "@/lib/library";
import { channelGradient, channelInitials } from "@/lib/channel";
import { SiteHeader } from "./index";
import { AdsterraBanner320 } from "@/components/adsterra-banner-320";
import { useQuery } from "@tanstack/react-query";
import { getChannelAvatar, getVideoDescription } from "@/lib/youtube-sync.functions";
import { derivePlaylist, parseSeriesListId, slugify } from "@/lib/playlists";


const watchSearchSchema = z.object({
  list: fallback(z.string(), "").optional(),
});

export const Route = createFileRoute("/watch/$videoId")({
  component: Watch,
  notFoundComponent: WatchNotFound,
  errorComponent: WatchError,
  validateSearch: zodValidator(watchSearchSchema),
  loader: async ({ params, context }) => {
    const all = await context.queryClient.ensureQueryData(videosQueryOptions);
    let video = all.find((v) => v.video_id === params.videoId);
    if (!video) {
      // Fallback: fetch directly from Supabase if not in the loaded feed sample.
      const { supabase, VIDEOS_TABLE } = await import("@/lib/supabase");
      const { data } = await supabase
        .from(VIDEOS_TABLE)
        .select(
          "video_id:youtube_video_id, title, thumbnail_url, channel_name:channel_id, is_live, added_at:created_at, description, published_at",
        )
        .eq("youtube_video_id", params.videoId)
        .maybeSingle();
      if (data && /^[A-Za-z0-9_-]{11}$/.test(data.video_id)) {
        video = {
          video_id: data.video_id,
          title: data.title,
          thumbnail_url:
            data.thumbnail_url ||
            `https://i.ytimg.com/vi/${data.video_id}/hqdefault.jpg`,
          channel_name: data.channel_name,
          is_live: Boolean(data.is_live),
          added_at: data.added_at,
          description: data.description ?? null,
          published_at: data.published_at ?? null,
        } as Video;
      }
    }
    if (!video) throw notFound();
    return { video };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Video not found — Spark" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { video } = loaderData;
    const canonical = `https://nonispark.com/watch/${params.videoId}`;
    const rawDesc = (video.description ?? "").trim();
    const description = rawDesc
      ? rawDesc.replace(/\s+/g, " ").slice(0, 155)
      : `Watch ${video.title} by ${video.channel_name} on Spark — ad-free and distraction-free.`;
    const title = `${video.title} — ${video.channel_name} | Spark`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: canonical },
        { property: "og:type", content: "video.other" },
        { property: "og:image", content: video.thumbnail_url },
        { property: "og:video", content: `https://www.youtube.com/embed/${params.videoId}` },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: video.thumbnail_url },
      ],
      links: [{ rel: "canonical", href: canonical }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "VideoObject",
            name: video.title,
            description,
            thumbnailUrl: video.thumbnail_url,
            uploadDate: video.published_at || video.added_at || undefined,
            embedUrl: `https://www.youtube.com/embed/${params.videoId}`,
            contentUrl: `https://www.youtube.com/watch?v=${params.videoId}`,
            publisher: {
              "@type": "Organization",
              name: video.channel_name,
            },
          }),
        },
      ],
    };
  },
});

function Watch() {
  const { video: loadedVideo } = Route.useLoaderData();
  const { list: listId } = Route.useSearch();
  const allVideos = useAllVideos();
  const { getPlaylist, isLiked, toggleLike, isSubscribed, toggleSubscription, hydrated } = useLibrary();

  // Fresh uploads (< ~1 hour old) frequently land in Supabase with an empty
  // description because the creator publishes first and adds description
  // afterwards. Fetch it on-demand from YouTube API when missing.
  const needsDescription =
    !loadedVideo.description || !loadedVideo.description.trim();
  const { data: lateDesc } = useQuery({
    queryKey: ["video-description", loadedVideo.video_id],
    queryFn: async () => {
      const res = await getVideoDescription({
        data: { video_id: loadedVideo.video_id },
      });
      return res.description || "";
    },
    enabled: needsDescription,
    staleTime: 10 * 60 * 1000,
  });
  const video: Video = useMemo(
    () =>
      needsDescription && lateDesc
        ? { ...loadedVideo, description: lateDesc }
        : loadedVideo,
    [loadedVideo, needsDescription, lateDesc],
  );

  // A playlist may come from two sources:
  //   1. User's own library playlists (list=<id>).
  //   2. Deterministic channel series playlists (list=series:<channelSlug>::<slug>).
  const seriesInfo = listId ? parseSeriesListId(listId) : null;
  const seriesPlaylist = useMemo(() => {
    if (!seriesInfo) return null;
    // Find matching channel from any video with that slug.
    const sample = allVideos.find(
      (v) => slugify(v.channel_name) === seriesInfo.channelSlug,
    );
    if (!sample) return null;
    const derived = derivePlaylist(allVideos, sample.channel_name, seriesInfo.slug);
    if (!derived) return null;
    return { id: derived.id, name: derived.name, videoIds: derived.videoIds };
  }, [seriesInfo, allVideos]);

  const libraryPlaylist = listId && !seriesInfo ? getPlaylist(listId) : undefined;
  const playlist = libraryPlaylist ?? seriesPlaylist ?? undefined;
  // If a list param is present but hydration hasn't loaded the playlist yet,
  // still render — we just won't show the queue until hydrated.
  const queueVideos: Video[] = playlist
    ? playlist.videoIds
        .map((id) => allVideos.find((v) => v.video_id === id))
        .filter((v): v is Video => Boolean(v))
    : [];


  // YouTube-style relevance ranking for the "Up next" sidebar:
  //  1. Same channel first (most contextually relevant).
  //  2. Then same exam category / topic (UPSC, NEET, JEE, …).
  //  3. Only fall back to random recent uploads if the above run out.
  // Cap at 20 items so the sidebar stays scannable.
  const related = useMemo(() => {
    const pool = allVideos.filter((v) => v.video_id !== video.video_id);
    const used = new Set<string>();
    const out: Video[] = [];
    const take = (list: Video[], max: number) => {
      for (const v of list) {
        if (out.length >= 20) break;
        if (used.has(v.video_id)) continue;
        used.add(v.video_id);
        out.push(v);
        if (--max <= 0) break;
      }
    };

    // 1) Same channel — up to 6, shuffled.
    const sameChannel = shuffleVideos(
      pool.filter((v) => v.channel_name === video.channel_name),
    );
    take(sameChannel, 6);

    // 2) Same category (any overlapping exam topic), shuffled.
    const currentCats = new Set(categoriesFor(video));
    if (currentCats.size > 0) {
      const sameCategory = shuffleVideos(
        pool.filter((v) => categoriesFor(v).some((c) => currentCats.has(c))),
      );
      take(sameCategory, 20);
    }

    // 3) Fallback — recent uploads, channel-diversified.
    if (out.length < 20) {
      const recent = [...pool]
        .sort((a, b) => {
          const ta = a.published_at || a.added_at || "";
          const tb = b.published_at || b.added_at || "";
          return tb.localeCompare(ta);
        })
        .slice(0, 150);
      take(shuffleVideos(recent), 20);
    }

    return out;
  }, [allVideos, video.video_id, video.channel_name]);
  // Use privacy-enhanced domain to bypass third-party cookie blocks & most adblock rules
  const src = `https://www.youtube-nocookie.com/embed/${video.video_id}?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1&color=white`;

  const liked = isLiked(video.video_id);
  const subscribed = isSubscribed(video.channel_name);
  const gradient = channelGradient(video.channel_name);
  const initials = channelInitials(video.channel_name);

  const { data: avatarData } = useQuery({
    queryKey: ["channel-avatar", video.channel_name],
    queryFn: () => getChannelAvatar({ data: { channel_name: video.channel_name } }),
    staleTime: 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: false,
  });
  const avatarUrl = avatarData?.avatar_url || "";
  const [saveOpen, setSaveOpen] = useState(false);
  const [playerStarted, setPlayerStarted] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  const currentIndex = playlist ? playlist.videoIds.indexOf(video.video_id) : -1;

  useEffect(() => {
    setPlayerStarted(false);
    setDescExpanded(false);
  }, [video.video_id]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-[1600px] px-0 pb-6 pt-0 sm:px-6 sm:py-6">
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] lg:gap-8">
          <section className="min-w-0">
            <div className="sticky top-[56px] z-20 overflow-hidden bg-black shadow-md sm:top-[60px] sm:rounded-2xl sm:ring-1 sm:ring-border lg:static lg:shadow-none">
              <div className="relative aspect-video w-full">
                {playerStarted ? (
                  <iframe
                    key={video.video_id}
                    src={src}
                    title={video.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    allowFullScreen
                    className="absolute inset-0 h-full w-full"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setPlayerStarted(true)}
                    aria-label={`Play ${video.title}`}
                    className="group absolute inset-0 h-full w-full overflow-hidden"
                  >
                    <Thumbnail
                      src={video.thumbnail_url}
                      alt={video.title}
                      channelName={video.channel_name}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/30" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FF0033] shadow-2xl shadow-black/50 transition-transform duration-300 group-hover:scale-110 sm:h-20 sm:w-20">
                        <Play className="h-7 w-7 translate-x-0.5 fill-white text-white sm:h-9 sm:w-9" />
                      </span>
                    </div>
                    {video.is_live && (
                      <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-md bg-[#FF0033] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                        Live
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>





            <div className="mt-3 px-3 sm:mt-4 sm:rounded-2xl sm:border sm:border-border sm:bg-card sm:p-6 sm:px-6">
              <button
                type="button"
                onClick={() => setDescExpanded((v) => !v)}
                aria-expanded={descExpanded}
                className="group flex w-full items-start gap-2 text-left"
              >
                <h1 className="flex-1 text-[17px] font-bold leading-snug tracking-tight sm:text-2xl">
                  {video.is_live && (
                    <span className="mr-2 inline-flex -translate-y-0.5 items-center gap-1 rounded-md bg-[#FF0033] px-2 py-0.5 align-middle text-[11px] font-bold uppercase tracking-wide text-white">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                      Live
                    </span>
                  )}
                  {video.title}
                </h1>
                <ChevronDown
                  className={`mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform ${descExpanded ? "rotate-180" : ""}`}
                />
              </button>
              <div className="mt-3 h-px w-full bg-border sm:hidden" />

              <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Link
                    to="/channel/$channelName"
                    params={{ channelName: video.channel_name }}
                    aria-label={`${video.channel_name} channel`}
                    className={`grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br ${gradient} text-sm font-bold text-white transition hover:opacity-90`}
                  >
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={video.channel_name}
                        loading="lazy"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      initials
                    )}
                  </Link>
                  <div className="min-w-0">
                    <Link
                      to="/channel/$channelName"
                      params={{ channelName: video.channel_name }}
                      className="block truncate text-sm font-semibold hover:underline"
                    >
                      {video.channel_name}
                    </Link>
                    <p className="text-xs text-muted-foreground">Educational creator</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSubscription(video.channel_name)}
                    aria-pressed={subscribed}
                    className={`ml-2 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition ${
                      subscribed
                        ? "bg-muted text-foreground hover:bg-muted/70"
                        : "bg-[#FF0033] text-white hover:brightness-110"
                    }`}
                  >
                    {subscribed && <Check className="h-4 w-4" />}
                    <span>{subscribed ? "Subscribed" : "Subscribe"}</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleLike(video.video_id)}
                    aria-pressed={liked}
                    className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition ${
                      liked
                        ? "bg-foreground text-background"
                        : "bg-muted text-foreground hover:bg-muted/70"
                    }`}
                  >
                    <ThumbsUp className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
                    <span>{liked ? "Liked" : "Like"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSaveOpen(true)}
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-muted px-4 text-sm font-medium text-foreground transition hover:bg-muted/70"
                  >
                    <ListPlus className="h-4 w-4" />
                    <span>Save</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Description / metadata card — YouTube-style (click to expand) */}
            {(() => {
              const hasDescription = Boolean(video.description && video.description.trim());
              const hasPublished = Boolean(video.published_at && publishedTimeAgo(video.published_at));
              const hasAdded = Boolean(video.added_at);
              if (!hasDescription && !hasPublished && !hasAdded && !video.is_live) return null;
              return (
                <DescriptionCard
                  video={video}
                  hasDescription={hasDescription}
                  hasPublished={hasPublished}
                  hasAdded={hasAdded}
                  expanded={descExpanded}
                  onCollapse={() => setDescExpanded(false)}
                />
              );
            })()}



            {/* Mobile sidebar content */}
            <div className="mt-6 px-3 sm:mt-8 sm:px-0 lg:hidden">
              {playlist ? (
                <PlaylistQueue
                  playlistName={playlist.name}
                  playlistId={playlist.id}
                  items={queueVideos}
                  currentVideoId={video.video_id}
                  currentIndex={currentIndex}
                />
              ) : (
                <>
                  <h2 className="mb-4 text-lg font-semibold tracking-tight">More Educational Videos</h2>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    {related.map((v, i) => (
                      <Fragment key={v.video_id}>
                        {i === 4 && (
                          <div className="flex flex-col">
                            <div className="relative aspect-video overflow-hidden rounded-xl bg-muted ring-1 ring-border/50">
                              <AdsterraBanner320 cardLike className="absolute inset-0 h-full w-full overflow-hidden p-2" />
                            </div>
                          </div>
                        )}
                        <RelatedCard video={v} layout="grid" />
                      </Fragment>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>

          <aside className="hidden min-w-0 lg:block">
            {playlist ? (
              <PlaylistQueue
                playlistName={playlist.name}
                playlistId={playlist.id}
                items={queueVideos}
                currentVideoId={video.video_id}
                currentIndex={currentIndex}
              />
            ) : (
              <>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  More Educational Videos
                </h2>
                <div className="flex max-h-[calc(100vh-10rem)] flex-col gap-3 overflow-y-auto pr-1">
                  {related.map((v, i) => (
                    <Fragment key={v.video_id}>
                      {i === 4 && (
                        <div className="rounded-xl border border-border/60 bg-muted/30 p-2">
                          <AdsterraBanner320 cardLike />
                        </div>
                      )}
                      <RelatedCard video={v} layout="row" />
                    </Fragment>
                  ))}
                </div>
              </>
            )}
            {listId && !playlist && hydrated && (
              <p className="mt-4 text-xs text-muted-foreground">Playlist unavailable.</p>
            )}
          </aside>
        </div>
      </main>

      {saveOpen && <SaveToPlaylistModal videoId={video.video_id} onClose={() => setSaveOpen(false)} />}
    </div>
  );
}

function PlaylistQueue({
  playlistName,
  playlistId,
  items,
  currentVideoId,
  currentIndex,
}: {
  playlistName: string;
  playlistId: string;
  items: Video[];
  currentVideoId: string;
  currentIndex: number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <ListVideo className="h-3.5 w-3.5" />
            <span>Playlist</span>
          </div>
          <h2 className="mt-0.5 truncate text-sm font-semibold">{playlistName}</h2>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {currentIndex >= 0 ? `${currentIndex + 1} / ${items.length}` : `${items.length}`}
        </span>
      </div>
      <div className="flex max-h-[calc(100vh-14rem)] flex-col overflow-y-auto">
        {items.map((v, i) => {
          const isActive = v.video_id === currentVideoId;
          return (
            <Link
              key={v.video_id}
              to="/watch/$videoId"
              params={{ videoId: v.video_id }}
              search={{ list: playlistId }}
              className={`group grid grid-cols-[24px_112px_minmax(0,1fr)] items-start gap-2 px-3 py-2 transition ${
                isActive ? "bg-muted" : "hover:bg-muted/60"
              }`}
            >
              <span className="pt-1 text-center text-[11px] font-medium text-muted-foreground">
                {isActive ? <Play className="mx-auto h-3 w-3 fill-current text-foreground" /> : i + 1}
              </span>
              <div className="relative aspect-video overflow-hidden rounded-md bg-muted ring-1 ring-border/50">
                <Thumbnail src={v.thumbnail_url} alt={v.title} channelName={v.channel_name} />
                {!v.is_live && v.duration_seconds ? (
                  <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/85 px-1 py-0.5 text-[10px] font-semibold tabular-nums text-white">
                    {formatDuration(v.duration_seconds)}
                  </span>
                ) : null}
              </div>

              <div className="min-w-0 pt-0.5">
                <h3 className={`line-clamp-2 text-xs font-semibold leading-snug ${isActive ? "text-foreground" : ""}`}>
                  {v.title}
                </h3>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">{v.channel_name}</p>
              </div>
            </Link>
          );
        })}
        {items.length === 0 && (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">This playlist is empty.</p>
        )}
      </div>
    </div>
  );
}

function SaveToPlaylistModal({ videoId, onClose }: { videoId: string; onClose: () => void }) {
  const { playlists, createPlaylist, togglePlaylistVideo, playlistHasVideo } = useLibrary();
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    createPlaylist(trimmed, videoId);
    setNewName("");
    setCreating(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Save to playlist"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold">Save video to…</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto px-2 py-2">
          {playlists.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No playlists yet. Create your first one below.
            </p>
          ) : (
            <ul className="flex flex-col">
              {playlists.map((pl) => {
                const checked = playlistHasVideo(pl.id, videoId);
                return (
                  <li key={pl.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition hover:bg-muted">
                      <span
                        className={`grid h-5 w-5 place-items-center rounded border transition ${
                          checked
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-transparent"
                        }`}
                      >
                        {checked && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => togglePlaylistVideo(pl.id, videoId)}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">{pl.name}</span>
                      <span className="text-xs text-muted-foreground">{pl.videoIds.length}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-border px-4 py-4">
          {creating ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") {
                    setCreating(false);
                    setNewName("");
                  }
                }}
                placeholder="Playlist name"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-foreground"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setNewName("");
                  }}
                  className="h-10 rounded-lg px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                  className="h-10 rounded-lg bg-foreground px-4 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-40"
                >
                  Create
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              <Plus className="h-4 w-4" />
              <span>Create a new playlist</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DescriptionCard({
  video,
  hasDescription,
  hasPublished,
  hasAdded,
  expanded,
  onCollapse,
}: {
  video: Video;
  hasDescription: boolean;
  hasPublished: boolean;
  hasAdded: boolean;
  expanded: boolean;
  onCollapse: () => void;
}) {
  return (
    <div className="mx-3 mt-3 rounded-xl bg-muted/60 p-3 sm:mx-0 sm:rounded-2xl sm:border sm:border-border sm:bg-muted/40 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium">
        {hasPublished ? (
          <>
            <span className="text-foreground">
              Uploaded on: {formatPublishedDate(video.published_at)}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{publishedTimeAgo(video.published_at)}</span>
          </>
        ) : hasAdded ? (
          <>
            <span className="text-foreground">Added on {formatFullDate(video.added_at)}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{timeAgo(video.added_at)}</span>
          </>
        ) : (
          <span className="text-muted-foreground">Recently uploaded</span>
        )}
        {video.is_live && (
          <span className="inline-flex items-center gap-1 rounded-md bg-[#FF0033] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Live now
          </span>
        )}
      </div>

      {hasDescription && expanded && (
        <div className="mt-3">
          <p className="whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground">
            {linkify(video.description!)}
          </p>
          <button
            type="button"
            onClick={onCollapse}
            className="mt-3 text-sm font-semibold text-foreground transition hover:opacity-80"
          >
            Show less
          </button>
        </div>
      )}
    </div>
  );
}

const RelatedCard = memo(function RelatedCard({ video, layout }: { video: Video; layout: "grid" | "row" }) {

  if (layout === "grid") {
    return (
      <Link to="/watch/$videoId" params={{ videoId: video.video_id }} className="group flex flex-col">
        <div className="relative aspect-video overflow-hidden rounded-xl bg-muted ring-1 ring-border/50 transition group-hover:ring-foreground/20">
          <Thumbnail src={video.thumbnail_url} alt={video.title} channelName={video.channel_name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          {!video.is_live && video.duration_seconds ? (
            <span className="pointer-events-none absolute bottom-1.5 right-1.5 rounded-md bg-black/85 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
              {formatDuration(video.duration_seconds)}
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex flex-col gap-1">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{video.title}</h3>
          <p className="text-xs text-muted-foreground">{video.channel_name}</p>
        </div>
      </Link>
    );
  }
  return (
    <Link
      to="/watch/$videoId"
      params={{ videoId: video.video_id }}
      className="group grid grid-cols-[168px_minmax(0,1fr)] gap-3 rounded-xl p-1 transition hover:bg-muted"
    >
      <div className="relative aspect-video overflow-hidden rounded-lg bg-muted ring-1 ring-border/50">
        <Thumbnail src={video.thumbnail_url} alt={video.title} channelName={video.channel_name} />
        {!video.is_live && video.duration_seconds ? (
          <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/85 px-1 py-0.5 text-[10px] font-semibold tabular-nums text-white">
            {formatDuration(video.duration_seconds)}
          </span>
        ) : null}
      </div>
      <div className="min-w-0 py-1">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{video.title}</h3>
        <p className="mt-1 truncate text-xs text-muted-foreground">{video.channel_name}</p>
      </div>
    </Link>
  );
});

function WatchNotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-3xl font-bold">Video not found</h1>
        <p className="mt-3 text-muted-foreground">
          This video may have been removed or the link is incorrect.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#FF0033] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Back to home
        </Link>
      </main>
    </div>
  );
}

function WatchError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-3xl font-bold">Something went wrong</h1>
        <p className="mt-3 text-muted-foreground">
          We couldn't load this video. Please try again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#FF0033] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Retry
        </button>
      </main>
    </div>
  );
}

