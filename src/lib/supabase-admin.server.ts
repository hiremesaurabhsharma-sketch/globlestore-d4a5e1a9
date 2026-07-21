import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service role key. RLS is bypassed.
 * Use only in server functions and public API routes for privileged writes
 * (video ingestion, tracked_channels management).
 */
export function getSupabaseAdmin() {
  const url = "https://sysxryxguqjjwqdydmkd.supabase.co";
  const key = process.env.SB_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SB_SERVICE_ROLE_KEY is not set. Add it via the secrets tool to enable YouTube sync."
    );
  }
  const patchedFetch: typeof fetch = (input, init) => {
    const h = new Headers(init?.headers);
    // New-format sb_secret_* keys are opaque, not JWTs.
    if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
      h.delete("Authorization");
    }
    h.set("apikey", key);
    return fetch(input, { ...init, headers: h });
  };
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: patchedFetch },
  });
}
