create table if not exists public.guest_messages (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.guests(id) on delete cascade,
  message text not null check (char_length(btrim(message)) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists guest_messages_created_at_idx on public.guest_messages (created_at desc);
create index if not exists guest_messages_unread_idx on public.guest_messages (created_at desc) where read_at is null;

alter table public.guest_messages enable row level security;
revoke all on table public.guest_messages from anon, authenticated;
grant all on table public.guest_messages to service_role;
