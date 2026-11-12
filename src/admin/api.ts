import { functionsUrl } from "./supabase";
import type { Guest, GuestDraft, GuestUpdateDraft } from "./types";

const sessionKey = "windi-admin-session";

export function getAdminToken(): string | null {
  return sessionStorage.getItem(sessionKey);
}

export async function loginAdmin(username: string, password: string): Promise<string> {
  const response = await fetch(functionsUrl("admin-session"), {
    method: "POST",
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });
  const result = await response.json().catch(() => ({})) as { error?: string; token?: string };
  if (!response.ok || !result.token) throw new Error(result.error || `Login gagal (${response.status}).`);
  sessionStorage.setItem(sessionKey, result.token);
  return result.token;
}

export function logoutAdmin(): void {
  sessionStorage.removeItem(sessionKey);
}

function expireAdminSession(): void {
  logoutAdmin();
  window.dispatchEvent(new Event("admin-session-expired"));
}

async function request<T>(functionName: string, method: string, body?: unknown): Promise<T> {
  const token = getAdminToken();
  if (!token) throw new Error("Sesi admin berakhir. Silakan masuk kembali.");

  const response = await fetch(functionsUrl(functionName), {
    method,
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json().catch(() => ({})) as { error?: string } & T;
  if (response.status === 401) expireAdminSession();
  if (!response.ok) throw new Error(result.error || `Permintaan gagal (${response.status}).`);
  return result;
}

export async function listGuests(): Promise<Guest[]> {
  const result = await request<{ guests: Guest[] }>("admin-guests", "GET");
  return result.guests;
}

export async function createGuest(guest: GuestDraft): Promise<Guest> {
  const result = await request<{ guest: Guest }>("admin-guests", "POST", guest);
  return result.guest;
}

export async function updateGuest(id: string, guest: GuestUpdateDraft): Promise<Guest> {
  const result = await request<{ guest: Guest }>("admin-guests", "PATCH", { id, ...guest });
  return result.guest;
}

export async function deleteGuest(id: string): Promise<void> {
  await request<{ success: true }>("admin-guests", "DELETE", { id });
}

export async function markWhatsAppOpened(id: string): Promise<Pick<Guest, "id" | "whatsapp_status" | "whatsapp_opened_at">> {
  const result = await request<{ guest: Pick<Guest, "id" | "whatsapp_status" | "whatsapp_opened_at"> }>(
    "admin-guests", "POST", { action: "manual_whatsapp_opened", id },
  );
  return result.guest;
}

