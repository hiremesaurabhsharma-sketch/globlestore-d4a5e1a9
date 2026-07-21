import { Link } from "@tanstack/react-router";
import { Lock, LogIn } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";

type Props = {
  title?: string;
  message?: string;
  children: ReactNode;
};

/**
 * Wraps a protected surface. Guests browsing the site are shown a
 * gentle sign-in prompt only when they try to access private data
 * (Liked Videos, Playlists, Subscriptions). Actions elsewhere on the
 * app continue to work without login.
 */
export function RequireAuth({ title, message, children }: Props) {
  const { ready, user } = useAuth();

  if (!ready) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent opacity-60" />
      </div>
    );
  }

  if (user) return <>{children}</>;

  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <div className="auth-card w-full max-w-md rounded-3xl p-8 text-center">
        <div
          className="mx-auto grid h-14 w-14 place-items-center rounded-2xl"
          style={{ backgroundImage: "var(--brand-gradient)", color: "var(--brand-foreground)" }}
        >
          <Lock className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-xl font-semibold tracking-tight">
          {title ?? "Sign in required"}
        </h1>
        <p className="auth-muted mt-2 text-sm">
          {message ??
            "Please sign in to access this section. Your videos, playlists and subscriptions live safely on your account."}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            to="/auth"
            className="auth-primary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
          >
            <LogIn className="h-4 w-4" />
            Sign in to continue
          </Link>
          <Link
            to="/"
            className="auth-back inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-medium"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
