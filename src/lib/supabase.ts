import { createClient } from "@supabase/supabase-js";

// Public (publishable) credentials — safe to ship to the client.
const SUPABASE_URL = "https://sysxryxguqjjwqdydmkd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_zJsY2l-NP38i15X8QymP7A_J2kUzbbb";

// New-format `sb_*` keys are opaque, not JWTs. PostgREST rejects them when
// sent as a bearer token ("Expected 3 parts in JWT; got 1"), so strip the
// default Authorization header and send them only via the `apikey` header.
const patchedFetch: typeof fetch = (input, init) => {
  const h = new Headers(init?.headers);
  if (h.get("Authorization") === `Bearer ${SUPABASE_PUBLISHABLE_KEY}`) {
    h.delete("Authorization");
  }
  h.set("apikey", SUPABASE_PUBLISHABLE_KEY);
  return fetch(input, { ...init, headers: h });
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: patchedFetch },
});

export const VIDEOS_TABLE = "videos";
