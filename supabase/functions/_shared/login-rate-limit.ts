const encoder = new TextEncoder();

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function loginRateLimitKey(ipAddress: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(ipAddress));
  return hex(new Uint8Array(signature));
}

export function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip")
    || request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim()
    || "unknown";
}
