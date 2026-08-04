import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env, then restart the dev server."
  );
}

export const supabase = createClient(url, anonKey);

// Exposed for the XHR upload path, which talks to the Storage REST endpoint
// directly to get progress events the JS client doesn't provide.
export const SUPABASE_URL = url;
export const SUPABASE_ANON_KEY = anonKey;
