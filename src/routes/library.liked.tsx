import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ThumbsUp } from "lucide-react";
import { type Video } from "@/lib/videos";
import { videosQueryOptions, useAllVideos } from "@/lib/videos-query";
import { useLibrary } from "@/lib/library";
import { SiteHeader, VideoCard } from "./index";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/lib/auth-context";

function LikedGate() {
  const { ready, user } = useAuth();
  if (ready && !user) {
    return (
      <>
        <SiteHeader />
        <RequireAuth title="Sign in to see Liked Videos" message="Your liked videos are saved to your account. Sign in to view them here.">
          <div />
        </RequireAuth>
      </>
    );
  }
  return <LikedVideosPage />;
}

export const Route = createFileRoute("/library/liked")({
  component: LikedGate,
  loader: ({ context }) => context.queryClient.ensureQueryData(videosQueryOptions),
  head: () => ({
    meta: [
      { title: "Liked Videos — Spark" },
      { name: "description", content: "Videos you've liked on Spark." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function LikedVideosPage() {
  const { liked, hydrated } = useLibrary();
  const allVideos = useAllVideos();
  const likedVideos = liked
    .map((id) => allVideos.find((v) => v.video_id === id))
    .filter((v): v is Video => Boolean(v));


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
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-rose-500 to-fuchsia-600 text-white">
            <ThumbsUp className="h-5 w-5 fill-current" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Liked Videos</h1>
            <p className="text-sm text-muted-foreground">
              {hydrated ? `${likedVideos.length} video${likedVideos.length === 1 ? "" : "s"}` : "Loading…"}
            </p>
          </div>
        </div>

        <div className="mt-8">
          {hydrated && likedVideos.length === 0 ? (
            <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-muted">
                <ThumbsUp className="h-6 w-6 text-muted-foreground" />
              </div>
              <h2 className="mt-4 text-lg font-semibold">No liked videos yet</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Tap the thumbs-up on any video to save it here.
              </p>
              <Link
                to="/"
                className="mt-6 inline-flex items-center rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
              >
                Browse videos
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {likedVideos.map((v) => (
                <VideoCard key={v.video_id} video={v} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
