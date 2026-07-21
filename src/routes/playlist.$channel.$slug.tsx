import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ListVideo, Play } from "lucide-react";
import { useMemo } from "react";
import { useAllVideos } from "@/lib/videos-query";
import { channelPlaylists, seriesListId, slugify } from "@/lib/playlists";
import { channelGradient, channelInitials } from "@/lib/channel";
import { SiteHeader } from "./index";

export const Route = createFileRoute("/playlist/$channel/$slug")({
  component: PlaylistPage,
  head: ({ params }) => ({
    meta: [
      { title: `${decodeURIComponent(params.channel)} playlist — Spark` },
      {
        name: "description",
        content: `Watch the ${decodeURIComponent(params.slug).replace(/-/g, " ")} playlist by ${decodeURIComponent(params.channel)} in sequence on Spark.`,
      },
      { name: "robots", content: "index,follow" },
    ],
  }),
});

function PlaylistPage() {
  const { channel, slug } = Route.useParams();
  const decodedChannel = decodeURIComponent(channel);
  const all = useAllVideos();

  const playlist = useMemo(() => {
    // Match by channel slug so channel names with spaces/case work.
    const channelSlug = slugify(decodedChannel);
    const channelVideos = all.filter(
      (v) => slugify(v.channel_name) === channelSlug,
    );
    const found = channelPlaylists(channelVideos, 1).find((p) => p.slug === slug);
    return found ?? null;
  }, [all, decodedChannel, slug]);

  if (!playlist) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="text-xl font-semibold">Playlist not available</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This playlist may not have any videos yet.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background"
          >
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
        </main>
      </div>
    );
  }

  const items = playlist.items;
  const first = items[0];
  const listParam = seriesListId(decodedChannel, slug);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          {/* Left: playlist header */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <div className="relative aspect-video overflow-hidden">
                <img
                  src={first.thumbnail_url}
                  alt={playlist.name}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 p-4 text-white">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide opacity-90">
                      <ListVideo className="h-3.5 w-3.5" /> Playlist
                    </div>
                    <div className="mt-1 text-lg font-bold">{items.length} videos</div>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <h1 className="line-clamp-2 text-lg font-bold leading-tight">
                  {playlist.name}
                </h1>
                <Link
                  to="/channel/$channelName"
                  params={{ channelName: decodedChannel }}
                  className="mt-2 flex items-center gap-2 text-sm text-muted-foreground hover:underline"
                >
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-to-br ${channelGradient(decodedChannel)} text-[10px] font-bold text-white`}
                  >
                    {channelInitials(decodedChannel)}
                  </span>
                  <span className="truncate">{decodedChannel}</span>
                </Link>

                <Link
                  to="/watch/$videoId"
                  params={{ videoId: first.video_id }}
                  search={{ list: listParam }}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FF0033] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  <Play className="h-4 w-4 fill-white" /> Play all
                </Link>
              </div>
            </div>
          </aside>

          {/* Right: sequential list */}
          <section>
            <ol className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card">
              {items.map((v, i) => (
                <li key={v.video_id}>
                  <Link
                    to="/watch/$videoId"
                    params={{ videoId: v.video_id }}
                    search={{ list: listParam }}
                    className="group flex items-start gap-3 p-3 transition hover:bg-muted/50"
                  >
                    <span className="w-6 shrink-0 pt-2 text-center text-xs font-medium text-muted-foreground">
                      {i + 1}
                    </span>
                    <div className="relative aspect-video w-40 shrink-0 overflow-hidden rounded-lg bg-muted sm:w-44">
                      <img
                        src={v.thumbnail_url}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-sm font-semibold leading-snug">
                        {v.title}
                      </div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        {v.channel_name}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </main>
    </div>
  );
}
