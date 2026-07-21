import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ListVideo, Play, Trash2 } from "lucide-react";
import { memo } from "react";
import { type Video } from "@/lib/videos";
import { videosQueryOptions, useAllVideos } from "@/lib/videos-query";
import { useLibrary } from "@/lib/library";
import { SiteHeader } from "./index";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/lib/auth-context";

function PlaylistDetailGate() {
  const { ready, user } = useAuth();
  if (ready && !user) {
    return (
      <>
        <SiteHeader />
        <RequireAuth title="Sign in to view this playlist" message="Playlists are saved to your account. Sign in to view and play them.">
          <div />
        </RequireAuth>
      </>
    );
  }
  return <PlaylistDetailPage />;
}

export const Route = createFileRoute("/library/playlists/$playlistId")({
  component: PlaylistDetailGate,
  loader: ({ context }) => context.queryClient.ensureQueryData(videosQueryOptions),
  head: () => ({
    meta: [
      { title: "Playlist — Spark" },
      { name: "robots", content: "noindex" },
    ],
  }),
  notFoundComponent: PlaylistNotFound,
});

function PlaylistDetailPage() {
  const { playlistId } = Route.useParams();
  const { getPlaylist, removeVideoFromPlaylist, deletePlaylist, hydrated } = useLibrary();
  const allVideos = useAllVideos();

  const playlist = getPlaylist(playlistId);

  if (hydrated && !playlist) {
    throw notFound();
  }

  const items: Video[] = (playlist?.videoIds ?? [])
    .map((id) => allVideos.find((v) => v.video_id === id))
    .filter((v): v is Video => Boolean(v));


  const firstThumb = items[0]?.thumbnail_url;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <Link
          to="/library/playlists"
          className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Playlists</span>
        </Link>

        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-10">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="relative aspect-video w-full bg-muted">
                {firstThumb ? (
                  <img src={firstThumb} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-muted-foreground">
                    <ListVideo className="h-10 w-10" />
                  </div>
                )}
              </div>
              <div className="p-5">
                <h1 className="text-xl font-bold leading-snug tracking-tight sm:text-2xl">
                  {playlist?.name ?? (hydrated ? "Playlist" : "Loading…")}
                </h1>
                <p className="mt-1 text-xs text-muted-foreground">
                  {hydrated ? `${items.length} video${items.length === 1 ? "" : "s"}` : "Loading…"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {items[0] && playlist && (
                    <Link
                      to="/watch/$videoId"
                      params={{ videoId: items[0].video_id }}
                      search={{ list: playlist.id }}
                      className="inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-4 text-sm font-semibold text-background transition hover:opacity-90"
                    >
                      <Play className="h-4 w-4 fill-current" />
                      <span>Play all</span>
                    </Link>
                  )}
                  {playlist && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete playlist "${playlist.name}"?`)) {
                          deletePlaylist(playlist.id);
                        }
                      }}
                      className="inline-flex h-10 items-center gap-2 rounded-full bg-muted px-4 text-sm font-medium text-foreground transition hover:bg-muted/70"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </aside>

          <section className="min-w-0">
            {hydrated && items.length === 0 ? (
              <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-muted">
                  <ListVideo className="h-6 w-6 text-muted-foreground" />
                </div>
                <h2 className="mt-4 text-lg font-semibold">This playlist is empty</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Open any video and hit Save to add it here.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {items.map((v, i) => (
                  <PlaylistRow
                    key={v.video_id}
                    video={v}
                    index={i}
                    playlistId={playlist!.id}
                    onRemove={() => removeVideoFromPlaylist(playlist!.id, v.video_id)}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

const PlaylistRow = memo(function PlaylistRow({
  video,
  index,
  playlistId,
  onRemove,
}: {
  video: Video;
  index: number;
  playlistId: string;
  onRemove: () => void;
}) {
  return (
    <li className="group relative flex items-stretch gap-3 p-3 transition hover:bg-muted/60">
      <span className="grid w-6 shrink-0 place-items-center text-xs font-medium text-muted-foreground">
        {index + 1}
      </span>
      <Link
        to="/watch/$videoId"
        params={{ videoId: video.video_id }}
        search={{ list: playlistId }}
        className="flex min-w-0 flex-1 items-start gap-3"
      >
        <div className="relative aspect-video w-40 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border/50">
          <img src={video.thumbnail_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1 py-1">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{video.title}</h3>
          <p className="mt-1 truncate text-xs text-muted-foreground">{video.channel_name}</p>
        </div>
      </Link>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove from playlist"
        className="grid h-9 w-9 shrink-0 place-items-center self-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
});

function PlaylistNotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Playlist not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This playlist doesn't exist or was removed.
        </p>
        <Link
          to="/library/playlists"
          className="mt-6 inline-flex items-center rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
        >
          Back to Playlists
        </Link>
      </main>
    </div>
  );
}
