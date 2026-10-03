import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.NEXT_PUBLIC_SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
const configuredAuthMode = import.meta.env.NEXT_PUBLIC_SUPABASE_AUTH_REQUIRED ?? import.meta.env.VITE_SUPABASE_AUTH_REQUIRED;

export const supabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);
// Production must fail closed. A public role switcher is available only when a
// deployment explicitly opts out with NEXT_PUBLIC_SUPABASE_AUTH_REQUIRED=false.
export const supabaseAuthRequired = configuredAuthMode === "true" || (configuredAuthMode === undefined && import.meta.env.PROD);

export const supabase = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
