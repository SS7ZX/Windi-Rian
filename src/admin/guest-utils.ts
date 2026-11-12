import type { Guest, GuestDraft } from "./types";
import { C } from "../config.ts";

export function validateGuestDraft(draft: GuestDraft): string | null {
  if (!draft.name.trim()) return "Nama tamu wajib diisi.";
  if (draft.name.trim().length > 120) return "Nama tamu maksimal 120 karakter.";
  const phone = draft.phone?.trim() ?? "";
  if (phone && !/^\+?[0-9\s().-]+$/.test(phone)) return "Format nomor WhatsApp tidak valid.";
  const digits = phone.replace(/\D/g, "");
  if (digits && (digits.length < 8 || digits.length > 15)) return "Nomor WhatsApp harus berisi 8–15 digit.";
  return null;
}

export function normalizeWhatsAppNumber(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  if (digits.length < 8 || digits.length > 15) throw new Error("Nomor WhatsApp harus berisi 8–15 digit.");
  return digits;
}

export function inviteUrl(guest: Pick<Guest, "slug">, origin = window.location.origin): string {
  const url = new URL("/", origin);
  url.searchParams.set("invite", guest.slug);
  return url.toString();
}

export function invitationMessage(guest: Pick<Guest, "name" | "slug">, origin = window.location.origin): string {
  return [
    `Assalamu'alaikum ${guest.name},`,
    "",
    `Dengan hormat, kami mengundang Bapak/Ibu untuk menghadiri acara Ngunduh Mantu ${C.groom} & ${C.bride}.`,
    `${C.date} pukul ${C.timeAkad}`,
    `${C.venue}`,
    "",
    `Undangan lengkap: ${inviteUrl(guest, origin)}`,
    "",
    "Merupakan kebahagiaan bagi kami apabila Bapak/Ibu berkenan hadir. Terima kasih.",
  ].join("\n");
}

function csvCell(value: string | number | null): string {
  const text = String(value ?? "");
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function guestsCsv(guests: Guest[]): string {
  const rows = [
    ["Nama", "WhatsApp", "Relasi", "Kategori", "Status RSVP", "Jumlah Hadir", "Ucapan", "Catatan Internal", "Slug Undangan"],
    ...guests.map(guest => [
      guest.name, guest.phone, guest.relation, guest.category, guest.rsvp_status,
      guest.party_size, guest.wishes, guest.internal_note, guest.slug,
    ]),
  ];
  return `\uFEFF${rows.map(row => row.map(csvCell).join(",")).join("\r\n")}`;
}
