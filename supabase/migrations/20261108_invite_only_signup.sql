-- Invite-only sign-up. Staff sign up with an email on staff_emails; everyone else needs a single-use invite.
-- Each sign-up creates (or fills in) the person's roster entry from the info they enter.
create table public.staff_emails (
  email text primary key check (email = lower(email) and email like '%_@_%'),
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
insert into public.staff_emails(email) values ('amandaspies03@gmail.com');

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default replace(replace(encode(extensions.gen_random_bytes(18), 'base64'), '/', '_'), '+', '-'),
  note text,
  member_id uuid references public.members(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null
);
create index on public.invites(member_id); create index on public.invites(created_by);
create index on public.invites(used_by); create index on public.staff_emails(added_by);

alter table public.staff_emails enable row level security;
alter table public.invites enable row level security;
create policy staff_emails_read on public.staff_emails for select to authenticated using ((select private.is_staff()));
create policy staff_emails_insert on public.staff_emails for insert to authenticated with check ((select private.is_staff()));
create policy staff_emails_delete on public.staff_emails for delete to authenticated using ((select private.is_staff()));
create policy invites_read on public.invites for select to authenticated using ((select private.is_staff()));
create policy invites_insert on public.invites for insert to authenticated with check ((select private.is_staff()));
create policy invites_update on public.invites for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy invites_delete on public.invites for delete to authenticated using ((select private.is_staff()));

create or replace function private.is_staff() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p join public.staff_emails s on s.email = lower(p.email)
                where p.id = auth.uid() and p.approved) $$;

create or replace function private.sync_staff_role() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if not exists (select 1 from public.staff_emails) then raise exception 'At least one staff email is required'; end if;
    update public.profiles set role = 'shooter' where lower(email) = old.email;
    return old;
  end if;
  update public.profiles set role = 'staff', approved = true where lower(email) = new.email;
  return new;
end $$;
create trigger staff_emails_sync after insert or delete on public.staff_emails for each row execute function private.sync_staff_role();

revoke update on public.profiles from authenticated;
grant update (approved, member_id) on public.profiles to authenticated;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  is_staff boolean := exists(select 1 from public.staff_emails where email = lower(new.email));
  inv public.invites;
  mid uuid;
  info jsonb;
begin
  if not is_staff then
    select * into inv from public.invites
      where token = meta->>'invite' and used_at is null and expires_at > now() for update;
    if inv.id is null then
      raise exception 'Sign-up requires a valid invite link from MTU staff';
    end if;
    update public.invites set used_at = now(), used_by = new.id where id = inv.id;
  end if;

  info := jsonb_build_object(
    'last_name', nullif(trim(meta->>'last_name'), ''), 'first_name', nullif(trim(meta->>'first_name'), ''),
    'rank', nullif(meta->>'rank', ''), 'unit', nullif(trim(meta->>'unit'), ''), 'duty_status', nullif(meta->>'duty_status', ''),
    'cell_phone', nullif(trim(meta->>'cell_phone'), ''), 'mil_email', nullif(lower(trim(meta->>'mil_email')), ''),
    'personal_email', nullif(lower(trim(meta->>'personal_email')), ''));

  if info->>'last_name' is not null then
    if inv.member_id is not null then
      mid := inv.member_id;
      update public.members m set
        last_name = info->>'last_name', first_name = coalesce(info->>'first_name', m.first_name), rank = coalesce(info->>'rank', m.rank),
        unit = coalesce(info->>'unit', m.unit), duty_status = coalesce(info->>'duty_status', m.duty_status),
        cell_phone = coalesce(info->>'cell_phone', m.cell_phone), mil_email = coalesce(info->>'mil_email', m.mil_email),
        personal_email = coalesce(info->>'personal_email', m.personal_email)
      where m.id = mid;
    else
      insert into public.members(last_name, first_name, rank, unit, duty_status, team_status, cell_phone, mil_email, personal_email)
      values (info->>'last_name', info->>'first_name', info->>'rank', info->>'unit', info->>'duty_status',
              case when is_staff then 'Active' else 'New' end, info->>'cell_phone', info->>'mil_email', info->>'personal_email')
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

create or replace function public.check_invite(p_token text) returns jsonb language sql stable security definer set search_path = '' as $$
  select case
    when i.id is null then jsonb_build_object('valid', false, 'reason', 'This invite link is not valid.')
    when i.used_at is not null then jsonb_build_object('valid', false, 'reason', 'This invite link has already been used.')
    when i.expires_at <= now() then jsonb_build_object('valid', false, 'reason', 'This invite link has expired. Ask MTU staff for a new one.')
    else jsonb_build_object('valid', true, 'expires_at', i.expires_at)
  end
  from (select 1) x left join public.invites i on i.token = p_token
$$;
revoke execute on function public.check_invite(text) from public;
grant execute on function public.check_invite(text) to anon, authenticated;

create or replace function public.complete_my_profile(info jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare mid uuid; p public.profiles;
begin
  select * into p from public.profiles where id = auth.uid() and approved;
  if p.id is null then raise exception 'Not allowed'; end if;
  if p.member_id is not null then return p.member_id; end if;
  if nullif(trim(info->>'last_name'), '') is null then raise exception 'Last name is required'; end if;
  insert into public.members(last_name, first_name, rank, unit, duty_status, team_status, cell_phone, mil_email, personal_email)
  values (trim(info->>'last_name'), nullif(trim(info->>'first_name'), ''), nullif(info->>'rank', ''), nullif(trim(info->>'unit'), ''),
          nullif(info->>'duty_status', ''), case when p.role = 'staff' then 'Active' else 'New' end,
          nullif(trim(info->>'cell_phone'), ''), nullif(lower(trim(info->>'mil_email')), ''), nullif(lower(trim(info->>'personal_email')), ''))
  returning id into mid;
  update public.profiles set member_id = mid,
    display_name = trim(concat_ws(' ', nullif(info->>'rank', ''), nullif(info->>'first_name', ''), info->>'last_name'))
  where id = p.id;
  return mid;
end $$;
revoke execute on function public.complete_my_profile(jsonb) from public, anon;
grant execute on function public.complete_my_profile(jsonb) to authenticated;
