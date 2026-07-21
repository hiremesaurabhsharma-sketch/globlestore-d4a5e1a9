import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getAuthClient, type Session, type User } from "./auth-client";
import type { SupabaseClient } from "@supabase/supabase-js";

type AuthState = {
  ready: boolean;
  user: User | null;
  session: Session | null;
  client: SupabaseClient | null;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithPassword: (email: string, password: string, name?: string) => Promise<{ error: string | null; needsConfirm: boolean }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let sub: { unsubscribe: () => void } | null = null;
    let cancelled = false;
    (async () => {
      try {
        const c = await getAuthClient();
        if (cancelled) return;
        setClient(c);
        const { data } = await c.auth.getSession();
        if (cancelled) return;
        setSession(data.session ?? null);
        const s = c.auth.onAuthStateChange((_evt, newSession) => {
          setSession(newSession ?? null);
        });
        sub = s.data.subscription;
      } catch (e) {
        console.warn("[auth] init failed", e);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
      sub?.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(() => ({
    ready,
    client,
    session,
    user: session?.user ?? null,
    async signInWithPassword(email, password) {
      if (!client) return { error: "Auth loading, try again in a moment." };
      const { error } = await client.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    async signUpWithPassword(email, password, name) {
      if (!client) return { error: "Auth loading, try again in a moment.", needsConfirm: false };
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
          data: name ? { full_name: name } : undefined,
        },
      });
      return { error: error?.message ?? null, needsConfirm: !data.session };
    },
    async signInWithGoogle() {
      if (!client) return { error: "Auth loading, try again in a moment." };
      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
      return { error: error?.message ?? null };
    },
    async signInWithMagicLink(email) {
      if (!client) return { error: "Auth loading, try again in a moment." };
      const { error } = await client.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
      return { error: error?.message ?? null };
    },
    async signOut() {
      if (!client) return;
      await client.auth.signOut();
    },
  }), [client, session, ready]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function displayName(user: User | null): string {
  if (!user) return "Guest";
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const name = (meta.full_name as string) || (meta.name as string) || user.email?.split("@")[0];
  return name || "You";
}

export function initialFor(user: User | null, fallback = "G"): string {
  const n = displayName(user);
  return (n[0] ?? fallback).toUpperCase();
}
