import { createFileRoute, Link } from "@tanstack/react-router";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { channelGradient, channelInitials } from "@/lib/channel";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Search, Mic, Bell, X, Sun, Moon, ThumbsUp, ListVideo, Users, GraduationCap, Palette, Check, LogIn, LogOut, UserPlus } from "lucide-react";
import { type Video } from "@/lib/videos";
import { buildHomeFeedOrder, videosQueryOptions } from "@/lib/videos-query";
import { timeAgo, publishedTimeAgo } from "@/lib/format-time";
import { Thumbnail } from "@/lib/thumbnail";
import { formatDuration } from "@/lib/duration";

import { useTheme } from "@/lib/theme";
import { useBrandStyle, BRAND_STYLES, type BrandStyle } from "@/lib/style-theme";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { smartSearch } from "@/lib/smart-search";
import { slugify as pSlugify } from "@/lib/playlists";

import { BrandLogo } from "@/components/brand-logo";
import { useAuth, displayName, initialFor } from "@/lib/auth-context";

import { AdsterraBanner320 } from "@/components/adsterra-banner-320";

const PAGE_SIZE = 24;

export const Route = createFileRoute("/")({
  component: Index,
  loader: ({ context }) => context.queryClient.ensureQueryData(videosQueryOptions),
  head: () => ({
    meta: [
      { title: "Spark — Free Educational Videos for SSC, UPSC, NEET, JEE" },
      { name: "description", content: "Ad-free, distraction-free video feed for serious aspirants. Curated classes for SSC, UPSC, NEET, JEE, State PCS, Banking & Railways." },
      { property: "og:title", content: "Spark — Free Educational Videos for SSC, UPSC, NEET, JEE" },
      { property: "og:description", content: "Ad-free, distraction-free video feed for serious aspirants. Curated classes for SSC, UPSC, NEET, JEE, State PCS, Banking & Railways." },
      { property: "og:url", content: "https://nonispark.com/" },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Spark — Free Educational Videos for SSC, UPSC, NEET, JEE" },
      { name: "twitter:description", content: "Ad-free, distraction-free video feed for serious aspirants. Curated classes for SSC, UPSC, NEET, JEE, State PCS, Banking & Railways." },
      { name: "keywords", content: "SSC, UPSC, NEET, JEE, State PCS, Banking exams, educational videos, free classes, exam preparation, IAS, IIT, Physics Wallah, Khan Academy" },
    ],
    links: [{ rel: "canonical", href: "https://nonispark.com/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Spark",
          url: "https://nonispark.com/",
          description:
            "Ad-free, distraction-free educational video platform for SSC, UPSC, NEET, JEE, State PCS aspirants.",
          potentialAction: {
            "@type": "SearchAction",
            target: "https://nonispark.com/?q={search_term_string}",
            "query-input": "required name=search_term_string",
          },
        }),
      },
    ],
  }),
});

const EXAM_CATEGORIES: { id: string; label: string; keywords: string[] }[] = [
  { id: "all", label: "All", keywords: [] },
  { id: "upsc", label: "UPSC", keywords: ["upsc", "ias", "civil service", "prelims", "mains", "vajiram", "vision ias", "drishti", "forum ias", "insight"] },
  { id: "ssc", label: "SSC", keywords: ["ssc", "cgl", "chsl", "mts", "gd constable", "staff selection"] },
  { id: "neet", label: "NEET", keywords: ["neet", "aiims", "biology", "physics wallah neet", "allen neet", "aakash neet"] },
  { id: "jee", label: "JEE", keywords: ["jee", "iit", "jee main", "jee advanced", "physics wallah jee", "allen jee", "aakash jee"] },
  { id: "state-pcs", label: "State PCS", keywords: ["pcs", "bpsc", "uppcs", "mppsc", "rpsc", "tnpsc", "kpsc", "wbcs", "mpsc", "state pcs"] },
  { id: "banking", label: "Banking", keywords: ["banking", "ibps", "sbi po", "sbi clerk", "rbi", "nabard"] },
];

function Index() {
  const { data: allVideos } = useSuspenseQuery(videosQueryOptions);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const debouncedQuery = useDebouncedValue(query, 300);

  // Freeze the feed order on mount. New videos coming in via realtime are
  // appended without disturbing the existing shuffle, so cards never jump
  // around while the user is scrolling. The order only re-randomizes on a
  // real page refresh.
  const orderRef = useRef<string[] | null>(null);
  const feedVideos = useMemo(() => {
    const byId = new Map(allVideos.map((v) => [v.video_id, v] as const));
    if (!orderRef.current) {
      const shuffled = buildHomeFeedOrder(allVideos);
      orderRef.current = shuffled.map((v) => v.video_id);
      return shuffled;
    }
    // Keep previous order for known ids, drop removed ones, append new ones.
    const known: typeof allVideos = [];
    const seen = new Set<string>();
    for (const id of orderRef.current) {
      const v = byId.get(id);
      if (v) { known.push(v); seen.add(id); }
    }
    const fresh = allVideos.filter((v) => !seen.has(v.video_id));
    const next = [...fresh, ...known]; // new uploads appear at the top
    orderRef.current = next.map((v) => v.video_id);
    return next;
  }, [allVideos]);


  const filtered = useMemo(() => {
    const q = debouncedQuery.trim();
    const cat = EXAM_CATEGORIES.find((c) => c.id === category);
    const catKeys = cat?.keywords ?? [];

    // 1) Apply category filter first (cheap word-boundary match).
    const catFiltered = catKeys.length
      ? feedVideos.filter((v) => {
          const haystack = `${v.title} ${v.channel_name}`.toLowerCase();
          return catKeys.some((k) => haystack.includes(k));
        })
      : feedVideos;

    // 2) No query → keep feed order (fresh + relevant on top).
    if (!q) return catFiltered;

    // 3) Query → YouTube-like relevance ranking (synonyms + typo tolerance).
    return smartSearch(catFiltered, q);
  }, [feedVideos, debouncedQuery, category]);

  // Matching channels for the current query (YouTube-style channel results strip). 100% client-side, ₹0.
  const channelMatches = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return [];
    const seen = new Map<string, { name: string; count: number; latestThumb?: string }>();
    for (const v of feedVideos) {
      const name = v.channel_name;
      if (!name) continue;
      const lname = name.toLowerCase();
      // Match: substring either way, OR every query token appears in channel name.
      const tokens = q.split(/\s+/).filter(Boolean);
      const allIn = tokens.every((t) => lname.includes(t));
      if (!(lname.includes(q) || q.includes(lname) || allIn)) continue;
      const prev = seen.get(name);
      if (prev) prev.count += 1;
      else seen.set(name, { name, count: 1, latestThumb: v.thumbnail_url });
    }
    return Array.from(seen.values()).sort((a, b) => b.count - a.count).slice(0, 6);
  }, [feedVideos, debouncedQuery]);

  // Playlist-style series grouped by (channel + leading title token).
  // Surfaced in feed and search so users can jump into a channel's series
  // directly, YouTube-style. 100% client-side, ₹0 extra cost.
  const playlistMatches = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    const groups = new Map<
      string,
      { channel: string; name: string; count: number; thumb?: string }
    >();
    for (const v of feedVideos) {
      const rawKey = (v.title.split(/[|:\-–—]/)[0] || v.title).trim();
      if (rawKey.length < 4) continue;
      const name = rawKey.slice(0, 48);
      const key = `${v.channel_name}::${name.toLowerCase()}`;
      const g = groups.get(key);
      if (g) {
        g.count += 1;
      } else {
        groups.set(key, { channel: v.channel_name, name, count: 1, thumb: v.thumbnail_url });
      }
    }
    let list = Array.from(groups.values()).filter((g) => g.count >= 4);
    if (q) {
      const tokens = q.split(/\s+/).filter(Boolean);
      list = list.filter((g) => {
        const hay = `${g.name} ${g.channel}`.toLowerCase();
        return tokens.every((t) => hay.includes(t));
      });
      return list.sort((a, b) => b.count - a.count).slice(0, 12);
    }
    // No query → diversify across channels: at most 1 playlist per channel,
    // shuffled deterministically so the strip doesn't get dominated by a
    // single teacher.
    const byChannel = new Map<string, typeof list>();
    for (const g of list) {
      const arr = byChannel.get(g.channel) || [];
      arr.push(g);
      byChannel.set(g.channel, arr);
    }
    const oncePerChannel = Array.from(byChannel.values()).map(
      (arr) => arr.sort((a, b) => b.count - a.count)[0],
    );
    const shuffled = oncePerChannel.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, 40);


  }, [feedVideos, debouncedQuery]);

  // Progressive reveal for the Playlists strip so users can pull in more
  // series without a full page refresh.
  const PLAYLIST_STEP = 8;
  const [playlistVisible, setPlaylistVisible] = useState(PLAYLIST_STEP);
  useEffect(() => {
    setPlaylistVisible(PLAYLIST_STEP);
  }, [debouncedQuery, category]);
  const visiblePlaylists = useMemo(
    () => playlistMatches.slice(0, playlistVisible),
    [playlistMatches, playlistVisible],
  );
  const hasMorePlaylists = playlistVisible < playlistMatches.length;




  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // Reset pagination whenever filters change.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [debouncedQuery, category]);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore = visibleCount < filtered.length;

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, filtered.length));
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, filtered.length]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader query={query} onQueryChange={setQuery} />

      {/* Exam category chips */}
      <div
        className="sticky top-[56px] z-20 border-b border-border/60 backdrop-blur-md sm:top-[60px]"
        style={{ backgroundColor: "var(--header-bg)" }}
      >
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-2.5 sm:px-6 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          {EXAM_CATEGORIES.map((c) => {
            const active = c.id === category;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`shrink-0 rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-foreground text-background"
                    : "bg-muted text-foreground hover:bg-muted/70"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        {filtered.length === 0 ? (
          <div className="mx-auto flex max-w-md flex-col items-center justify-center py-24 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-muted">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">No educational videos found</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Try a different title or channel name.
            </p>
          </div>
        ) : (
          <>
            {channelMatches.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Channels
                </h2>
                <div className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/60 bg-muted/30">
                  {channelMatches.map((c) => (
                    <Link
                      key={c.name}
                      to="/channel/$channelName"
                      params={{ channelName: c.name }}
                      className="flex items-center gap-4 px-4 py-3 transition hover:bg-muted/60"
                    >
                      <div
                        className="grid h-14 w-14 shrink-0 place-items-center rounded-full text-base font-bold text-white"
                        style={{ background: channelGradient(c.name) }}
                      >
                        {channelInitials(c.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-base font-semibold">{c.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.count} {c.count === 1 ? "video" : "videos"}
                        </div>
                      </div>
                      <span className="hidden shrink-0 rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground sm:inline-block">
                        View channel
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visible.slice(0, 12).map((v) => (
                <VideoCard key={v.video_id} video={v} />
              ))}

              {playlistMatches.length > 0 && visible.length > 12 && (
                <section className="col-span-full my-2">
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Playlists
                    </h2>
                    {hasMorePlaylists && (
                      <button
                        type="button"
                        onClick={() =>
                          setPlaylistVisible((n) =>
                            Math.min(n + PLAYLIST_STEP, playlistMatches.length),
                          )
                        }
                        className="shrink-0 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-medium text-foreground transition hover:bg-muted"
                      >
                        Load more playlists
                      </button>
                    )}
                  </div>
                  <div className="flex gap-4 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
                    {visiblePlaylists.map((p) => (
                      <Link
                        key={`${p.channel}::${p.name}`}
                        to="/playlist/$channel/$slug"
                        params={{ channel: p.channel, slug: pSlugify(p.name) }}
                        className="group w-64 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted/30 transition hover:bg-muted/60"
                      >
                        <div className="relative aspect-video overflow-hidden bg-muted">
                          {p.thumb ? (
                            <img
                              src={p.thumb}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover transition group-hover:scale-105"
                            />
                          ) : null}
                          <div className="absolute inset-y-0 right-0 flex w-14 flex-col items-center justify-center bg-black/70 text-white">
                            <div className="text-base font-bold leading-none">{p.count}</div>
                            <div className="mt-1 text-[10px] uppercase tracking-wide">videos</div>
                          </div>
                        </div>
                        <div className="p-3">
                          <div className="line-clamp-2 text-sm font-semibold">{p.name}</div>
                          <div className="mt-1 truncate text-xs text-muted-foreground">
                            {p.channel} · Playlist
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                  {hasMorePlaylists && (
                    <div className="mt-3 flex justify-center sm:hidden">
                      <button
                        type="button"
                        onClick={() =>
                          setPlaylistVisible((n) =>
                            Math.min(n + PLAYLIST_STEP, playlistMatches.length),
                          )
                        }
                        className="rounded-full border border-border/70 bg-muted/40 px-4 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
                      >
                        Load more playlists
                      </button>
                    </div>
                  )}
                </section>
              )}

              {visible.slice(12).map((v) => (
                <VideoCard key={v.video_id} video={v} />
              ))}
            </div>


            {hasMore && (
              <div
                ref={sentinelRef}
                className="flex items-center justify-center py-10 text-sm text-muted-foreground"
                aria-hidden="true"
              >
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground/60" />
                  Loading more videos…
                </span>
              </div>
            )}
          </>
        )}
      </main>
      <AdsterraBanner320 />
    </div>
  );
}


export function SiteHeader({
  query,
  onQueryChange,
}: {
  query?: string;
  onQueryChange?: (v: string) => void;
}) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const hasSearch = typeof onQueryChange === "function";
  const { theme, toggle: toggleTheme } = useTheme();
  const { style, setStyle } = useBrandStyle();
  const currentStyle = BRAND_STYLES.find((s) => s.id === style) ?? BRAND_STYLES[0];
  const { user, signOut } = useAuth();
  const avatarInitial = initialFor(user, "G");
  const shownName = displayName(user);

  useEffect(() => {
    if (!notifOpen && !profileOpen && !styleOpen) return;
    const onDown = (e: MouseEvent) => {
      if (notifOpen && !notifRef.current?.contains(e.target as Node)) setNotifOpen(false);
      if (profileOpen && !profileRef.current?.contains(e.target as Node)) setProfileOpen(false);
      if (styleOpen && !styleRef.current?.contains(e.target as Node)) setStyleOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [notifOpen, profileOpen, styleOpen]);


  return (
    <header className="klaro-header sticky top-0 z-30 shadow-md">
      <div className="flex items-center gap-2 px-3 py-2 sm:gap-4 sm:px-6 sm:py-2.5">
        {/* Left: brand + theme toggle */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Link to="/" className="group flex items-center gap-2.5">
            <BrandLogo
              size={26}
              className="shrink-0 transition-transform duration-300 group-hover:-rotate-3 sm:!text-[30px]"
            />

          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="hbtn ml-1 grid h-10 w-10 place-items-center rounded-full transition"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>

        {/* Center: search + mic */}
        {hasSearch && (
          <div className="hidden flex-1 items-center justify-center gap-2 md:flex">
            <SearchBar value={query ?? ""} onChange={onQueryChange!} />
            <button
              type="button"
              aria-label="Search with your voice"
              className="hchip grid h-10 w-10 shrink-0 place-items-center rounded-full transition"
            >
              <Mic className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Right */}
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          {hasSearch && (
            <button
              type="button"
              onClick={() => setMobileSearchOpen((s) => !s)}
              aria-label="Search"
              className="hbtn grid h-10 w-10 place-items-center rounded-full transition md:hidden"
            >
              <Search className="h-5 w-5" />
            </button>
          )}







          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setNotifOpen((s) => !s)}
              aria-label="Notifications"
              className="hbtn relative grid h-10 w-10 place-items-center rounded-full transition"
            >
              <Bell className="h-5 w-5" />
              <span
                className="absolute right-2 top-2 h-2 w-2 rounded-full ring-2"
                style={{ backgroundColor: "var(--brand)", boxShadow: "0 0 0 2px var(--header-bg)" }}
              />
            </button>
            {notifOpen && (
              <div className="hpop absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-xl shadow-2xl">
                <div className="hborder border-b px-4 py-3 text-sm font-semibold">
                  Notifications
                </div>
                <div className="flex items-start gap-3 px-4 py-3">
                  <span
                    className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full"
                    style={{ backgroundImage: "var(--brand-gradient)", color: "var(--brand-foreground)" }}
                  >
                    <GraduationCap className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">New educational video added!</p>
                    <p className="hmuted mt-0.5 text-xs">Check it out.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((s) => !s)}
              aria-label={user ? "Account menu" : "Sign in"}
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold transition hover:opacity-90"
              style={{ backgroundImage: "var(--brand-gradient)", color: "var(--brand-foreground)" }}
            >
              {avatarInitial}
            </button>
            {profileOpen && (
              <div
                role="menu"
                className="hpop absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-xl shadow-2xl"
              >
                <div className="hborder flex items-center gap-3 border-b px-4 py-3">
                  <span
                    className="grid h-9 w-9 place-items-center rounded-full text-sm font-semibold"
                    style={{ backgroundImage: "var(--brand-gradient)", color: "var(--brand-foreground)" }}
                  >
                    {avatarInitial}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{shownName}</p>
                    <p className="hmuted truncate text-xs">
                      {user ? user.email ?? "Signed in" : "Browsing as guest"}
                    </p>
                  </div>
                </div>
                {!user && (
                  <div className="hborder border-b p-2">
                    <Link
                      to="/auth"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold"
                      style={{ backgroundImage: "var(--brand-gradient)", color: "var(--brand-foreground)" }}
                    >
                      <LogIn className="h-4 w-4" />
                      <span>Sign in</span>
                    </Link>
                    <Link
                      to="/auth"
                      onClick={() => setProfileOpen(false)}
                      className="mt-1.5 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hpop-item"
                    >
                      <UserPlus className="h-4 w-4" />
                      <span>Create account</span>
                    </Link>
                  </div>
                )}
                <nav className="py-1.5 text-sm">
                  <Link
                    to="/library/liked"
                    onClick={() => setProfileOpen(false)}
                    className="hpop-item flex items-center gap-3 px-4 py-2.5 transition"
                  >
                    <ThumbsUp className="h-4 w-4" />
                    <span>Liked Videos</span>
                  </Link>
                  <Link
                    to="/library/playlists"
                    onClick={() => setProfileOpen(false)}
                    className="hpop-item flex items-center gap-3 px-4 py-2.5 transition"
                  >
                    <ListVideo className="h-4 w-4" />
                    <span>My Playlists</span>
                  </Link>
                  <Link
                    to="/library/subscriptions"
                    onClick={() => setProfileOpen(false)}
                    className="hpop-item flex items-center gap-3 px-4 py-2.5 transition"
                  >
                    <Users className="h-4 w-4" />
                    <span>Subscriptions</span>
                  </Link>
                  {user && (
                    <button
                      type="button"
                      onClick={async () => { setProfileOpen(false); await signOut(); }}
                      className="hpop-item flex w-full items-center gap-3 px-4 py-2.5 text-left transition"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Sign out</span>
                    </button>
                  )}
                </nav>
              </div>
            )}
          </div>
        </div>
      </div>

      {hasSearch && mobileSearchOpen && (
        <div className="hborder flex items-center gap-2 border-t px-3 py-2 md:hidden" style={{ backgroundColor: "var(--header-bg)" }}>
          <SearchBar value={query ?? ""} onChange={onQueryChange!} autoFocus />
          <button
            type="button"
            aria-label="Search with your voice"
            className="hchip grid h-10 w-10 shrink-0 place-items-center rounded-full transition"
          >
            <Mic className="h-4 w-4" />
          </button>
        </div>
      )}
    </header>
  );
}

function SearchBar({
  value,
  onChange,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="flex w-full max-w-2xl items-stretch">
      <div
        className="hborder relative flex flex-1 items-center rounded-l-full border focus-within:border-[var(--brand)]"
        style={{ backgroundColor: "var(--header-surface)" }}
      >
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          placeholder="Search"
          className="hplaceholder h-10 w-full rounded-l-full bg-transparent pl-5 pr-9 text-sm outline-none"
          style={{ color: "var(--header-fg)" }}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="hbtn absolute right-2 grid h-7 w-7 place-items-center rounded-full transition"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <button
        type="button"
        aria-label="Search"
        className="hchip hborder grid w-16 shrink-0 place-items-center rounded-r-full border border-l-0 transition"
      >
        <Search className="h-4 w-4" />
      </button>
    </div>
  );
}

export const VideoCard = memo(function VideoCard({ video }: { video: Video }) {
  const gradient = channelGradient(video.channel_name);
  const initials = channelInitials(video.channel_name);
  return (
    <div className="group flex flex-col text-left">
      <Link
        to="/watch/$videoId"
        params={{ videoId: video.video_id }}
        className="focus:outline-none"
        aria-label={video.title}
      >
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted transition-all sm:rounded-2xl ring-1 ring-border/50 group-hover:ring-foreground/20 focus-visible:ring-2 focus-visible:ring-foreground">
          <Thumbnail
            src={video.thumbnail_url}
            alt={video.title}
            channelName={video.channel_name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />

          {video.is_live && (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-[#FF0033] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white shadow-md">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              Live
            </span>
          )}
          {!video.is_live && video.duration_seconds ? (
            <span className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-black/85 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white shadow-sm">
              {formatDuration(video.duration_seconds)}
            </span>
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover:opacity-100">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-background/95 shadow-lg">
              <svg viewBox="0 0 24 24" className="h-6 w-6 translate-x-0.5 fill-foreground"><path d="M8 5v14l11-7z" /></svg>
            </span>
          </div>
        </div>

      </Link>
      <div className="mt-3">
        <div className="min-w-0 flex-1">
          <Link
            to="/watch/$videoId"
            params={{ videoId: video.video_id }}
            className="block"
          >
            <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-foreground">
              {video.title}
            </h3>
          </Link>
          {(() => {
            const cleanName = (video.channel_name || "").replace(/\s*[-–—·|]\s*Videos\s*$/i, "").trim();
            const rel = video.published_at
              ? publishedTimeAgo(video.published_at)
              : video.added_at
                ? timeAgo(video.added_at)
                : "";
            return (
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                <Link
                  to="/channel/$channelName"
                  params={{ channelName: video.channel_name }}
                  className="transition hover:text-foreground"
                >
                  {cleanName}
                </Link>
                {rel && <span className="text-muted-foreground"> · {rel}</span>}
              </p>
            );
          })()}


        </div>
      </div>

    </div>
  );
});


