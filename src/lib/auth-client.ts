import { createClient, type SupabaseClient, type Session, type User } from "@supabase/supabase-js";

// New-format `sb_publishable_*` keys are opaque, not JWTs — PostgREST rejects
// them when sent as bearer. Strip the default Authorization header and only
// send them as `apikey`. GoTrue (auth) tolerates either, so this is safe.
function makePatchedFetch(publishableKey: string): typeof fetch {
  return (input, init) => {
    const h = new Headers(init?.headers);
    if (h.get("Authorization") === `Bearer ${publishableKey}`) {
      h.delete("Authorization");
    }
    h.set("apikey", publishableKey);
    return fetch(input, { ...init, headers: h });
  };
}

// Publishable creds are safe to ship in the browser bundle. They act as a
// fallback whenever /api/public/auth-config is unreachable (e.g. certain
// preview subdomains apply a platform-level auth gate that 302-redirects
// /api/public/*, causing the client fetch to fail).
const FALLBACK_URL = "https://jgycympeypcanifwkxur.supabase.co";
const FALLBACK_KEY = "sb_publishable_fNQHipRQz0J7Na9Qv_hSVw_339nUm3a";

let clientPromise: Promise<SupabaseClient> | null = null;

export function getAuthClient(): Promise<SupabaseClient> {
  if (clientPromise) return clientPromise;
  clientPromise = (async () => {
    let url = FALLBACK_URL;
    let publishableKey = FALLBACK_KEY;
    try {
      const res = await fetch("/api/public/auth-config", { credentials: "omit" });
      if (res.ok) {
        const j = (await res.json()) as { url?: string; publishableKey?: string };
        if (j.url && j.publishableKey) {
          url = j.url;
          publishableKey = j.publishableKey;
        }
      }
    } catch {
      // fall back to hardcoded publishable creds
    }
    return createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "globletube-auth",
      },
      global: { fetch: makePatchedFetch(publishableKey) },
    });
  })();
  return clientPromise;
}

export type { Session, User };
