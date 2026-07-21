import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ListVideo, Play } from "lucide-react";
import { videosQueryOptions, useAllVideos } from "@/lib/videos-query";
import { useLibrary } from "@/lib/library";
import { SiteHeader } from "./index";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/lib/auth-context";

function PlaylistsGate() {
  const { ready, user } = useAuth();
  if (ready && !user) {
    return (
      <>
        <SiteHeader />
        <RequireAuth title="Sign in to see your Playlists" message="Your playlists are saved to your account. Sign in to view and manage them.">
          <div />
        </RequireAuth>
      </>
    );
  }
  return <PlaylistsPage />;
}

export const Route = createFileRoute("/library/playlists")({
  component: PlaylistsGate,
  loader: ({ context }) => context.queryClient.ensureQueryData(videosQueryOptions),
  head: () => ({
    meta: [
      { title: "My Playlists — Spark" },
      { name: "description", content: "Your playlists on Spark." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function PlaylistsPage() {
  const { playlists, hydrated } = useLibrary();
  const allVideos = useAllVideos();


  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Home</span>
        </Link>

        <div className="mt-4 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 text-white">
            <ListVideo className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My Playlists</h1>
            <p className="text-sm text-muted-foreground">
              {hydrated ? `${playlists.length} playlist${playlists.length === 1 ? "" : "s"}` : "Loading…"}
            </p>
          </div>
        </div>

        <div className="mt-8">
          {hydrated && playlists.length === 0 ? (
            <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-muted">
                <ListVideo className="h-6 w-6 text-muted-foreground" />
              </div>
              <h2 className="mt-4 text-lg font-semibold">No playlists yet</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Save a video and create a new playlist from the watch page.
              </p>
              <Link
                to="/"
                className="mt-6 inline-flex items-center rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
              >
                Browse videos
              </Link>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {playlists.map((pl) => {
                const first = pl.videoIds
                  .map((id) => allVideos.find((v) => v.video_id === id))
                  .find(Boolean);
                return (
                  <li key={pl.id}>
                    <Link
                      to="/library/playlists/$playlistId"
                      params={{ playlistId: pl.id }}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition hover:border-foreground/30"
                    >
                      <div className="relative aspect-video w-full overflow-hidden bg-muted">
                        {first ? (
                          <img
                            src={first.thumbnail_url}
                            alt=""
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-muted-foreground">
                            <ListVideo className="h-8 w-8" />
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-black/70 px-3 py-2 text-xs font-medium text-white">
                          <Play className="h-3.5 w-3.5 fill-current" />
                          <span>{pl.videoIds.length} video{pl.videoIds.length === 1 ? "" : "s"}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 p-4">
                        <h3 className="line-clamp-1 text-base font-semibold">{pl.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          Updated {new Date(pl.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
