import { createClient } from "npm:@supabase/supabase-js@2";
import { adminCorsHeaders, isAllowedOrigin } from "../_shared/admin-cors.ts";
import { createAdminSession, isValidAdminPasswordHash, verifyAdminPassword } from "../_shared/admin-auth.ts";
import { clientIp, loginRateLimitKey } from "../_shared/login-rate-limit.ts";

function json(request: Request, body: unknown, status = 200): Response {
  const appOrigins = Deno.env.get("APP_ORIGINS") ?? "";
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...adminCorsHeaders(request, appOrigins), "Content-Type": "application/json" },
  });
}

Deno.serve(async request => {
  const appOrigins = Deno.env.get("APP_ORIGINS") ?? "";
  if (!isAllowedOrigin(request, appOrigins)) return json(request, { error: "Origin tidak diizinkan." }, 403);
  if (request.method === "OPTIONS") return new Response("ok", { headers: adminCorsHeaders(request, appOrigins) });
  if (request.method !== "POST") return json(request, { error: "Metode tidak didukung." }, 405);
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 4096) return json(request, { error: "Isi permintaan terlalu besar." }, 413);

  const username = Deno.env.get("ADMIN_USERNAME") ?? "";
  const passwordHash = Deno.env.get("ADMIN_PASSWORD_HASH") ?? "";
  const sessionSecret = Deno.env.get("ADMIN_SESSION_SECRET") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const invalidConfiguration: string[] = [];
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(username)) invalidConfiguration.push("ADMIN_USERNAME");
  if (!isValidAdminPasswordHash(passwordHash)) invalidConfiguration.push("ADMIN_PASSWORD_HASH");
  if (sessionSecret.length < 32) invalidConfiguration.push("ADMIN_SESSION_SECRET");
  if (!supabaseUrl) invalidConfiguration.push("SUPABASE_URL");
  if (!serviceRoleKey) invalidConfiguration.push("SUPABASE_SERVICE_ROLE_KEY");
  if (invalidConfiguration.length) {
    console.error("Login admin has invalid server configuration:", invalidConfiguration);
    return json(request, { error: "Login admin belum dikonfigurasi di secret server." }, 503);
  }

  let credentials: unknown;
  try {
    credentials = await request.json();
  } catch {
    return json(request, { error: "Isi permintaan tidak valid." }, 400);
  }
  if (!credentials || typeof credentials !== "object" || Array.isArray(credentials)) {
    return json(request, { error: "Isi permintaan tidak valid." }, 400);
  }
  const input = credentials as Record<string, unknown>;
  if (typeof input.username !== "string" || typeof input.password !== "string"
    || input.username.length > 64 || input.password.length > 1024) {
    return json(request, { error: "Username atau password salah." }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const keyHash = await loginRateLimitKey(clientIp(request), sessionSecret);
  const { data: canAttempt, error: limitError } = await supabase.rpc("consume_admin_login_attempt", {
    p_key_hash: keyHash,
    p_success: false,
  });
  if (limitError) return json(request, { error: "Layanan login belum siap. Silakan coba lagi." }, 503);
  if (!canAttempt) return json(request, { error: "Terlalu banyak percobaan. Coba lagi dalam 15 menit." }, 429);

  let passwordMatches: boolean;
  try {
    passwordMatches = await verifyAdminPassword(input.password, passwordHash);
  } catch {
    return json(request, { error: "Konfigurasi password admin tidak valid." }, 503);
  }
  if (input.username !== username || !passwordMatches) {
    return json(request, { error: "Username atau password salah." }, 401);
  }

  const { error: resetError } = await supabase.rpc("consume_admin_login_attempt", {
    p_key_hash: keyHash,
    p_success: true,
  });
  if (resetError) return json(request, { error: "Sesi login tidak dapat dibuat. Silakan coba lagi." }, 503);

  try {
    const token = await createAdminSession("admin", sessionSecret);
    return json(request, { token, expiresIn: 4 * 60 * 60 });
  } catch {
    return json(request, { error: "Sesi login tidak dapat dibuat. Periksa konfigurasi server." }, 503);
  }
});
