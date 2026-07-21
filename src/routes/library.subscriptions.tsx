import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Users } from "lucide-react";
import { useLibrary } from "@/lib/library";
import { channelGradient, channelInitials } from "@/lib/channel";
import { SiteHeader } from "./index";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/lib/auth-context";

function SubscriptionsGate() {
  const { ready, user } = useAuth();
  if (ready && !user) {
    return (
      <>
        <SiteHeader />
        <RequireAuth title="Sign in to see your Subscriptions" message="Your subscriptions are saved to your account. Sign in to view the channels you follow.">
          <div />
        </RequireAuth>
      </>
    );
  }
  return <SubscriptionsPage />;
}

export const Route = createFileRoute("/library/subscriptions")({
  component: SubscriptionsGate,
  head: () => ({
    meta: [
      { title: "Subscriptions — Spark" },
      { name: "description", content: "Channels you have subscribed to on Spark." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function SubscriptionsPage() {
  const { subscriptions, hydrated } = useLibrary();

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
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 text-white">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Subscriptions</h1>
            <p className="text-sm text-muted-foreground">
              {hydrated ? `${subscriptions.length} channel${subscriptions.length === 1 ? "" : "s"}` : "Loading…"}
            </p>
          </div>
        </div>

        <div className="mt-8">
          {hydrated && subscriptions.length === 0 ? (
            <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-muted">
                <Users className="h-6 w-6 text-muted-foreground" />
              </div>
              <h2 className="mt-4 text-lg font-semibold">No subscriptions yet</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Subscribe to a channel from any watch page to see it here.
              </p>
              <Link
                to="/"
                className="mt-6 inline-flex items-center rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
              >
                Browse videos
              </Link>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {subscriptions.map((name) => {
                const gradient = channelGradient(name);
                return (
                  <li key={name}>
                    <Link
                      to="/channel/$channelName"
                      params={{ channelName: name }}
                      className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition hover:border-foreground/30"
                    >
                      <span
                        className={`grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br ${gradient} text-lg font-bold text-white`}
                      >
                        {channelInitials(name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold">{name}</p>
                        <p className="text-xs text-muted-foreground">View channel</p>
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
