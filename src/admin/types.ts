export const guestCategories = ["Keluarga", "Teman", "Rekan Kerja", "Lainnya"] as const;
export type GuestCategory = typeof guestCategories[number];
export type RsvpStatus = "pending" | "attending" | "declined";
export type WhatsAppStatus = "not_sent" | "opened_manual";

export type Guest = {
  id: string;
  name: string;
  phone: string | null;
  relation: string | null;
  category: GuestCategory;
  internal_note: string | null;
  slug: string;
  rsvp_status: RsvpStatus;
  party_size: number;
  wishes: string | null;
  whatsapp_status: WhatsAppStatus;
  whatsapp_opened_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GuestMessage = {
  id: string;
  guest_id: string;
  message: string;
  read_at: string | null;
  created_at: string;
  guest: Pick<Guest, "name" | "phone" | "slug">;
};

export type GuestDraft = Pick<Guest, "name" | "phone" | "relation" | "category" | "internal_note">;
export type GuestUpdateDraft = GuestDraft & Pick<Guest, "rsvp_status" | "party_size" | "wishes">;

export const emptyGuestDraft = (): GuestDraft => ({
  name: "",
  phone: "",
  relation: "",
  category: "Keluarga",
  internal_note: "",
});
