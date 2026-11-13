import { GuestValidationError, slugForName, validateGuestInput, validateGuestUpdate, type GuestInput, type GuestUpdateInput } from "./guest-validation.ts";

type StoreError = { code?: string; message: string };
type StoreResult<T> = { data: T | null; error: StoreError | null };

export type GuestRepository<T> = {
  insert: (guest: GuestInput & { slug: string }) => Promise<StoreResult<T>>;
  update: (id: string, guest: GuestUpdateInput) => Promise<StoreResult<T>>;
  delete: (id: string) => Promise<{ error: StoreError | null }>;
};

export type PreparedGuestBatchRow = {
  index: number;
  guest: GuestInput & { slug: string };
};

export type GuestBatchValidationResult = {
  index: number;
  error?: string;
};

export function prepareGuestBatch(input: unknown, maxRows = 500): {
  rows: PreparedGuestBatchRow[];
  results: GuestBatchValidationResult[];
} {
  if (!Array.isArray(input) || input.length === 0) {
    throw new GuestValidationError("Pilih minimal satu baris tamu untuk diimpor.");
  }
  if (input.length > maxRows) throw new GuestValidationError(`Maksimum ${maxRows} tamu per impor.`);

  const rows: PreparedGuestBatchRow[] = [];
  const results: GuestBatchValidationResult[] = input.map((_guest, index) => ({ index }));
  for (const [index, rawGuest] of input.entries()) {
    try {
      const guest = validateGuestInput(rawGuest);
      rows.push({ index, guest: { ...guest, slug: slugForName(guest.name) } });
    } catch (error) {
      if (!(error instanceof GuestValidationError)) throw error;
      results[index].error = error.message;
    }
  }
  return { rows, results };
}

export function createGuestRecord<T>(repository: GuestRepository<T>, input: unknown): Promise<StoreResult<T>> {
  const guest = validateGuestInput(input);
  return repository.insert({ ...guest, slug: slugForName(guest.name) });
}

export function updateGuestRecord<T>(repository: GuestRepository<T>, id: string, input: unknown): Promise<StoreResult<T>> {
  const guest = validateGuestUpdate(input);
  return repository.update(id, guest);
}

export function deleteGuestRecord<T>(repository: GuestRepository<T>, id: string): Promise<{ error: StoreError | null }> {
  return repository.delete(id);
}
