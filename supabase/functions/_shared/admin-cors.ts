const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Vary": "Origin",
};

export function adminCorsHeaders(request: Request, appOrigins: string): HeadersInit {
  const origin = request.headers.get("origin");
  const allowedOrigins = new Set(appOrigins.split(",").map(value => value.trim()).filter(Boolean));
  return {
    ...corsHeaders,
    ...(origin && allowedOrigins.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
  };
}

export function isAllowedOrigin(request: Request, appOrigins: string): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return appOrigins.split(",").map(value => value.trim()).filter(Boolean).includes(origin);
}
