import { slugForName, validateGuestInput, validateGuestUpdate, type GuestInput, type GuestUpdateInput } from "./guest-validation.ts";

type StoreError = { code?: string; message: string };
type StoreResult<T> = { data: T | null; error: StoreError | null };

export type GuestRepository<T> = {
  insert: (guest: GuestInput & { slug: string }) => Promise<StoreResult<T>>;
  update: (id: string, guest: GuestUpdateInput) => Promise<StoreResult<T>>;
  delete: (id: string) => Promise<{ error: StoreError | null }>;
};

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
