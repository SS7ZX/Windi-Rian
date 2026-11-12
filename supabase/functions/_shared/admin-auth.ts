const SESSION_SECONDS = 4 * 60 * 60;
const encoder = new TextEncoder();

export type AdminSession = {
  sub: string;
  aud: "windi-admin";
  iss: "windi-admin";
  iat: number;
  exp: number;
};

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - base64.length % 4) % 4));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  let difference = left.length ^ right.length;
  const maxLength = Math.max(left.length, right.length);
  for (let index = 0; index < maxLength; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  if (encoder.encode(secret).length < 32) throw new Error("ADMIN_SESSION_SECRET harus minimal 32 byte.");
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createAdminSession(username: string, secret: string, now = Date.now()): Promise<string> {
  const header = base64UrlEncode(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const issuedAt = Math.floor(now / 1000);
  const payload: AdminSession = {
    sub: username,
    aud: "windi-admin",
    iss: "windi-admin",
    iat: issuedAt,
    exp: issuedAt + SESSION_SECONDS,
  };
  const encodedPayload = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const unsignedToken = `${header}.${encodedPayload}`;
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(unsignedToken));
  return `${unsignedToken}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifyAdminSession(token: string, secret: string, now = Date.now()): Promise<AdminSession | null> {
  if (!token || token.length > 4096) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedHeader))) as { alg?: string; typ?: string };
    if (header.alg !== "HS256" || header.typ !== "JWT") return null;

    const unsignedToken = `${encodedHeader}.${encodedPayload}`;
    const key = await hmacKey(secret);
    const signatureIsValid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlDecode(encodedSignature),
      encoder.encode(unsignedToken),
    );
    if (!signatureIsValid) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload))) as Partial<AdminSession>;
    const nowSeconds = Math.floor(now / 1000);
    if (payload.sub !== "admin" || payload.aud !== "windi-admin" || payload.iss !== "windi-admin") return null;
    if (typeof payload.iat !== "number" || typeof payload.exp !== "number") return null;
    if (payload.iat > nowSeconds + 60 || payload.exp <= nowSeconds || payload.exp - payload.iat > SESSION_SECONDS) return null;
    return payload as AdminSession;
  } catch {
    return null;
  }
}

export function bearerToken(request: Request): string | null {
  const match = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function authorizeAdmin(request: Request, secret: string): Promise<boolean> {
  const token = bearerToken(request);
  return token ? (await verifyAdminSession(token, secret)) !== null : false;
}

export async function verifyAdminPassword(password: string, passwordHash: string): Promise<boolean> {
  const parts = passwordHash.split(":");
  if (!isValidAdminPasswordHash(passwordHash)) return false;
  const iterations = Number(parts[1]);
  const saltHex = parts[2];
  const expectedHex = parts[3];

  const salt = Uint8Array.from(saltHex.match(/.{2}/g) ?? [], byte => Number.parseInt(byte, 16));
  const expected = Uint8Array.from(expectedHex.match(/.{2}/g) ?? [], byte => Number.parseInt(byte, 16));
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, material, 256);
  return constantTimeEqual(new Uint8Array(bits), expected);
}

export function isValidAdminPasswordHash(passwordHash: string): boolean {
  const parts = passwordHash.split(":");
  if (parts.length !== 4 || parts[0] !== "pbkdf2-sha256") return false;
  const iterations = Number(parts[1]);
  return Number.isInteger(iterations)
    && iterations >= 310000
    && iterations <= 1000000
    && /^(?:[0-9a-f]{2}){16,64}$/i.test(parts[2])
    && /^(?:[0-9a-f]{2}){32}$/i.test(parts[3]);
}
