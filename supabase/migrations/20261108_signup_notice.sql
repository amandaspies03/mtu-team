alter table public.profiles add column pending_notified boolean not null default false;

-- Called (without sign-in) right after a team-link sign-up so staff get a GroupMe heads-up.
-- Returns the person's name only once per pending sign-up, and only for sign-ups made in the last hour.
create or replace function public.claim_signup_notice(p_email text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.profiles;
begin
  update public.profiles set pending_notified = true
   where id = (select id from public.profiles
               where lower(email) = lower(trim(p_email)) and pending and not approved and not pending_notified
                 and created_at > now() - interval '1 hour'
               order by created_at desc limit 1)
  returning * into p;
  if p.id is null then return null; end if;
  return jsonb_build_object('name', coalesce(nullif(trim(concat_ws(' ', p.pending_info->>'rank', p.pending_info->>'first_name', p.pending_info->>'last_name')), ''), p.display_name),
                            'unit', p.pending_info->>'unit');
end $$;
revoke all on function public.claim_signup_notice(text) from public;
grant execute on function public.claim_signup_notice(text) to anon, authenticated;
