import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff, Loader2, Mail, Lock, User as UserIcon, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { BrandLogo } from "@/components/brand-logo";

type Mode = "signin" | "signup" | "magic";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in — Spark" },
      { name: "description", content: "Sign in or create your Spark account to save videos, follow channels, and sync your progress." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const { user, ready, signInWithPassword, signUpWithPassword, signInWithMagicLink } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState<null | "email">(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (ready && user) navigate({ to: "/" });
  }, [ready, user, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading("email");
    try {
      if (mode === "signin") {
        const { error } = await signInWithPassword(email, password);
        if (error) setError(error);
      } else if (mode === "signup") {
        const { error, needsConfirm } = await signUpWithPassword(email, password, name || undefined);
        if (error) setError(error);
        else if (needsConfirm) setSuccess("Check your inbox — confirm your email to finish creating your account.");
      } else {
        const { error } = await signInWithMagicLink(email);
        if (error) setError(error);
        else setSuccess("Magic link sent — check your email to sign in.");
      }
    } finally {
      setLoading(null);
    }
  }




  const title =
    mode === "signin" ? "Welcome back" : mode === "signup" ? "Create your account" : "Sign in with a link";
  const subtitle =
    mode === "signin"
      ? "Sign in to sync your library across devices."
      : mode === "signup"
      ? "It only takes a moment. No spam, ever."
      : "We'll email you a one-tap sign-in link.";

  return (
    <div className="auth-shell relative min-h-[100dvh] w-full overflow-hidden">
      {/* Ambient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 auth-bg" />
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full auth-blob-a blur-3xl opacity-70" />
        <div className="absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full auth-blob-b blur-3xl opacity-70" />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-5 py-4 sm:px-8">
        <button
          type="button"
          onClick={() => router.history.length > 1 ? router.history.back() : navigate({ to: "/" })}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm auth-back"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>
        <Link to="/" className="flex items-center gap-2 opacity-95">
          <BrandLogo size={22} />
        </Link>
        <div className="w-16" />
      </div>

      {/* Card */}
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col items-stretch px-5 pb-24 pt-6 sm:pt-10">
        <div className="auth-card overflow-hidden rounded-[26px] p-6 sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-[26px] font-semibold tracking-tight sm:text-[30px]">{title}</h1>
            <p className="mt-1.5 text-sm auth-muted">{subtitle}</p>
          </div>




          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            {mode === "signup" && (
              <Field icon={<UserIcon className="h-4 w-4" />}>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name (optional)"
                  autoComplete="name"
                  className="auth-input h-12 w-full bg-transparent pl-11 pr-4 text-[15px] outline-none"
                />
              </Field>
            )}

            <Field icon={<Mail className="h-4 w-4" />}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                autoComplete="email"
                required
                className="auth-input h-12 w-full bg-transparent pl-11 pr-4 text-[15px] outline-none"
              />
            </Field>

            {mode !== "magic" && (
              <Field icon={<Lock className="h-4 w-4" />}>
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  required
                  minLength={6}
                  className="auth-input h-12 w-full bg-transparent pl-11 pr-11 text-[15px] outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-full auth-eye"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </Field>
            )}

            {error && (
              <div className="rounded-xl px-3 py-2 text-sm auth-error">{error}</div>
            )}
            {success && (
              <div className="flex items-start gap-2 rounded-xl px-3 py-2 text-sm auth-success">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading !== null}
              className="auth-primary mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold transition disabled:opacity-60"
            >
              {loading === "email" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span>
                  {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send magic link"}
                </span>
              )}
            </button>

            {mode !== "magic" && (
              <button
                type="button"
                onClick={() => { setMode("magic"); setError(null); setSuccess(null); }}
                className="mt-1 text-center text-[13px] font-medium auth-link"
              >
                Or email me a sign-in link
              </button>
            )}
            {mode === "magic" && (
              <button
                type="button"
                onClick={() => { setMode("signin"); setError(null); setSuccess(null); }}
                className="mt-1 text-center text-[13px] font-medium auth-link"
              >
                Use password instead
              </button>
            )}
          </form>

          <div className="mt-6 text-center text-sm auth-muted">
            {mode === "signup" ? (
              <>
                Already have an account?{" "}
                <button className="auth-link font-semibold" onClick={() => { setMode("signin"); setError(null); setSuccess(null); }}>
                  Sign in
                </button>
              </>
            ) : (
              <>
                New here?{" "}
                <button className="auth-link font-semibold" onClick={() => { setMode("signup"); setError(null); setSuccess(null); }}>
                  Create an account
                </button>
              </>
            )}
          </div>
        </div>

        <p className="mt-5 text-center text-[12px] leading-relaxed auth-muted">
          You can keep browsing as a guest anytime.
          <br />
          By continuing you agree to our friendly, distraction-free experience.
        </p>

        <div className="mt-4 text-center">
          <Link to="/" className="text-[13px] font-medium auth-link">
            Continue as guest →
          </Link>
        </div>
      </div>
    </div>
  );
}

function Field({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="auth-field relative block w-full rounded-2xl">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 auth-icon">{icon}</span>
      {children}
    </label>
  );
}



