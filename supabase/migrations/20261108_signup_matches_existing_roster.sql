-- Sign-ups attach to an existing roster entry instead of creating duplicates.
-- Match order: any email (sign-in, military or personal) -> cell phone -> first + last name.
-- A tier only counts if it points to exactly one unlinked roster entry. Matched entries get blanks filled only.
create or replace function private.match_member(info jsonb, login_email text) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  emails text[] := array_remove(array[lower(trim(login_email)), lower(trim(info->>'mil_email')), lower(trim(info->>'personal_email'))], null);
  phone text := nullif(regexp_replace(coalesce(info->>'cell_phone', ''), '\D', '', 'g'), '');
  ln text := lower(trim(info->>'last_name'));
  fn text := lower(trim(info->>'first_name'));
  ids uuid[];
begin
  emails := array(select e from unnest(emails) e where e <> '');
  select array_agg(m.id) into ids from public.members m
   where not exists (select 1 from public.profiles p where p.member_id = m.id)
     and (lower(m.mil_email) = any(emails) or lower(m.personal_email) = any(emails));
  if array_length(ids, 1) = 1 then return ids[1]; end if;
  if phone is not null then
    select array_agg(m.id) into ids from public.members m
     where not exists (select 1 from public.profiles p where p.member_id = m.id)
       and regexp_replace(coalesce(m.cell_phone, ''), '\D', '', 'g') = phone;
    if array_length(ids, 1) = 1 then return ids[1]; end if;
  end if;
  if ln is not null and ln <> '' and fn is not null and fn <> '' then
    select array_agg(m.id) into ids from public.members m
     where not exists (select 1 from public.profiles p where p.member_id = m.id)
       and lower(trim(m.last_name)) = ln and lower(trim(coalesce(m.first_name, ''))) = fn;
    if array_length(ids, 1) = 1 then return ids[1]; end if;
  end if;
  return null;
end $$;

create or replace function private.fill_member_blanks(mid uuid, info jsonb) returns void
language sql security definer set search_path = '' as $$
  update public.members m set
    first_name = coalesce(m.first_name, nullif(trim(info->>'first_name'), '')),
    rank = coalesce(m.rank, nullif(info->>'rank', '')),
    unit = coalesce(m.unit, nullif(trim(info->>'unit'), '')),
    duty_status = coalesce(m.duty_status, nullif(info->>'duty_status', '')),
    cell_phone = coalesce(m.cell_phone, nullif(trim(info->>'cell_phone'), '')),
    mil_email = coalesce(m.mil_email, nullif(lower(trim(info->>'mil_email')), '')),
    personal_email = coalesce(m.personal_email, nullif(lower(trim(info->>'personal_email')), ''))
  where m.id = mid
$$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  is_staff boolean := exists(select 1 from public.staff_emails where email = lower(new.email));
  inv public.invites;
  mid uuid;
begin
  if not is_staff then
    select * into inv from public.invites
      where token = meta->>'invite' and used_at is null and expires_at > now() for update;
    if inv.id is null then
      raise exception 'Sign-up requires a valid invite link from MTU staff';
    end if;
    update public.invites set used_at = now(), used_by = new.id where id = inv.id;
  end if;
  if nullif(trim(meta->>'last_name'), '') is not null then
    if inv.member_id is not null and not exists (select 1 from public.profiles where member_id = inv.member_id) then
      mid := inv.member_id;
    else
      mid := private.match_member(meta, new.email);
    end if;
    if mid is not null then
      perform private.fill_member_blanks(mid, meta);
    else
      insert into public.members(last_name, first_name, rank, unit, duty_status, team_status, cell_phone, mil_email, personal_email)
      values (trim(meta->>'last_name'), nullif(trim(meta->>'first_name'), ''), nullif(meta->>'rank', ''), nullif(trim(meta->>'unit'), ''),
              nullif(meta->>'duty_status', ''), case when is_staff then 'Active' else 'New' end, nullif(trim(meta->>'cell_phone'), ''),
              nullif(lower(trim(meta->>'mil_email')), ''), nullif(lower(trim(meta->>'personal_email')), ''))
      returning id into mid;
    end if;
  end if;
  insert into public.profiles(id, email, display_name, role, approved, member_id)
  values (new.id, new.email,
          coalesce(nullif(trim(concat_ws(' ', meta->>'rank', meta->>'first_name', meta->>'last_name')), ''), split_part(new.email, '@', 1)),
          case when is_staff then 'staff' else 'shooter' end, true, mid);
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.complete_my_profile(info jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare mid uuid; p public.profiles;
begin
  select * into p from public.profiles where id = auth.uid() and approved;
  if p.id is null then raise exception 'Not allowed'; end if;
  if p.member_id is not null then return p.member_id; end if;
  if nullif(trim(info->>'last_name'), '') is null then raise exception 'Last name is required'; end if;
  mid := private.match_member(info, p.email);
  if mid is not null then
    perform private.fill_member_blanks(mid, info);
  else
    insert into public.members(last_name, first_name, rank, unit, duty_status, team_status, cell_phone, mil_email, personal_email)
    values (trim(info->>'last_name'), nullif(trim(info->>'first_name'), ''), nullif(info->>'rank', ''), nullif(trim(info->>'unit'), ''),
            nullif(info->>'duty_status', ''), case when p.role = 'staff' then 'Active' else 'New' end,
            nullif(trim(info->>'cell_phone'), ''), nullif(lower(trim(info->>'mil_email')), ''), nullif(lower(trim(info->>'personal_email')), ''))
    returning id into mid;
  end if;
  update public.profiles set member_id = mid,
    display_name = trim(concat_ws(' ', nullif(info->>'rank', ''), nullif(info->>'first_name', ''), info->>'last_name'))
  where id = p.id;
  return mid;
end $$;
revoke execute on function public.complete_my_profile(jsonb) from public, anon;
grant execute on function public.complete_my_profile(jsonb) to authenticated;
