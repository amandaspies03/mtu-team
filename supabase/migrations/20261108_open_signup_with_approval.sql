-- Anyone can create an account. Staff-list emails get staff access; individual invites get straight in;
-- everyone else waits for staff approval, and is matched to the roster when approved (approve_signup).
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  is_staff boolean := exists(select 1 from public.staff_emails where email = lower(new.email));
  inv public.invites;
  mid uuid;
begin
  if not is_staff then
    -- An individual (single-use) invite still gets people straight in.
    select * into inv from public.invites
      where token = meta->>'invite' and not multi_use and used_at is null and expires_at > now() for update;
    if inv.id is null then
      -- Everyone else (no link, or the team link) waits for staff approval. Nothing touches the roster yet.
      update public.invites set use_count = use_count + 1, used_at = coalesce(used_at, now())
       where token = meta->>'invite' and multi_use and expires_at > now();
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

