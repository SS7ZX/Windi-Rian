import assert from "node:assert/strict";
import test from "node:test";
import { authorizeAdmin, bearerToken, createAdminSession, isValidAdminPasswordHash, verifyAdminPassword, verifyAdminSession } from "../supabase/functions/_shared/admin-auth.ts";
import { createGuestRecord, prepareGuestBatch, updateGuestRecord, type GuestRepository } from "../supabase/functions/_shared/guest-operations.ts";
import { normalizePhone, slugForName, validateGuestInput, validateGuestUpdate, validatePublicRsvp } from "../supabase/functions/_shared/guest-validation.ts";
import { guestAnalytics, guestsCsv, invitationMessage, inviteUrl, normalizeWhatsAppNumber } from "../src/admin/guest-utils.ts";

test("requires a non-empty guest name and a supported category", () => {
  assert.throws(() => validateGuestInput({ name: "   ", category: "Teman" }), /Nama tamu wajib diisi/);
  assert.throws(() => validateGuestInput({ name: "Rian", category: "Unknown" }), /kategori tamu yang valid/);
});

test("normalizes guest fields and Indonesian phone numbers", () => {
  const guest = validateGuestInput({
    name: "  Bapak   Ahmad  ",
    phone: "0812-3456-7890",
    relation: "  Teman   lama ",
    category: "Teman",
    internal_note: "  Alergi kacang ",
  });
  assert.equal(guest.name, "Bapak Ahmad");
  assert.equal(guest.phone, "6281234567890");
  assert.equal(guest.relation, "Teman lama");
  assert.equal(guest.internal_note, "Alergi kacang");
});

test("rejects malformed or out-of-range phone numbers", () => {
  assert.throws(() => normalizePhone("0812abc"), /Format nomor WhatsApp tidak valid/);
  assert.throws(() => normalizePhone("123"), /8–15 digit/);
});

test("creates valid unique slugs without depending on editable name after creation", () => {
  const firstSlug = slugForName("Windi Nuraeni", "11111111-1111-4111-8111-111111111111");
  const secondSlug = slugForName("Windi Nuraeni", "22222222-2222-4222-8222-222222222222");
  assert.match(firstSlug, /^windi-nuraeni-[a-f0-9]{32}$/);
  assert.notEqual(firstSlug, secondSlug);
});

test("admin create stores a validated guest with a unique personal slug", async () => {
  const rows: Array<Record<string, unknown>> = [];
  const repository: GuestRepository<Record<string, unknown>> = {
    insert: async guest => {
      rows.push(guest);
      return { data: guest, error: null };
    },
    update: async () => ({ data: null, error: null }),
    delete: async () => ({ error: null }),
  };
  const result = await createGuestRecord(repository, { name: "  Rian  Windi ", phone: "", category: "Keluarga" });
  assert.equal(result.error, null);
  assert.equal(result.data?.name, "Rian Windi");
  assert.match(String(result.data?.slug), /^rian-windi-[a-f0-9]{32}$/);
  assert.equal(rows.length, 1);
});

test("validates bulk guest rows independently and assigns a unique slug to each valid row", () => {
  const { rows, results } = prepareGuestBatch([
    { name: "  Rian  Windi ", phone: "", category: "Keluarga" },
    { name: "   ", phone: "", category: "Keluarga" },
    { name: "Rian Windi", phone: "", category: "Teman" },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(results[1].error, "Nama tamu wajib diisi.");
  assert.equal(rows[0].guest.name, "Rian Windi");
  assert.notEqual(rows[0].guest.slug, rows[1].guest.slug);
  assert.throws(() => prepareGuestBatch([], 500), /minimal satu baris/);
  assert.throws(() => prepareGuestBatch([{ name: "Rian" }], 0), /Maksimum/);
});

test("admin edit updates validated fields without changing the existing slug", async () => {
  const existing = { id: "guest-1", name: "Nama Lama", slug: "nama-lama-a1b2c3d4e5f67890" };
  let updatedValues: Record<string, unknown> | null = null;
  const repository: GuestRepository<Record<string, unknown>> = {
    insert: async () => ({ data: null, error: null }),
    update: async (_id, guest) => {
      updatedValues = guest;
      return { data: { ...existing, ...guest }, error: null };
    },
    delete: async () => ({ error: null }),
  };
  const result = await updateGuestRecord(repository, existing.id, {
    name: "Nama Baru",
    category: "Teman",
    slug: "nama-baru-silently-changed",
    rsvp_status: "pending",
    party_size: 1,
    wishes: null,
  });
  assert.equal(result.data?.name, "Nama Baru");
  assert.equal(result.data?.slug, existing.slug);
  assert.equal(Object.hasOwn(updatedValues, "slug"), false);
});

test("validates RSVP status, attendance count, and wishes on admin edit", () => {
  const valid = validateGuestUpdate({
    name: "Tamu",
    category: "Keluarga",
    rsvp_status: "attending",
    party_size: 3,
    wishes: "Semoga samawa",
  });
  assert.equal(valid.party_size, 3);
  assert.equal(valid.wishes, "Semoga samawa");
  assert.throws(() => validateGuestUpdate({
    name: "Tamu",
    category: "Keluarga",
    rsvp_status: "attending",
    party_size: 7,
  }), /antara 1 dan 6/);
});

test("validates public RSVP submissions and limits them to the selected invitation", () => {
  assert.deepEqual(validatePublicRsvp({
    slug: "windi-nuraeni-1234567890abcdef",
    rsvp_status: "attending",
    party_size: 2,
  }), {
    slug: "windi-nuraeni-1234567890abcdef",
    rsvp_status: "attending",
    party_size: 2,
  });
  assert.deepEqual(validatePublicRsvp({
    slug: "windi-nuraeni-1234567890abcdef",
    rsvp_status: "declined",
    party_size: 6,
  }), {
    slug: "windi-nuraeni-1234567890abcdef",
    rsvp_status: "declined",
    party_size: 1,
  });
  assert.throws(() => validatePublicRsvp({
    slug: "invalid slug",
    rsvp_status: "attending",
    party_size: 1,
  }), /Tautan undangan tidak valid/);
  assert.throws(() => validatePublicRsvp({
    slug: "windi-nuraeni-1234567890abcdef",
    rsvp_status: "pending",
    party_size: 1,
  }), /Pilih konfirmasi hadir atau tidak hadir/);
  assert.throws(() => validatePublicRsvp({
    slug: "windi-nuraeni-1234567890abcdef",
    rsvp_status: "attending",
    party_size: 7,
  }), /antara 1 dan 6/);
});

test("summarizes RSVP metrics without category breakdowns and handles empty data", () => {
  const baseGuest = {
    id: "guest",
    name: "Tamu",
    phone: null,
    relation: null,
    category: "Keluarga" as const,
    internal_note: null,
    slug: "tamu-1234567890abcdef",
    party_size: 1,
    wishes: null,
    whatsapp_status: "not_sent" as const,
    whatsapp_opened_at: null,
    created_at: "",
    updated_at: "",
  };
  const stats = guestAnalytics([
    { ...baseGuest, id: "one", rsvp_status: "attending" as const, party_size: 3 },
    { ...baseGuest, id: "two", rsvp_status: "declined" as const },
    { ...baseGuest, id: "three", rsvp_status: "pending" as const, wishes: "Semoga bahagia" },
  ]);
  assert.deepEqual(stats, {
    total: 3,
    attending: 1,
    attendanceHeadcount: 3,
    declined: 1,
    pending: 1,
    responded: 2,
    responseRate: 67,
    wishes: 1,
  });
  assert.equal(guestAnalytics([]).responseRate, 0);
});

test("requires a valid signed admin session for private API requests", async () => {
  const secret = "a".repeat(48);
  const now = Date.now();
  const token = await createAdminSession("admin", secret, now);
  const request = new Request("https://example.test", { headers: { authorization: `Bearer ${token}` } });
  assert.equal(await authorizeAdmin(new Request("https://example.test"), secret), false);
  assert.equal(await authorizeAdmin(request, secret), true);
  assert.equal(await verifyAdminSession(token, "b".repeat(48), now), null);
  assert.equal(await verifyAdminSession(token, secret, now + 4 * 60 * 60 * 1000 + 1000), null);
  const [header, payload, signature] = token.split(".");
  const tamperedToken = `${header}.${payload}.${signature[0] === "a" ? "b" : "a"}${signature.slice(1)}`;
  assert.equal(await verifyAdminSession(tamperedToken, secret, now), null);
  assert.equal(bearerToken(new Request("https://example.test", { headers: { authorization: "Bearer secret-token" } })), "secret-token");
  assert.equal(bearerToken(new Request("https://example.test")), null);
});

test("verifies PBKDF2-SHA256 admin passwords without storing plaintext", async () => {
  const password = "a-new-strong-password";
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 310000 }, material, 256);
  const toHex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  const hash = `pbkdf2-sha256:310000:${toHex(salt)}:${toHex(new Uint8Array(bits))}`;
  assert.equal(isValidAdminPasswordHash(hash), true);
  assert.equal(await verifyAdminPassword(password, hash), true);
  assert.equal(await verifyAdminPassword("wrong-password", hash), false);
  assert.equal(await verifyAdminPassword(password, "invalid"), false);
  assert.equal(isValidAdminPasswordHash(`pbkdf2-sha256$310000$${toHex(salt)}$${toHex(new Uint8Array(bits))}`), false);
  assert.equal(isValidAdminPasswordHash("invalid"), false);
});

test("personal invitation URLs use the supplied origin and guest slug", () => {
  assert.equal(
    inviteUrl({ slug: "windi-nuraeni-1234567890abcdef" }, "http://localhost:5173"),
    "http://localhost:5173/?invite=windi-nuraeni-1234567890abcdef",
  );
});

test("manual WhatsApp invitation includes the recipient and personal link", () => {
  const message = invitationMessage(
    { name: "Ibu Sari", slug: "ibu-sari-1234567890abcdef" },
    "https://undangan.example",
  );
  assert.match(message, /Assalamu'alaikum Ibu Sari/);
  assert.match(message, /https:\/\/undangan\.example\/\?invite=ibu-sari-1234567890abcdef/);
  assert.equal(message.includes("pesan telah terkirim"), false);
  assert.equal(normalizeWhatsAppNumber("0812 3456 7890"), "6281234567890");
});

test("CSV escapes cells that could be interpreted as spreadsheet formulas", () => {
  const csv = guestsCsv([{
    id: "guest-1",
    name: "=HYPERLINK(\"https://example.com\")",
    phone: null,
    relation: null,
    category: "Teman",
    internal_note: null,
    slug: "tamu-1234567890abcdef",
    rsvp_status: "pending",
    party_size: 1,
    wishes: null,
    whatsapp_status: "not_sent",
    whatsapp_opened_at: null,
    created_at: "",
    updated_at: "",
  }]);
  assert.match(csv, /"'=HYPERLINK\(""https:\/\/example\.com""\)"/);
});
