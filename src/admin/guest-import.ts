import { guestCategories, type Guest, type GuestDraft } from "./types.ts";
import { normalizeWhatsAppNumber, validateGuestDraft } from "./guest-utils.ts";

export type GuestImportRow = {
  rowNumber: number;
  draft: GuestDraft | null;
  error: string | null;
  duplicate: string | null;
  selected: boolean;
};

export type GuestImportPreview = {
  rows: GuestImportRow[];
  error: string | null;
};

const MAX_IMPORT_ROWS = 500;
const MAX_IMPORT_CHARS = 2_000_000;

function chooseDelimiter(text: string): string {
  let quoted = false;
  const counts = new Map([["\t", 0], [",", 0], [";", 0]]);
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === "\"") {
      if (quoted && text[index + 1] === "\"") index += 1;
      else quoted = !quoted;
    } else if (!quoted && (character === "\r" || character === "\n")) {
      break;
    } else if (!quoted && counts.has(character)) {
      counts.set(character, (counts.get(character) ?? 0) + 1);
    }
  }
  return [...counts].sort((left, right) => right[1] - left[1])[0]?.[0] ?? ",";
}

function parseDelimitedRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === "\"" && text[index + 1] === "\"") {
        field += "\"";
        index += 1;
      } else if (character === "\"") {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === "\"" && field.length === 0) {
      quoted = true;
    } else if (character === delimiter) {
      row.push(field);
      field = "";
    } else if (character === "\r" || character === "\n") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("Ada tanda kutip yang belum ditutup. Periksa kembali CSV atau teks yang ditempel.");
  row.push(field);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

const headerAliases: Record<string, keyof GuestDraft> = {
  nama: "name",
  namatamu: "name",
  name: "name",
  whatsapp: "phone",
  nowhatsapp: "phone",
  nomorwa: "phone",
  nomerwa: "phone",
  nomorwhatsapp: "phone",
  phone: "phone",
  relasi: "relation",
  hubungan: "relation",
  relation: "relation",
  kategori: "category",
  category: "category",
  catatan: "internal_note",
  catataninternal: "internal_note",
  internalnote: "internal_note",
};

function normalizedPhone(value: string): string | null {
  if (!value.trim()) return null;
  try {
    return normalizeWhatsAppNumber(value);
  } catch {
    return null;
  }
}

function normalizedName(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
}

export function parseGuestImport(text: string, guests: Guest[]): GuestImportPreview {
  if (!text.trim()) return { rows: [], error: "Pilih file CSV atau tempel data tamu untuk melihat pratinjau." };
  if (text.length > MAX_IMPORT_CHARS) return { rows: [], error: "Ukuran data terlalu besar. Batas maksimum 2 MB." };

  let records: string[][];
  try {
    records = parseDelimitedRows(text, chooseDelimiter(text));
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : "Format CSV tidak dapat dibaca." };
  }
  if (records.length < 2) return { rows: [], error: "Data harus berisi header dan minimal satu baris tamu." };

  const headers = records[0].map(normalizeHeader);
  const columns = headers.map(header => headerAliases[header] ?? null);
  if (!columns.includes("name")) return { rows: [], error: "Kolom Nama wajib ada. Gunakan template CSV untuk format yang benar." };
  const mappedColumns = columns.filter((column): column is keyof GuestDraft => column !== null);
  if (new Set(mappedColumns).size !== mappedColumns.length) {
    return { rows: [], error: "Header kolom berulang. Pastikan setiap kolom hanya ditulis satu kali." };
  }

  const seenNames = new Map<string, string>();
  const seenPhones = new Map<string, string>();
  for (const guest of guests) {
    const nameKey = normalizedName(guest.name);
    if (nameKey) seenNames.set(nameKey, guest.name);
    const phoneKey = guest.phone ? normalizedPhone(guest.phone) : null;
    if (phoneKey) seenPhones.set(phoneKey, guest.name);
  }

  const rows: GuestImportRow[] = records.slice(1).map((cells, index) => {
    const values: Partial<Record<keyof GuestDraft, string>> = {};
    for (const [columnIndex, column] of columns.entries()) {
      if (column) values[column] = cells[columnIndex] ?? "";
    }
    const categoryValue = values.category?.trim() || "Keluarga";
    const category = guestCategories.find(item => item.toLowerCase() === categoryValue.toLowerCase());
    const draft: GuestDraft = {
      name: values.name ?? "",
      phone: values.phone ?? "",
      relation: values.relation ?? "",
      category: category ?? "Lainnya",
      internal_note: values.internal_note ?? "",
    };

    const error = category ? validateGuestDraft(draft) : `Kategori "${categoryValue}" tidak didukung.`;
    if (!error) {
      const nameKey = normalizedName(draft.name);
      const phoneKey = draft.phone ? normalizedPhone(draft.phone) : null;
      const duplicateName = phoneKey ? seenPhones.get(phoneKey) : seenNames.get(nameKey);
      if (duplicateName) {
        const duplicate = `Kemungkinan duplikat dari "${duplicateName}". Pilih baris ini secara manual jika memang tamu berbeda.`;
        if (nameKey) seenNames.set(nameKey, draft.name.trim().replace(/\s+/g, " "));
        if (phoneKey) seenPhones.set(phoneKey, draft.name.trim().replace(/\s+/g, " "));
        return { rowNumber: index + 2, draft, error: null, duplicate, selected: false };
      }
      if (nameKey) seenNames.set(nameKey, draft.name.trim().replace(/\s+/g, " "));
      if (phoneKey) seenPhones.set(phoneKey, draft.name.trim().replace(/\s+/g, " "));
    }

    return {
      rowNumber: index + 2,
      draft,
      error,
      duplicate: null,
      selected: !error,
    };
  });

  const exceededLimit = rows.length > MAX_IMPORT_ROWS;
  return {
    rows: rows.slice(0, MAX_IMPORT_ROWS),
    error: exceededLimit ? `Maksimum ${MAX_IMPORT_ROWS} baris tamu per impor.` : null,
  };
}

export function guestImportTemplate(): string {
  return "\uFEFFNama,WhatsApp,Relasi,Kategori,Catatan Internal\r\nContoh: Ibu Sari,081234567890,Keluarga,Keluarga,\r\n";
}
