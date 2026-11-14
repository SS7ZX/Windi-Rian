create or replace function public.submit_guest_response(
  p_slug text,
  p_rsvp_status text,
  p_party_size smallint,
  p_message text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_guest_id uuid;
begin
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Tautan undangan tidak valid.' using errcode = '22023';
  end if;
  if p_rsvp_status is not null and p_rsvp_status not in ('attending', 'declined') then
    raise exception 'Status RSVP tidak valid.' using errcode = '22023';
  end if;
  if p_rsvp_status = 'attending' and (p_party_size is null or p_party_size < 1 or p_party_size > 6) then
    raise exception 'Jumlah hadir tidak valid.' using errcode = '22023';
  end if;
  if p_message is not null and char_length(btrim(p_message)) > 2000 then
    raise exception 'Pesan maksimal 2000 karakter.' using errcode = '22023';
  end if;
  if p_rsvp_status is null and nullif(btrim(p_message), '') is null then
    raise exception 'Konfirmasi atau pesan wajib diisi.' using errcode = '22023';
  end if;

  select id into target_guest_id
  from public.guests
  where slug = p_slug
  for update;

  if target_guest_id is null then
    return false;
  end if;

  if nullif(btrim(p_message), '') is not null and exists (
    select 1 from public.guest_messages
    where guest_id = target_guest_id
      and created_at >= now() - interval '1 minute'
  ) then
    raise exception 'Tunggu sebentar sebelum mengirim pesan lagi.' using errcode = 'P0001';
  end if;

  if p_rsvp_status is not null then
    update public.guests
    set rsvp_status = p_rsvp_status,
        party_size = case when p_rsvp_status = 'attending' then p_party_size else 1 end,
        updated_at = now()
    where id = target_guest_id;
  end if;

  if nullif(btrim(p_message), '') is not null then
    insert into public.guest_messages (guest_id, message)
    values (target_guest_id, btrim(p_message));
  end if;

  return true;
end;
$$;

revoke all on function public.submit_guest_response(text, text, smallint, text) from public, anon, authenticated;
grant execute on function public.submit_guest_response(text, text, smallint, text) to service_role;
