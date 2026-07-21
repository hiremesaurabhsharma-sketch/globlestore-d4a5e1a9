import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Check, ListVideo } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import { type Video } from "@/lib/videos";
import { videosQueryOptions } from "@/lib/videos-query";
import { getChannelAvatar } from "@/lib/youtube-sync.functions";
import { slugify as plSlugify, seriesListId } from "@/lib/playlists";

import { useLibrary } from "@/lib/library";
import { channelGradient, channelInitials } from "@/lib/channel";
import { SiteHeader, VideoCard } from "./index";
import { Thumbnail } from "@/lib/thumbnail";
import { AdsterraBanner320 } from "@/components/adsterra-banner-320";


type TabKey = "home" | "videos" | "live" | "podcasts" | "playlists";
const TABS: { key: TabKey; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "videos", label: "Videos" },
  { key: "live", label: "Live" },
  { key: "podcasts", label: "Podcasts" },
  { key: "playlists", label: "Playlists" },
];


function isLive(v: Video) {
  if (v.is_live === true) return true;
  return /(?:^|\W)(?:🔴|live(?:stream|\s*class|\s*now|\s*session|\s*lecture)?|premiere)\b/i
    .test(v.title);
}
function isUpcoming(v: Video) {
  const t = Date.parse(v.published_at || v.added_at || "");
  return Number.isFinite(t) && t > Date.now();
}
function timeAgo(iso?: string) {
  if (!iso) return "";
  const diff = Date.now() - Date.parse(iso);
  if (!Number.isFinite(diff)) return "";
  const s = Math.max(1, Math.floor(diff / 1000));
  const units: [number, string][] = [
    [60, "second"], [60, "minute"], [24, "hour"],
    [7, "day"], [4.345, "week"], [12, "month"], [Infinity, "year"],
  ];
  let val = s;
  let label = "second";
  for (const [step, name] of units) {
    if (val < step) { label = name; break; }
    val = val / step;
    label = name;
  }
  const rounded = Math.floor(val);
  return `${rounded} ${label}${rounded === 1 ? "" : "s"} ago`;
}
function isPodcast(v: Video) {
  return /podcast|\bep(isode)?\b|conversation with|interview/i.test(v.title) ||
    /podcast/i.test(v.channel_name);
}

export const Route = createFileRoute("/channel/$channelName")({
  component: ChannelPage,
  loader: async ({ params, context }) => {
    // Fetch this channel's full video list directly from the DB in the
    // correct chronological order (newest YouTube upload first). The
    // shared home-feed cache only holds a shuffled sample, so channels
    // with many uploads would otherwise appear out of order / incomplete.
    const { supabase, VIDEOS_TABLE } = await import("@/lib/supabase");
    // PostgREST caps each request at 1000 rows, so paginate with .range()
    // to fetch the channel's entire history (channels have 2000+ videos).
    const PAGE = 1000;
    const MAX_PAGES = 10;
    const all: any[] = [];
    for (let i = 0; i < MAX_PAGES; i++) {
      const from = i * PAGE;
      const to = from + PAGE - 1;
      const { data, error } = await supabase
        .from(VIDEOS_TABLE)
        .select(
          "video_id:youtube_video_id, title, thumbnail_url, channel_name:channel_id, is_live, added_at:created_at, published_at, duration_seconds",
        )
        .eq("channel_id", params.channelName)
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < PAGE) break;
    }
    const data = all;

    const channelVideos: Video[] = (data ?? [])
      .filter((row: any) => row.video_id && row.title && /^[A-Za-z0-9_-]{11}$/.test(row.video_id))
      .map((row: any) => ({
        video_id: row.video_id,
        title: row.title,
        thumbnail_url: `https://i.ytimg.com/vi/${row.video_id}/hqdefault.jpg`,
        channel_name: row.channel_name,
        is_live: Boolean(row.is_live),
        added_at: row.added_at ?? undefined,
        description: row.description ?? undefined,
        published_at: row.published_at ?? undefined,
        duration_seconds: typeof row.duration_seconds === "number" ? row.duration_seconds : undefined,
      }));

    if (channelVideos.length === 0) {
      // Fallback to shared cache in case the channel name lives under a different column.
      const all = await context.queryClient.ensureQueryData(videosQueryOptions);
      const filtered = all.filter((v) => v.channel_name === params.channelName);
      if (filtered.length === 0) throw notFound();
      return { channelName: params.channelName, channelVideos: filtered };
    }
    return { channelName: params.channelName, channelVideos };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Channel — Spark" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { channelName, channelVideos } = loaderData;
    const canonical = `https://nonispark.com/channel/${encodeURIComponent(channelName)}`;
    const title = `${channelName} — Educational Videos | Spark`;
    const description = `Watch ${channelVideos.length} educational videos from ${channelName} on Spark — ad-free and distraction-free.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: canonical },
        { property: "og:type", content: "profile" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: canonical }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `${channelName} on Spark`,
            url: canonical,
            description,
          }),
        },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Channel not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">We couldn’t find that channel in our feed.</p>
        <Link to="/" className="mt-6 inline-flex rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background">
          Back to Home
        </Link>
      </main>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </main>
    </div>
  ),
});

function ChannelPage() {
  const { channelName, channelVideos } = Route.useLoaderData();
  const { isSubscribed, toggleSubscription } = useLibrary();
  const subscribed = isSubscribed(channelName);
  const gradient = channelGradient(channelName);
  const initials = channelInitials(channelName);
  const [tab, setTab] = useState<TabKey>("home");
  const [, startTabTransition] = useTransition();
  const [openPlaylist, setOpenPlaylist] = useState<string | null>(null);
  const selectTab = (key: TabKey) => {
    // Reset incremental pagination when switching tabs so the new tab
    // renders its first batch instantly instead of trying to mount
    // thousands of cards synchronously.
    setVisibleCount(24);
    startTabTransition(() => setTab(key));
  };
  const [visibleCount, setVisibleCount] = useState(24);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const { data: avatarData } = useQuery({
    queryKey: ["channel-avatar", channelName],
    queryFn: () => getChannelAvatar({ data: { channel_name: channelName } }),
    staleTime: 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: false,
  });
  const avatarUrl = avatarData?.avatar_url || "";
  const realVideoCount = avatarData?.video_count || 0;


  const sortedByRecency = useMemo(() => {
    // Prefer real YouTube upload date; fall back to insertion time.
    const time = (v: Video) => {
      const val = v.published_at || v.added_at || "";
      const p = Date.parse(val);
      return Number.isFinite(p) ? p : 0;
    };
    return channelVideos.slice().sort((a: Video, b: Video) => time(b) - time(a));
  }, [channelVideos]);

  const buckets = useMemo(() => {
    const live = sortedByRecency.filter(isLive);
    const podcasts = sortedByRecency.filter(isPodcast);
    const videos = sortedByRecency.slice();
    return { live, podcasts, videos };
  }, [sortedByRecency]);

  // Group into "playlists" by leading title token (e.g., "Current Affairs", "NCERT")
  const playlists = useMemo(() => {
    const groups = new Map<string, Video[]>();
    for (const v of channelVideos) {
      const key = (v.title.split(/[|:\-–—]/)[0] || v.title).trim().slice(0, 40);
      if (!key) continue;
      const arr = groups.get(key) || [];
      arr.push(v);
      groups.set(key, arr);
    }
    return Array.from(groups.entries())
      .filter(([, arr]) => arr.length >= 3)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 12);
  }, [channelVideos]);

  const renderGrid = (list: Video[], emptyLabel: string, paginate = false) => {
    if (list.length === 0) {
      return (
        <div className="rounded-2xl border border-border/60 bg-muted/20 px-6 py-16 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      );
    }
    const shown = paginate ? list.slice(0, visibleCount) : list;
    const hasMore = paginate && list.length > shown.length;
    return (
      <>
        <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((v) => (
            <VideoCard key={v.video_id} video={v} />
          ))}
        </div>
        {hasMore && (
          <div ref={sentinelRef} className="mt-8 flex justify-center py-6 text-xs text-muted-foreground">
            Loading more…
          </div>
        )}
      </>
    );
  };

  // Auto-load more cards as the sentinel scrolls into view.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((c) => c + 24);
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [tab, visibleCount]);


  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
        <Link
          to="/"
          className="mb-2 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground/70 transition hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back</span>
        </Link>

        <div className="relative h-[160px] w-full overflow-hidden rounded-2xl bg-neutral-900 sm:h-[200px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(59,130,246,0.25),transparent_45%),radial-gradient(circle_at_85%_30%,rgba(139,92,246,0.22),transparent_50%),radial-gradient(circle_at_50%_90%,rgba(236,72,153,0.18),transparent_55%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:32px_32px]" />
        </div>

        <div className="mt-4 flex flex-row items-center gap-4 px-2 pb-6 sm:gap-5 sm:px-4 sm:pb-8">
          <div
            className={`grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br ${gradient} text-lg font-bold text-white ring-2 ring-border sm:h-20 sm:w-20 sm:text-xl`}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={`${channelName} logo`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              initials
            )}
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold tracking-tight sm:text-2xl">{channelName}</h1>
              <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                {(realVideoCount || channelVideos.length).toLocaleString()} video{(realVideoCount || channelVideos.length) === 1 ? "" : "s"}
              </p>

            </div>
            <button
              type="button"
              onClick={() => toggleSubscription(channelName)}
              aria-pressed={subscribed}
              className={`ml-auto inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition sm:h-10 sm:px-5 ${
                subscribed
                  ? "bg-muted text-foreground hover:bg-muted/70"
                  : "bg-[#FF0033] text-white hover:brightness-110"
              }`}
            >
              {subscribed && <Check className="h-4 w-4" />}
              <span>{subscribed ? "Subscribed" : "Subscribe"}</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="sticky top-14 z-30 -mx-4 border-b border-border/60 bg-background/85 px-4 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex gap-1 overflow-x-auto scrollbar-none">
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => selectTab(t.key)}
                  className={`relative shrink-0 px-4 py-3 text-sm font-medium transition ${
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                  {active && (
                    <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-foreground" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        {tab === "home" && (
          <div className="space-y-10">
            {buckets.live.length > 0 && (
              <section>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold tracking-tight">
                  <span className="inline-flex h-2 w-2 rounded-full bg-red-500" /> Live
                </h2>
                {renderGrid(buckets.live.slice(0, 4), "")}
              </section>
            )}
            <section>
              <h2 className="mb-4 text-lg font-semibold tracking-tight">Latest videos</h2>
              {renderGrid(buckets.videos.slice(0, 8), "No videos yet.")}
            </section>
          </div>
        )}
        {tab === "videos" && renderGrid(buckets.videos, "No videos yet.", true)}
        {tab === "live" && <LiveSection list={buckets.live} />}
        {tab === "podcasts" && renderGrid(buckets.podcasts, "No podcasts from this channel.", true)}
        {tab === "playlists" && (
          playlists.length === 0 ? (
            <div className="rounded-2xl border border-border/60 bg-muted/20 px-6 py-16 text-center text-sm text-muted-foreground">
              No playlists yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {playlists.map(([name, items]) => {
                const isOpen = openPlaylist === name;
                const slug = plSlugify(name);
                const listId = seriesListId(channelName, slug);
                return (
                  <div key={name} className="overflow-hidden rounded-2xl border border-border/60 bg-card">
                    <Link
                      to="/playlist/$channel/$slug"
                      params={{ channel: channelName, slug }}
                      className="relative block aspect-video w-full overflow-hidden text-left"
                    >
                      <img src={items[0].thumbnail_url} alt={name} className="h-full w-full object-cover" />
                      <div className="absolute inset-y-0 right-0 flex w-1/3 flex-col items-center justify-center gap-1 bg-black/70 text-white">
                        <ListVideo className="h-6 w-6" />
                        <span className="text-sm font-semibold">{items.length} videos</span>
                      </div>
                    </Link>
                    <div className="p-3">
                      <p className="line-clamp-1 text-sm font-semibold">{name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Playlist • {items.length} videos</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Link
                          to="/watch/$videoId"
                          params={{ videoId: items[0].video_id }}
                          search={{ list: listId }}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#FF0033] px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110"
                        >
                          ▶ Play all
                        </Link>
                        <button
                          type="button"
                          onClick={() => setOpenPlaylist(isOpen ? null : name)}
                          className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                        >
                          {isOpen ? "Hide" : "View all"}
                        </button>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="max-h-96 divide-y divide-border/60 overflow-y-auto border-t border-border/60 bg-background/50">
                        {items.map((v, i) => (
                          <Link
                            key={v.video_id}
                            to="/watch/$videoId"
                            params={{ videoId: v.video_id }}
                            search={{ list: listId }}
                            className="flex items-start gap-2 p-2 hover:bg-muted/50"
                          >
                            <span className="w-5 shrink-0 pt-2 text-center text-[11px] text-muted-foreground">{i + 1}</span>
                            <img src={v.thumbnail_url} alt="" className="h-14 w-24 shrink-0 rounded object-cover" loading="lazy" />
                            <span className="line-clamp-2 text-xs">{v.title}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          )
        )}

        <AdsterraBanner320 />
      </main>
    </div>
  );
}

function LiveSection({ list }: { list: Video[] }) {
  const [visible, setVisible] = useState(24);
  const sentinel = useRef<HTMLDivElement | null>(null);

  const { liveNow, upcoming, past } = useMemo(() => {
    const liveNow: Video[] = [];
    const upcoming: Video[] = [];
    const past: Video[] = [];
    for (const v of list) {
      if (v.is_live === true) liveNow.push(v);
      else if (isUpcoming(v)) upcoming.push(v);
      else past.push(v);
    }
    return { liveNow, upcoming, past };
  }, [list]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible((c) => c + 24);
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  if (list.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 bg-muted/20 px-6 py-16 text-center text-sm text-muted-foreground">
        No live streams from this channel.
      </div>
    );
  }

  const pastShown = past.slice(0, visible);
  const hasMore = past.length > pastShown.length;

  const Card = ({ v, variant }: { v: Video; variant: "live" | "upcoming" | "past" }) => (
    <Link
      to="/watch/$videoId"
      params={{ videoId: v.video_id }}
      className="group block"
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-neutral-900">
        <Thumbnail
          src={v.thumbnail_url}
          alt={v.title}
          channelName={v.channel_name}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
        />
        {variant === "live" && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-[#FF0033] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white shadow">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            Live
          </span>
        )}
        {variant === "upcoming" && (
          <span className="absolute left-2 top-2 rounded-md bg-black/80 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
            Upcoming
          </span>
        )}
        {variant === "past" && (
          <span className="absolute bottom-2 right-2 rounded bg-black/85 px-1.5 py-0.5 text-[11px] font-medium text-white">
            Streamed
          </span>
        )}
      </div>
      <div className="mt-2.5 px-0.5">
        <h3 className="line-clamp-2 text-[13.5px] font-semibold leading-snug sm:text-sm">{v.title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {variant === "live" && "Watching now"}
          {variant === "upcoming" && `Scheduled • ${timeAgo(v.published_at).replace(" ago", "")}`}
          {variant === "past" && `Streamed ${timeAgo(v.published_at || v.added_at)}`}
        </p>
      </div>
    </Link>
  );

  return (
    <div className="space-y-10">
      {liveNow.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold tracking-tight">
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-[#FF0033]" /> Live now
          </h2>
          <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {liveNow.map((v) => <Card key={v.video_id} v={v} variant="live" />)}
          </div>
        </section>
      )}
      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold tracking-tight">Upcoming</h2>
          <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {upcoming.map((v) => <Card key={v.video_id} v={v} variant="upcoming" />)}
          </div>
        </section>
      )}
      {past.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold tracking-tight">Past live streams</h2>
          <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pastShown.map((v) => <Card key={v.video_id} v={v} variant="past" />)}
          </div>
          {hasMore && (
            <div ref={sentinel} className="mt-8 flex justify-center py-6 text-xs text-muted-foreground">
              Loading more…
            </div>
          )}
        </section>
      )}
    </div>
  );
}
