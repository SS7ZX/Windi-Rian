import { createClient } from "npm:@supabase/supabase-js@2";
import { GuestValidationError, validatePublicGuestSubmission } from "../_shared/guest-validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "Metode tidak didukung." }, 405);

  let submission: ReturnType<typeof validatePublicGuestSubmission> | null = null;
  let slug = new URL(request.url).searchParams.get("slug") ?? "";
  if (request.method === "POST") {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 4096) return json({ error: "Isi permintaan terlalu besar." }, 413);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Isi permintaan tidak valid." }, 400);
    }
    try {
      submission = validatePublicGuestSubmission(body);
      slug = submission.slug;
    } catch (error) {
      if (error instanceof GuestValidationError) return json({ error: error.message }, 400);
      throw error;
    }
  } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return json({ error: "Tautan undangan tidak valid." }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Layanan undangan belum dikonfigurasi." }, 503);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  if (submission) {
    const { data, error } = await supabase.rpc("submit_guest_response", {
      p_slug: submission.slug,
      p_rsvp_status: submission.rsvp_status,
      p_party_size: submission.party_size,
      p_message: submission.message,
    });
    if (error?.code === "P0001" && error.message.includes("Tunggu sebentar")) {
      return json({ error: error.message }, 429);
    }
    if (error?.code === "22023") return json({ error: error.message }, 400);
    if (error) return json({ error: "Konfirmasi/pesan gagal disimpan. Silakan coba lagi." }, 500);
    if (data !== true) return json({ error: "Tautan undangan tidak ditemukan." }, 404);
    return json({ success: true, rsvp_status: submission.rsvp_status, party_size: submission.party_size }, 201);
  }

  const { data, error } = await supabase.from("guests").select("name").eq("slug", slug).maybeSingle();
  if (error) return json({ error: "Undangan belum dapat dimuat. Silakan coba lagi." }, 500);
  if (!data) return json({ error: "Tautan undangan tidak ditemukan." }, 404);
  return json({ name: data.name });
});
