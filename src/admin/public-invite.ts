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

export type RsvpChoice = "attending" | "declined";

export async function submitGuestResponse(
  slug: string,
  rsvpStatus: RsvpChoice | "",
  partySize: number,
  message: string,
): Promise<void> {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) throw new Error("Layanan konfirmasi dan pesan belum dikonfigurasi.");
  const response = await fetch(`${url.replace(/\/$/, "")}/functions/v1/public-invite`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({ slug, rsvp_status: rsvpStatus || null, party_size: partySize, message }),
  });
  const result = await response.json().catch(() => ({})) as { success?: boolean; error?: string };
  if (!response.ok || result.success !== true) {
    throw new Error(result.error || `Konfirmasi/pesan gagal disimpan (${response.status}).`);
  }
}
