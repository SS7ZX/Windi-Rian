export async function lookupInvite(slug: string): Promise<string> {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) throw new Error("Layanan undangan personal belum dikonfigurasi.");
  const response = await fetch(`${url.replace(/\/$/, "")}/functions/v1/public-invite?slug=${encodeURIComponent(slug)}`, {
    headers: { apikey: anonKey },
  });
  const result = await response.json().catch(() => ({})) as { name?: string; error?: string };
  if (!response.ok || !result.name) throw new Error(result.error || "Undangan tidak dapat dimuat.");
  return result.name;
}
