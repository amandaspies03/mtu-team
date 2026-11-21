-- 1) Weapon numbers can be shared: not everyone comes to every practice, so several shooters may hold the same number.
drop index if exists public.members_weapon_no_key;

-- 2) Vault access: a limited role (like vehicle / ammo manager) for people on the armory access roster.
--    Weapons only: the weapon roster, and drawing / turning in weapons on practices. No vehicle or ammo access.
alter table public.staff_duties drop constraint staff_duties_duty_check;
alter table public.staff_duties add constraint staff_duties_duty_check check (duty in ('vehicle', 'ammo', 'vault'));

-- 3) Weapons on practices. Pistols: all 24 always go, so only the turn-in is tracked.
--    vault_ids: who is opening the vault (picked by full staff).
create or replace function private.valid_weapon_list(a integer[]) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(bool_and(x between 1 and 24), true) from unnest(a) x
$$;
alter table public.events
  add column vault_ids uuid[] not null default '{}',
  add column rifles_out integer[] not null default '{}' check (private.valid_weapon_list(rifles_out)),
  add column rifles_in integer[] not null default '{}' check (private.valid_weapon_list(rifles_in)),
  add column pistols_in integer[] not null default '{}' check (private.valid_weapon_list(pistols_in));

drop function if exists public.event_staff_details();
create function public.event_staff_details()
 returns table(id uuid, notes text, aar text, ammo_556 integer, ammo_9mm integer, prep_ammo_draw boolean, prep_placard boolean, prep_van_driver boolean, van_driver_id uuid,
               ammo_draw_requested_on date, ammo_draw_556 integer, ammo_draw_9mm integer, groupme_posted_at timestamptz, prep_vehicle_requested boolean, prep_vehicle_confirmed boolean,
               vault_ids uuid[], rifles_out integer[], rifles_in integer[], pistols_in integer[])
 language sql stable security definer set search_path to ''
as $$
  select e.id, e.notes, e.aar, e.ammo_556, e.ammo_9mm, e.prep_ammo_draw, e.prep_placard, e.prep_van_driver, e.van_driver_id,
    e.ammo_draw_requested_on, e.ammo_draw_556, e.ammo_draw_9mm, e.groupme_posted_at, e.prep_vehicle_requested, e.prep_vehicle_confirmed,
    e.vault_ids, e.rifles_out, e.rifles_in, e.pistols_in
  from public.events e
  where (select private.is_staff());
$$;
revoke all on function public.event_staff_details() from public, anon;
grant execute on function public.event_staff_details() to authenticated, service_role;

drop function if exists public.event_duty_details();
create function public.event_duty_details()
 returns table(id uuid, prep_vehicle_requested boolean, prep_vehicle_confirmed boolean, prep_van_driver boolean, van_driver_id uuid,
               ammo_556 integer, ammo_9mm integer, prep_ammo_draw boolean, ammo_draw_requested_on date, ammo_draw_556 integer, ammo_draw_9mm integer, attended_count integer,
               vault_ids uuid[], rifles_out integer[], rifles_in integer[], pistols_in integer[])
 language plpgsql stable security definer set search_path to ''
as $function$
declare v boolean := private.has_duty('vehicle'); a boolean := private.has_duty('ammo'); w boolean := private.has_duty('vault');
begin
  if not (v or a or w) then return; end if;
  return query
    select e.id,
      case when v then e.prep_vehicle_requested end, case when v then e.prep_vehicle_confirmed end,
      case when v then e.prep_van_driver end, case when v then e.van_driver_id end,
      case when a then e.ammo_556 end, case when a then e.ammo_9mm end, case when a then e.prep_ammo_draw end,
      case when a then e.ammo_draw_requested_on end, case when a then e.ammo_draw_556 end, case when a then e.ammo_draw_9mm end,
      case when a then (select count(*)::int from public.attendance t where t.event_id = e.id and t.status = 'attended') end,
      case when w then e.vault_ids end, case when w then e.rifles_out end, case when w then e.rifles_in end, case when w then e.pistols_in end
    from public.events e;
end $function$;
revoke all on function public.event_duty_details() from public, anon;
grant execute on function public.event_duty_details() to authenticated, service_role;

-- Tick weapons out / in. Adds or removes numbers in one step, so two people ticking at once don't overwrite each other.
create or replace function public.set_event_weapons(p_event uuid, p_list text, p_numbers integer[], p_on boolean)
returns void language plpgsql security definer set search_path to '' as $$
declare cur integer[];
begin
  if not private.has_duty('vault') then raise exception 'You don''t have vault access'; end if;
  if p_list not in ('rifles_out', 'rifles_in', 'pistols_in') then raise exception 'Unknown weapon list'; end if;
  if p_numbers is null or not private.valid_weapon_list(p_numbers) then raise exception 'Weapon numbers run 1–24'; end if;
  if not exists (select 1 from public.events where id = p_event) then raise exception 'Event not found'; end if;
  execute format('select %I from public.events where id = $1 for update', p_list) into cur using p_event;
  if p_on then
    cur := array(select distinct x from unnest(cur || p_numbers) x order by x);
  else
    cur := array(select x from unnest(cur) x where x <> all(p_numbers) order by x);
  end if;
  execute format('update public.events set %I = $1 where id = $2', p_list) using cur, p_event;
  -- A rifle taken off the draw list can't be turned in either.
  if p_list = 'rifles_out' and not p_on then
    update public.events set rifles_in = array(select x from unnest(rifles_in) x where x <> all(p_numbers) order by x) where id = p_event;
  end if;
end $$;
revoke all on function public.set_event_weapons(uuid, text, integer[], boolean) from public, anon;
grant execute on function public.set_event_weapons(uuid, text, integer[], boolean) to authenticated;

-- Weapon roster for vault access (shooter accounts can't read other members' rows directly).
create or replace function public.weapon_roster()
returns table(id uuid, rank text, first_name text, last_name text, team_status text, weapon_no integer)
language sql stable security definer set search_path to '' as $$
  select m.id, m.rank, m.first_name, m.last_name, m.team_status, m.weapon_no
  from public.members m where private.has_duty('vault');
$$;
revoke all on function public.weapon_roster() from public, anon;
grant execute on function public.weapon_roster() to authenticated;

-- Points of contact now also list who's opening the vault.
drop function if exists public.event_pocs(uuid);
create function public.event_pocs(p_event uuid)
returns table(role text, rank text, first_name text, last_name text, cell_phone text)
language sql stable security definer set search_path to ''
as $$
  select x.role, x.rank, x.first_name, x.last_name, x.cell_phone from (
    select 'Van driver'::text as role, m.rank, m.first_name, m.last_name, m.cell_phone, 0 as o
    from public.events e join public.members m on m.id = e.van_driver_id
    where e.id = p_event
    union all
    select 'Vault access'::text, m.rank, m.first_name, m.last_name, m.cell_phone, 1
    from public.events e join public.members m on m.id = any(e.vault_ids)
    where e.id = p_event
  ) x
  where private.is_approved()
  order by x.o, x.last_name;
$$;
revoke all on function public.event_pocs(uuid) from public, anon;
grant execute on function public.event_pocs(uuid) to authenticated;

-- 4) Score submissions. Shooters send a score from the Match day scorecard; full staff approve, edit or reject it
--    in the Score queue. Nothing here counts toward stats: approving copies it into public.scores.
create table public.score_submissions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  course_code text not null references public.courses(code) on update cascade,
  shot_on date not null,
  session_label text check (length(session_label) <= 120),
  total numeric not null check (total >= 0 and total <= 1000),
  x_count integer check (x_count between 0 and 100),
  breakdown jsonb check (breakdown is null or pg_column_size(breakdown) < 4000),
  notes text check (length(notes) <= 500),
  submitted_by uuid references auth.users(id) on delete set null default auth.uid(),
  submitted_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text check (length(review_note) <= 500),
  score_id uuid references public.scores(id) on delete set null
);
create index score_submissions_member on public.score_submissions(member_id);
create index score_submissions_pending on public.score_submissions(submitted_at) where status = 'pending';
create index score_submissions_course on public.score_submissions(course_code);
create index score_submissions_submitted_by on public.score_submissions(submitted_by);
create index score_submissions_reviewed_by on public.score_submissions(reviewed_by);
create index score_submissions_score on public.score_submissions(score_id);
alter table public.score_submissions enable row level security;
revoke all on public.score_submissions from anon;
revoke truncate, references, trigger, update on public.score_submissions from authenticated;
grant select, insert, delete on public.score_submissions to authenticated;
create policy subs_read on public.score_submissions for select to authenticated
  using ((select private.is_staff()) or member_id = (select private.my_member_id()));
-- Your own score, as pending. The submit time can come from the phone (sent later if there was no signal) but not from the future.
create policy subs_insert_own on public.score_submissions for insert to authenticated
  with check (member_id = (select private.my_member_id()) and status = 'pending' and reviewed_by is null and reviewed_at is null
    and review_note is null and score_id is null and submitted_by = (select auth.uid())
    and submitted_at <= now() + interval '10 minutes' and submitted_at >= now() - interval '14 days');
-- Shooters can withdraw their own pending score; staff can delete any.
create policy subs_delete on public.score_submissions for delete to authenticated
  using ((select private.is_staff()) or (member_id = (select private.my_member_id()) and status = 'pending'));
create trigger audit_score_submissions after insert or update or delete on public.score_submissions for each row execute function private.audit();

-- Approve (with any edits) or reject. Approving adds the score to the record.
create or replace function public.review_score_submission(p_id uuid, p_action text, p_total numeric default null, p_x integer default null,
  p_shot_on date default null, p_label text default null, p_note text default null)
returns uuid language plpgsql security definer set search_path to '' as $$
declare s public.score_submissions; new_id uuid;
begin
  if not private.is_staff() then raise exception 'Only staff can review scores'; end if;
  select * into s from public.score_submissions where id = p_id for update;
  if not found then raise exception 'Submission not found'; end if;
  if s.status <> 'pending' then raise exception 'This score was already %', s.status; end if;
  if p_action = 'reject' then
    update public.score_submissions set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_note = nullif(trim(p_note), '') where id = p_id;
    return null;
  elsif p_action <> 'approve' then raise exception 'Unknown action';
  end if;
  if coalesce(p_total, s.total) < 0 or coalesce(p_total, s.total) > 1000 then raise exception 'Score out of range'; end if;
  insert into public.scores(member_id, course_code, shot_on, session_label, total, x_count, raw, notes)
  values (s.member_id, s.course_code, coalesce(p_shot_on, s.shot_on), coalesce(nullif(trim(p_label), ''), s.session_label),
    coalesce(p_total, s.total), coalesce(p_x, s.x_count),
    coalesce(p_total, s.total)::text || case when coalesce(p_x, s.x_count) is not null then '-' || coalesce(p_x, s.x_count) || 'X' else '' end,
    concat_ws(' · ', s.notes, 'Submitted by shooter ' || to_char(s.submitted_at at time zone 'America/Chicago', 'DD Mon YYYY HH24:MI') || ' CT'))
  returning id into new_id;
  update public.score_submissions set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), score_id = new_id,
    review_note = nullif(trim(p_note), '') where id = p_id;
  return new_id;
end $$;
revoke all on function public.review_score_submission(uuid, text, numeric, integer, date, text, text) from public, anon;
grant execute on function public.review_score_submission(uuid, text, numeric, integer, date, text, text) to authenticated;
