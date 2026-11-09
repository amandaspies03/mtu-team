-- The member's own sign-up info now replaces what's on the roster (staff roster was from an outdated list).
-- Anything they leave blank keeps the roster's value. Used by sign-up (individual invites), approve_signup
-- and complete_my_profile. Name kept for compatibility with those callers.
create or replace function private.fill_member_blanks(mid uuid, info jsonb) returns void
language sql security definer set search_path = '' as $$
  update public.members m set
    last_name = coalesce(nullif(trim(info->>'last_name'), ''), m.last_name),
    first_name = coalesce(nullif(trim(info->>'first_name'), ''), m.first_name),
    rank = coalesce(nullif(info->>'rank', ''), m.rank),
    unit = coalesce(nullif(trim(info->>'unit'), ''), m.unit),
    duty_status = coalesce(nullif(info->>'duty_status', ''), m.duty_status),
    cell_phone = coalesce(nullif(trim(info->>'cell_phone'), ''), m.cell_phone),
    mil_email = coalesce(nullif(lower(trim(info->>'mil_email')), ''), m.mil_email),
    personal_email = coalesce(nullif(lower(trim(info->>'personal_email')), ''), m.personal_email)
  where m.id = mid
$$;
