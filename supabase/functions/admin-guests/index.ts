import { createClient } from "npm:@supabase/supabase-js@2";
import { authorizeAdmin, bearerToken } from "../_shared/admin-auth.ts";
import { adminCorsHeaders, isAllowedOrigin } from "../_shared/admin-cors.ts";
import { createGuestRecord, deleteGuestRecord, prepareGuestBatch, updateGuestRecord, type GuestRepository } from "../_shared/guest-operations.ts";
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
  if (Number(request.headers.get("content-length") ?? 0) > 2_500_000) {
    return json(request, { error: "Ukuran permintaan terlalu besar." }, 413);
  }

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
      if (new URL(request.url).searchParams.get("resource") === "messages") {
        const { data, error } = await supabase.from("guest_messages")
          .select("id,guest_id,message,read_at,created_at,guest:guests!inner(name,phone,slug)")
          .order("created_at", { ascending: false })
          .limit(500);
        if (error) throw error;
        return json(request, { messages: data });
      }

      const { data, error } = await supabase.from("guests")
        .select("id,name,phone,relation,category,internal_note,slug,rsvp_status,party_size,wishes,whatsapp_status,whatsapp_opened_at,created_at,updated_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json(request, { guests: data });
    }

    if (request.method === "POST") {
      const body = await readJson(request) as Record<string, unknown> | null;
      if (body?.action === "mark_message_read") {
        if (typeof body.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id)) {
          return json(request, { error: "ID pesan tidak valid." }, 400);
        }
        const { data, error } = await supabase.from("guest_messages")
          .update({ read_at: new Date().toISOString() })
          .eq("id", body.id)
          .is("read_at", null)
          .select("id,read_at")
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          const { data: existing, error: existingError } = await supabase.from("guest_messages")
            .select("id,read_at").eq("id", body.id).maybeSingle();
          if (existingError) throw existingError;
          if (!existing) return json(request, { error: "Pesan tidak ditemukan." }, 404);
          return json(request, { message: existing });
        }
        return json(request, { message: data });
      }

      if (body?.action === "bulk_create") {
        const { rows: validRows, results } = prepareGuestBatch(body.guests);

        if (validRows.length) {
          const { data, error } = await supabase.from("guests")
            .insert(validRows.map(row => row.guest))
            .select("id,name,phone,relation,category,internal_note,slug,rsvp_status,party_size,wishes,whatsapp_status,whatsapp_opened_at,created_at,updated_at");
          if (error) {
            const message = error.code === "23505"
              ? "Data bentrok dengan tamu yang sudah ada. Periksa kembali lalu coba impor lagi."
              : "Database gagal menyimpan baris impor. Tidak ada baris valid dari batch ini yang disimpan.";
            for (const row of validRows) {
              const result = results[row.index];
              if (result) result.error = message;
            }
          } else {
            const guestsBySlug = new Map((data ?? []).map(guest => [String(guest.slug), guest]));
            for (const row of validRows) {
              const guest = guestsBySlug.get(String(row.guest.slug));
              const result = results[row.index];
              if (guest && result) Object.assign(result, { guest });
              else if (result) result.error = "Penyimpanan belum dapat diverifikasi. Muat ulang daftar sebelum mengulang impor.";
            }
          }
        }
        return json(request, { results });
      }

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
