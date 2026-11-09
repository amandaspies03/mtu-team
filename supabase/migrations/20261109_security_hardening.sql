-- Security hardening (defense in depth). Row-level security already blocks these paths;
-- this removes the underlying privileges so a future policy mistake can't expose data.

-- 1. Signed-out visitors get no direct table access at all. Sign-up uses the auth API and
--    the two public RPCs (check_invite, claim_signup_notice), not tables.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- 2. TRUNCATE ignores row-level security, and REFERENCES/TRIGGER are never needed by the app.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

-- 3. New tables and functions no longer hand out privileges to anon automatically.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon, public;
alter default privileges for role postgres in schema public revoke truncate, references, trigger on tables from authenticated;

-- 4. Internal helpers: nobody calls these directly. Only the three used inside RLS policies stay
--    callable by signed-in users. Triggers and SECURITY DEFINER callers are unaffected.
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_staff(), private.is_approved(), private.my_member_id() to authenticated;
revoke usage on schema private from anon;

-- 5. Public RPCs: only what sign-up needs before login.
revoke execute on function public.approve_signup(uuid, uuid), public.backup_now(), public.get_backup(bigint),
  public.list_backups(), public.complete_my_profile(jsonb), public.event_staff_details(), public.mark_tutorial_done(),
  public.rsvp(uuid, text), public.team_names(), public.update_my_contact(text, text, text) from anon, public;

-- 6. Invite check: reject junk input early.
create or replace function public.check_invite(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case
    when p_token is null or length(p_token) not between 16 and 64 or p_token !~ '^[A-Za-z0-9_-]+$'
      then jsonb_build_object('valid', false, 'reason', 'This invite link is not valid.')
    when i.id is null then jsonb_build_object('valid', false, 'reason', 'This invite link is not valid.')
    when i.expires_at <= now() then jsonb_build_object('valid', false, 'reason', 'This invite link has expired. Ask MTU staff for a new one.')
    when not i.multi_use and i.used_at is not null then jsonb_build_object('valid', false, 'reason', 'This invite link has already been used.')
    else jsonb_build_object('valid', true, 'expires_at', i.expires_at, 'team', i.multi_use)
  end
  from (select 1) x left join public.invites i on i.token = p_token
$$;

-- 7. Sign-up alert: shorter window (15 min) so it can't be used to probe who signed up recently.
create or replace function public.claim_signup_notice(p_email text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.profiles;
begin
  if p_email is null or length(p_email) > 320 then return null; end if;
  update public.profiles set pending_notified = true
   where id = (select id from public.profiles
               where lower(email) = lower(trim(p_email)) and pending and not approved and not pending_notified
                 and created_at > now() - interval '15 minutes'
               order by created_at desc limit 1)
  returning * into p;
  if p.id is null then return null; end if;
  return jsonb_build_object('name', left(coalesce(nullif(trim(concat_ws(' ', p.pending_info->>'rank', p.pending_info->>'first_name', p.pending_info->>'last_name')), ''), p.display_name), 80),
                            'unit', left(p.pending_info->>'unit', 60));
end $$;
grant execute on function public.check_invite(text), public.claim_signup_notice(text) to anon, authenticated;

-- 8. Sign-up details come from whoever fills in the form: cap their size.
alter table public.profiles
  add constraint profiles_display_name_len check (length(display_name) <= 120) not valid,
  add constraint profiles_pending_info_len check (pending_info is null or length(pending_info::text) <= 2000) not valid;
alter table public.profiles validate constraint profiles_display_name_len;
alter table public.profiles validate constraint profiles_pending_info_len;

-- 9. Resource uploads: documents and images only (no HTML/SVG/scripts), 25 MB max.
update storage.buckets set allowed_mime_types = array[
  'application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/heic', 'text/plain', 'text/csv',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
] where id = 'resources';
