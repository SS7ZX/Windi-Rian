import assert from "node:assert/strict";
import test from "node:test";
import { guestImportTemplate, parseGuestImport } from "../src/admin/guest-import.ts";
import type { Guest } from "../src/admin/types.ts";

function existingGuest(overrides: Partial<Guest> = {}): Guest {
  return {
    id: "guest-1",
    name: "Ibu Sari",
    phone: "6281234567890",
    relation: null,
    category: "Keluarga",
    internal_note: null,
    slug: "ibu-sari-1234567890abcdef",
    rsvp_status: "pending",
    party_size: 1,
    wishes: null,
    whatsapp_status: "not_sent",
    whatsapp_opened_at: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

test("parses CSV with quoted commas and normalizes guest fields", () => {
  const preview = parseGuestImport(
    'Nama,No. WhatsApp,Relasi,Kategori,Catatan Internal\r\n"Ibu Sari, S.E.",0812-3456-7891,Keluarga,Keluarga,"Hadir, insyaallah"',
    [],
  );
  assert.equal(preview.error, null);
  assert.equal(preview.rows.length, 1);
  assert.deepEqual(preview.rows[0].draft, {
    name: "Ibu Sari, S.E.",
    phone: "0812-3456-7891",
    relation: "Keluarga",
    category: "Keluarga",
    internal_note: "Hadir, insyaallah",
  });
  assert.equal(preview.rows[0].selected, true);
});

test("parses tab-separated pasted rows and defaults empty categories", () => {
  const preview = parseGuestImport(
    "Nama\tWhatsApp\tRelasi\tKategori\tCatatan Internal\nBapak Ahmad\t\tTetangga\t\t",
    [],
  );
  assert.equal(preview.error, null);
  assert.equal(preview.rows[0].draft?.category, "Keluarga");
  assert.equal(preview.rows[0].draft?.name, "Bapak Ahmad");
});

test("flags duplicate phones and normalized names without auto-selecting them", () => {
  const preview = parseGuestImport(
    "Nama,WhatsApp,Relasi,Kategori,Catatan Internal\nIbu Sari,0812 3456 7890,,,,\n ibu sari ,,,,",
    [existingGuest()],
  );
  assert.equal(preview.rows[0].duplicate !== null, true);
  assert.equal(preview.rows[0].selected, false);
  assert.equal(preview.rows[1].duplicate !== null, true);
  assert.equal(preview.rows[1].selected, false);
});

test("keeps invalid rows out of import and reports row-specific errors", () => {
  const preview = parseGuestImport(
    "Nama,WhatsApp,Relasi,Kategori\n,08123456789,,Keluarga\nTamu,0812abc,,Keluarga\nTamu valid,,,Keluarga",
    [],
  );
  assert.equal(preview.rows.length, 3);
  assert.match(preview.rows[0].error ?? "", /Nama tamu wajib diisi/);
  assert.equal(preview.rows[0].selected, false);
  assert.match(preview.rows[1].error ?? "", /Format nomor WhatsApp tidak valid/);
  assert.equal(preview.rows[2].selected, true);
});

test("requires a name header, rejects duplicate headers, and limits oversized imports", () => {
  assert.match(parseGuestImport("Nomor,Relasi\n0812,Keluarga", []).error ?? "", /Kolom Nama wajib ada/);
  assert.match(parseGuestImport("Nama,Name\nRian,Rian", []).error ?? "", /Header kolom berulang/);
  const tooManyRows = `Nama\n${Array.from({ length: 501 }, (_, index) => `Tamu ${index}`).join("\n")}`;
  assert.match(parseGuestImport(tooManyRows, []).error ?? "", /Maksimum 500 baris/);
});

test("provides a CSV template with the documented guest columns", () => {
  assert.match(guestImportTemplate(), /Nama,WhatsApp,Relasi,Kategori,Catatan Internal/);
});
