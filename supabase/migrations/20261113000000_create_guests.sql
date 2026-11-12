create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  phone text,
  relation text check (relation is null or char_length(relation) <= 120),
  category text not null check (category in ('Keluarga', 'Teman', 'Rekan Kerja', 'Lainnya')),
  internal_note text check (internal_note is null or char_length(internal_note) <= 1000),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  rsvp_status text not null default 'pending' check (rsvp_status in ('pending', 'attending', 'declined')),
  party_size smallint not null default 1 check (party_size between 1 and 6),
  wishes text check (wishes is null or char_length(wishes) <= 2000),
  whatsapp_status text not null default 'not_sent' check (whatsapp_status in ('not_sent', 'opened_manual')),
  whatsapp_opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists guests_slug_lower_unique on public.guests (lower(slug));
create index if not exists guests_category_idx on public.guests (category);
create index if not exists guests_rsvp_status_idx on public.guests (rsvp_status);

alter table public.guests enable row level security;
revoke all on table public.guests from anon, authenticated;
grant all on table public.guests to service_role;
