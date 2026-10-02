export type SupabaseReadiness = "checking" | "unconfigured" | "schema_missing" | "ready" | "unreachable";

const projectUrl = (import.meta.env.NEXT_PUBLIC_SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const publishableKey = import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const hasSupabaseBrowserConfig = Boolean(projectUrl && publishableKey);

export async function checkSupabaseReadiness(signal?: AbortSignal): Promise<SupabaseReadiness> {
  if (!hasSupabaseBrowserConfig) return "unconfigured";

  try {
    const response = await fetch(`${projectUrl}/rest/v1/incidents?select=id&limit=1`, {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
      },
      signal,
    });

    if (response.ok) return "ready";
    if (response.status === 404) return "schema_missing";
    return "unreachable";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return "unreachable";
  }
}
