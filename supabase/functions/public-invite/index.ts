import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "GET") return json({ error: "Metode tidak didukung." }, 405);

  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return json({ error: "Tautan undangan tidak valid." }, 400);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Layanan undangan belum dikonfigurasi." }, 503);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.from("guests").select("name").eq("slug", slug).maybeSingle();
  if (error) return json({ error: "Undangan belum dapat dimuat. Silakan coba lagi." }, 500);
  if (!data) return json({ error: "Tautan undangan tidak ditemukan." }, 404);
  return json({ name: data.name });
});
