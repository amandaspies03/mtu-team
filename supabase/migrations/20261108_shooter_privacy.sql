-- Shooters (non-staff) see only their own information. Scores stay team-wide so they can compare.

-- Roster: staff see everyone; a shooter sees only their own row.
drop policy members_read on public.members;
create policy members_read on public.members for select to authenticated
  using ((select private.is_staff()) or id = (select private.my_member_id()));

-- Names only (no contact info) so leaderboards can show who's who.
create or replace function public.team_names()
returns table (id uuid, rank text, first_name text, last_name text, team_status text)
language sql stable security definer set search_path = '' as $$
  select m.id, m.rank, m.first_name, m.last_name, m.team_status::text
  from public.members m
  where (select private.is_approved());
$$;
revoke all on function public.team_names() from public, anon;
grant execute on function public.team_names() to authenticated;

-- Attendance: shooters see only their own RSVPs and attendance.
drop policy attendance_read on public.attendance;
create policy attendance_read on public.attendance for select to authenticated
  using ((select private.is_staff()) or member_id = (select private.my_member_id()));

-- Match teams are rosters: staff only.
drop policy match_teams_read on public.match_teams;
create policy match_teams_read on public.match_teams for select to authenticated using ((select private.is_staff()));
drop policy match_team_members_read on public.match_team_members;
create policy match_team_members_read on public.match_team_members for select to authenticated using ((select private.is_staff()));

-- Events: everyone sees the basics; plan, AAR, ammo and prep details are staff-only.
revoke select on public.events from authenticated;
grant select (id, title, kind, start_date, end_date, location, created_at) on public.events to authenticated;

create or replace function public.event_staff_details()
returns table (id uuid, notes text, aar text, ammo_556 integer, ammo_9mm integer,
  prep_ammo_draw boolean, prep_placard boolean, prep_van_driver boolean, van_driver_id uuid,
  ammo_draw_requested_on date, ammo_draw_556 integer, ammo_draw_9mm integer, groupme_posted_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select e.id, e.notes, e.aar, e.ammo_556, e.ammo_9mm, e.prep_ammo_draw, e.prep_placard, e.prep_van_driver, e.van_driver_id,
    e.ammo_draw_requested_on, e.ammo_draw_556, e.ammo_draw_9mm, e.groupme_posted_at
  from public.events e
  where (select private.is_staff());
$$;
revoke all on function public.event_staff_details() from public, anon;
grant execute on function public.event_staff_details() to authenticated;

-- Shooters can update their own contact info (and nothing else on their roster entry).
create or replace function public.update_my_contact(p_cell_phone text, p_mil_email text, p_personal_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare mid uuid := private.my_member_id();
begin
  if mid is null or not (select private.is_approved()) then raise exception 'Your account is not linked to the roster yet.'; end if;
  if p_cell_phone is not null and p_cell_phone <> '' and p_cell_phone !~ '^\d{3}-\d{3}-\d{4}$' then raise exception 'Cell phone must look like 316-555-0100.'; end if;
  if p_mil_email is not null and p_mil_email <> '' and p_mil_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Check the military email.'; end if;
  if p_personal_email is not null and p_personal_email <> '' and p_personal_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Check the personal email.'; end if;
  update public.members set cell_phone = nullif(trim(p_cell_phone), ''), mil_email = nullif(lower(trim(p_mil_email)), ''),
    personal_email = nullif(lower(trim(p_personal_email)), '') where id = mid;
end $$;
revoke all on function public.update_my_contact(text, text, text) from public, anon;
grant execute on function public.update_my_contact(text, text, text) to authenticated;
