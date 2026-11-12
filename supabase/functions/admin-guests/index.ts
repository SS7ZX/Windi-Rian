import { createClient } from "npm:@supabase/supabase-js@2";
import { authorizeAdmin, bearerToken } from "../_shared/admin-auth.ts";
import { adminCorsHeaders, isAllowedOrigin } from "../_shared/admin-cors.ts";
import { createGuestRecord, deleteGuestRecord, updateGuestRecord, type GuestRepository } from "../_shared/guest-operations.ts";
import { GuestValidationError } from "../_shared/guest-validation.ts";

function json(request: Request, body: unknown, status = 200): Response {
  const appOrigins = Deno.env.get("APP_ORIGINS") ?? "";
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...adminCorsHeaders(request, appOrigins), "Content-Type": "application/json" },
  });
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new GuestValidationError("Isi permintaan tidak berupa JSON yang valid.");
  }
}

Deno.serve(async request => {
  const appOrigins = Deno.env.get("APP_ORIGINS") ?? "";
  if (!isAllowedOrigin(request, appOrigins)) return json(request, { error: "Origin tidak diizinkan." }, 403);
  if (request.method === "OPTIONS") return new Response("ok", { headers: adminCorsHeaders(request, appOrigins) });
  if (!bearerToken(request)) return json(request, { error: "Sesi admin diperlukan." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const sessionSecret = Deno.env.get("ADMIN_SESSION_SECRET") ?? "";
  if (!supabaseUrl || !serviceRoleKey || sessionSecret.length < 32) {
    return json(request, { error: "Konfigurasi Supabase server belum lengkap." }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  let authorized: boolean;
  try {
    authorized = await authorizeAdmin(request, sessionSecret);
  } catch {
    return json(request, { error: "Sesi admin tidak dapat diverifikasi. Silakan coba lagi." }, 503);
  }
  if (!authorized) return json(request, { error: "Sesi admin tidak valid atau sudah berakhir. Silakan masuk kembali." }, 401);

  const guestRepository: GuestRepository<Record<string, unknown>> = {
    insert: async guest => {
      const { data, error } = await supabase.from("guests").insert(guest)
        .select("id,name,phone,relation,category,internal_note,slug,rsvp_status,party_size,wishes,whatsapp_status,whatsapp_opened_at,created_at,updated_at")
        .single();
      return { data, error };
    },
    update: async (id, guest) => {
      const { data, error } = await supabase.from("guests").update({ ...guest, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("id,name,phone,relation,category,internal_note,slug,rsvp_status,party_size,wishes,whatsapp_status,whatsapp_opened_at,created_at,updated_at")
        .single();
      return { data, error };
    },
    delete: async id => {
      const { error } = await supabase.from("guests").delete().eq("id", id).select("id").single();
      return { error };
    },
  };

  try {
    if (request.method === "GET") {
      const { data, error } = await supabase.from("guests")
        .select("id,name,phone,relation,category,internal_note,slug,rsvp_status,party_size,wishes,whatsapp_status,whatsapp_opened_at,created_at,updated_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json(request, { guests: data });
    }

    if (request.method === "POST") {
      const body = await readJson(request) as Record<string, unknown> | null;
      if (body?.action === "manual_whatsapp_opened") {
        if (typeof body.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id)) {
          return json(request, { error: "ID tamu tidak valid." }, 400);
        }
        const { data, error } = await supabase.from("guests")
          .update({ whatsapp_status: "opened_manual", whatsapp_opened_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", body.id).select("id,whatsapp_status,whatsapp_opened_at").single();
        if (error?.code === "PGRST116") return json(request, { error: "Data tamu tidak ditemukan." }, 404);
        if (error) throw error;
        return json(request, { guest: data });
      }

      const { data, error } = await createGuestRecord(guestRepository, body);
      if (error) {
        if (error.code === "23505") return json(request, { error: "Slug tamu bentrok. Silakan coba simpan lagi." }, 409);
        throw error;
      }
      return json(request, { guest: data }, 201);
    }

    if (request.method === "PATCH") {
      const body = await readJson(request) as Record<string, unknown> | null;
      if (typeof body?.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id)) {
        return json(request, { error: "ID tamu tidak valid." }, 400);
      }
      const { data, error } = await updateGuestRecord(guestRepository, body.id, body);
      if (error) {
        if (error.code === "23505") return json(request, { error: "Perubahan bertabrakan dengan data lain." }, 409);
        if (error.code === "PGRST116") return json(request, { error: "Data tamu tidak ditemukan." }, 404);
        throw error;
      }
      return json(request, { guest: data });
    }

    if (request.method === "DELETE") {
      const body = await readJson(request) as Record<string, unknown> | null;
      if (typeof body?.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id)) {
        return json(request, { error: "ID tamu tidak valid." }, 400);
      }
      const { error } = await deleteGuestRecord(guestRepository, body.id);
      if (error?.code === "PGRST116") return json(request, { error: "Data tamu tidak ditemukan." }, 404);
      if (error) throw error;
      return json(request, { success: true });
    }

    return json(request, { error: "Metode tidak didukung." }, 405);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan saat mengakses data tamu.";
    if (error instanceof GuestValidationError) return json(request, { error: message }, 400);
    return json(request, { error: message }, 500);
  }
});
