create table if not exists public.admin_login_attempts (
  key_hash text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts between 0 and 11)
);

create index if not exists admin_login_attempts_window_started_at_idx
  on public.admin_login_attempts (window_started_at);

alter table public.admin_login_attempts enable row level security;
revoke all on table public.admin_login_attempts from anon, authenticated;
grant all on table public.admin_login_attempts to service_role;

create or replace function public.consume_admin_login_attempt(p_key_hash text, p_success boolean default false)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_attempts integer;
begin
  if p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid rate-limit key';
  end if;

  delete from public.admin_login_attempts
  where window_started_at < now() - interval '24 hours';

  insert into public.admin_login_attempts as attempts_table (key_hash, window_started_at, attempts)
  values (p_key_hash, now(), case when p_success then 0 else 1 end)
  on conflict (key_hash) do update
  set window_started_at = case
        when p_success or attempts_table.window_started_at <= now() - interval '15 minutes' then now()
        else attempts_table.window_started_at
      end,
      attempts = case
        when p_success then 0
        when attempts_table.window_started_at <= now() - interval '15 minutes' then 1
        else least(attempts_table.attempts + 1, 11)
      end
  returning attempts into current_attempts;

  return p_success or current_attempts <= 10;
end;
$$;

revoke all on function public.consume_admin_login_attempt(text, boolean) from public, anon, authenticated;
grant execute on function public.consume_admin_login_attempt(text, boolean) to service_role;
