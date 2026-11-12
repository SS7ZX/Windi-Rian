export const GUEST_CATEGORIES = ["Keluarga", "Teman", "Rekan Kerja", "Lainnya"] as const;
export type GuestCategory = typeof GUEST_CATEGORIES[number];

export class GuestValidationError extends Error {}

export type GuestInput = {
  name: string;
  phone: string | null;
  relation: string | null;
  category: GuestCategory;
  internal_note: string | null;
};

export type GuestUpdateInput = GuestInput & {
  rsvp_status: "pending" | "attending" | "declined";
  party_size: number;
  wishes: string | null;
};

export function normalizePhone(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new GuestValidationError("Nomor WhatsApp harus berupa teks.");
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\+?[0-9\s().-]+$/.test(trimmed)) throw new GuestValidationError("Format nomor WhatsApp tidak valid.");
  let digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  if (digits.length < 8 || digits.length > 15) throw new GuestValidationError("Nomor WhatsApp harus berisi 8–15 digit.");
  return digits;
}

function optionalText(value: unknown, label: string, maxLength: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new GuestValidationError(`${label} harus berupa teks.`);
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length > maxLength) throw new GuestValidationError(`${label} maksimal ${maxLength} karakter.`);
  return normalized || null;
}

export function validateGuestInput(value: unknown): GuestInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new GuestValidationError("Data tamu tidak valid.");
  }
  const input = value as Record<string, unknown>;
  if (typeof input.name !== "string") throw new GuestValidationError("Nama tamu wajib diisi.");
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name) throw new GuestValidationError("Nama tamu wajib diisi.");
  if (name.length > 120) throw new GuestValidationError("Nama tamu maksimal 120 karakter.");
  if (typeof input.category !== "string" || !GUEST_CATEGORIES.includes(input.category as GuestCategory)) {
    throw new GuestValidationError("Pilih kategori tamu yang valid.");
  }
  return {
    name,
    phone: normalizePhone(input.phone),
    relation: optionalText(input.relation, "Relasi", 120),
    category: input.category as GuestCategory,
    internal_note: optionalText(input.internal_note, "Catatan internal", 1000),
  };
}

export function validateGuestUpdate(value: unknown): GuestUpdateInput {
  const guest = validateGuestInput(value);
  const input = value as Record<string, unknown>;
  if (input.rsvp_status !== "pending" && input.rsvp_status !== "attending" && input.rsvp_status !== "declined") {
    throw new GuestValidationError("Pilih status RSVP yang valid.");
  }
  if (typeof input.party_size !== "number" || !Number.isInteger(input.party_size) || input.party_size < 1 || input.party_size > 6) {
    throw new GuestValidationError("Jumlah tamu hadir harus antara 1 dan 6 orang.");
  }
  return {
    ...guest,
    rsvp_status: input.rsvp_status,
    party_size: input.party_size,
    wishes: optionalText(input.wishes, "Ucapan", 2000),
  };
}

export function slugForName(name: string, randomId = crypto.randomUUID()): string {
  const base = name.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    .replace(/-$/g, "") || "tamu";
  return `${base}-${randomId.replace(/-/g, "").slice(0, 32).toLowerCase()}`;
}
