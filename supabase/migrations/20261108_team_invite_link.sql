-- One reusable "team link" for the whole group. Sign-ups through it wait for staff approval,
-- and their info is only matched/added to the roster when staff approve.

alter table public.invites
  add column multi_use boolean not null default false,
  add column use_count integer not null default 0;

alter table public.profiles
  add column pending boolean not null default false,
  add column pending_info jsonb;

create or replace function public.check_invite(p_token text) returns jsonb language sql stable security definer set search_path = '' as $$
  select case
    when i.id is null then jsonb_build_object('valid', false, 'reason', 'This invite link is not valid.')
    when i.expires_at <= now() then jsonb_build_object('valid', false, 'reason', 'This invite link has expired. Ask MTU staff for a new one.')
    when not i.multi_use and i.used_at is not null then jsonb_build_object('valid', false, 'reason', 'This invite link has already been used.')
    else jsonb_build_object('valid', true, 'expires_at', i.expires_at, 'team', i.multi_use)
  end
  from (select 1) x left join public.invites i on i.token = p_token
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
      where token = meta->>'invite' and expires_at > now() and (multi_use or used_at is null) for update;
    if inv.id is null then
      raise exception 'Sign-up requires a valid invite link from MTU staff';
    end if;
    if inv.multi_use then
      -- Team link: hold the account for staff approval. Nothing touches the roster yet.
      update public.invites set use_count = use_count + 1, used_at = coalesce(used_at, now()) where id = inv.id;
      insert into public.profiles(id, email, display_name, role, approved, member_id, pending, pending_info)
      values (new.id, new.email,
              coalesce(nullif(trim(concat_ws(' ', meta->>'rank', meta->>'first_name', meta->>'last_name')), ''), split_part(new.email, '@', 1)),
              'shooter', false, null, true,
              jsonb_strip_nulls(jsonb_build_object('last_name', meta->>'last_name', 'first_name', meta->>'first_name', 'rank', meta->>'rank',
                'unit', meta->>'unit', 'duty_status', meta->>'duty_status', 'cell_phone', meta->>'cell_phone',
                'mil_email', meta->>'mil_email', 'personal_email', meta->>'personal_email')));
      return new;
    end if;
    update public.invites set used_at = now(), used_by = new.id, use_count = use_count + 1 where id = inv.id;
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

-- Staff approve a team-link sign-up: match them to the roster (or add them), then let them in.
create or replace function public.approve_signup(p_profile uuid, p_member uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare p public.profiles; mid uuid; info jsonb;
begin
  if not (select private.is_staff()) then raise exception 'Staff only'; end if;
  select * into p from public.profiles where id = p_profile and pending for update;
  if p.id is null then raise exception 'That sign-up is no longer waiting for approval.'; end if;
  info := coalesce(p.pending_info, '{}'::jsonb);
  if p_member is not null then
    if exists (select 1 from public.profiles where member_id = p_member) then raise exception 'That roster entry already has an account.'; end if;
    mid := p_member;
  else
    mid := private.match_member(info, p.email);
  end if;
  if mid is not null then
    perform private.fill_member_blanks(mid, info);
  elsif nullif(trim(info->>'last_name'), '') is not null then
    insert into public.members(last_name, first_name, rank, unit, duty_status, team_status, cell_phone, mil_email, personal_email)
    values (trim(info->>'last_name'), nullif(trim(info->>'first_name'), ''), nullif(info->>'rank', ''), nullif(trim(info->>'unit'), ''),
            nullif(info->>'duty_status', ''), 'New', nullif(trim(info->>'cell_phone'), ''),
            nullif(lower(trim(info->>'mil_email')), ''), nullif(lower(trim(info->>'personal_email')), ''))
    returning id into mid;
  end if;
  update public.profiles set approved = true, pending = false, pending_info = null, member_id = mid where id = p.id;
  return mid;
end $$;
revoke all on function public.approve_signup(uuid, uuid) from public, anon;
grant execute on function public.approve_signup(uuid, uuid) to authenticated;
