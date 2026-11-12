const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabaseConfigured = Boolean(url && anonKey);

export function functionsUrl(functionName: string): string {
  if (!url) throw new Error("VITE_SUPABASE_URL belum dikonfigurasi.");
  return `${url.replace(/\/$/, "")}/functions/v1/${functionName}`;
}
