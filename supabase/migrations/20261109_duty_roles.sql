-- Limited staff roles ("duties"). Full staff stay in staff_emails. A duty gives a shooter account
-- extra access to a few event fields only, enforced here (not just hidden in the app):
--   vehicle: prep_vehicle_requested, prep_vehicle_confirmed (practice checklist)
--   ammo:    rounds issued (ammo_556, ammo_9mm) on any event, the ammo-draw checklist item
--            (prep_ammo_draw, ammo_draw_requested_on, ammo_draw_556, ammo_draw_9mm), and the Ammo report.
create table public.staff_duties (
  email text not null check (email = lower(trim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  duty text not null check (duty in ('vehicle', 'ammo')),
  added_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (email, duty)
);
create index staff_duties_added_by on public.staff_duties(added_by);
alter table public.staff_duties enable row level security;
revoke all on public.staff_duties from anon;
revoke truncate, references, trigger on public.staff_duties from authenticated;
grant select, insert, delete on public.staff_duties to authenticated;
create policy duties_read on public.staff_duties for select to authenticated
  using ((select private.is_staff()) or email = (select lower(p.email) from public.profiles p where p.id = (select auth.uid())));
create policy duties_staff_insert on public.staff_duties for insert to authenticated with check ((select private.is_staff()));
create policy duties_staff_delete on public.staff_duties for delete to authenticated using ((select private.is_staff()));
create trigger audit_staff_duties after insert or update or delete on public.staff_duties for each row execute function private.audit();

-- Full staff can do everything a duty allows.
create or replace function private.has_duty(p_duty text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_staff() or exists (
    select 1 from public.profiles p join public.staff_duties d on d.email = lower(p.email)
    where p.id = auth.uid() and p.approved and d.duty = p_duty)
$$;
revoke execute on function private.has_duty(text) from public, anon;
grant execute on function private.has_duty(text) to authenticated;

-- What the signed-in person's duties are (empty for most shooters).
create or replace function public.my_duties() returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(d.duty order by d.duty), '{}')
  from public.profiles p join public.staff_duties d on d.email = lower(p.email)
  where p.id = auth.uid() and p.approved
$$;
revoke execute on function public.my_duties() from public, anon;
grant execute on function public.my_duties() to authenticated;

-- Event fields for duty holders: only the ones their duty covers (others come back null).
create or replace function public.event_duty_details()
returns table(id uuid, prep_vehicle_requested boolean, prep_vehicle_confirmed boolean,
              ammo_556 integer, ammo_9mm integer, prep_ammo_draw boolean, ammo_draw_requested_on date,
              ammo_draw_556 integer, ammo_draw_9mm integer, attended_count integer)
language plpgsql stable security definer set search_path = '' as $$
declare v boolean := private.has_duty('vehicle'); a boolean := private.has_duty('ammo');
begin
  if not (v or a) then return; end if;
  return query
    select e.id,
      case when v then e.prep_vehicle_requested end, case when v then e.prep_vehicle_confirmed end,
      case when a then e.ammo_556 end, case when a then e.ammo_9mm end, case when a then e.prep_ammo_draw end,
      case when a then e.ammo_draw_requested_on end, case when a then e.ammo_draw_556 end, case when a then e.ammo_draw_9mm end,
      case when a then (select count(*)::int from public.attendance t where t.event_id = e.id and t.status = 'attended') end
    from public.events e;
end $$;
revoke execute on function public.event_duty_details() from public, anon;
grant execute on function public.event_duty_details() to authenticated;

-- Save duty fields. Every key must belong to a duty the caller holds; anything else is refused.
create or replace function public.update_event_duty(p_event uuid, p_changes jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  k text; val jsonb;
  vehicle_keys text[] := array['prep_vehicle_requested', 'prep_vehicle_confirmed'];
  ammo_int_keys text[] := array['ammo_556', 'ammo_9mm', 'ammo_draw_556', 'ammo_draw_9mm'];
  v boolean := private.has_duty('vehicle'); a boolean := private.has_duty('ammo');
begin
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' or p_changes = '{}'::jsonb then raise exception 'Nothing to save'; end if;
  if not exists (select 1 from public.events where id = p_event) then raise exception 'Event not found'; end if;
  for k, val in select * from jsonb_each(p_changes) loop
    if k = any(vehicle_keys) then
      if not v then raise exception 'You don''t have vehicle access'; end if;
      if jsonb_typeof(val) <> 'boolean' then raise exception '% must be true or false', k; end if;
    elsif k = any(ammo_int_keys) then
      if not a then raise exception 'You don''t have ammo access'; end if;
      if jsonb_typeof(val) <> 'null' and (jsonb_typeof(val) <> 'number' or (val #>> '{}')::numeric < 0 or (val #>> '{}')::numeric > 1000000 or (val #>> '{}')::numeric <> trunc((val #>> '{}')::numeric)) then
        raise exception '% must be a whole number of rounds', k; end if;
    elsif k = 'prep_ammo_draw' then
      if not a then raise exception 'You don''t have ammo access'; end if;
      if jsonb_typeof(val) <> 'boolean' then raise exception '% must be true or false', k; end if;
    elsif k = 'ammo_draw_requested_on' then
      if not a then raise exception 'You don''t have ammo access'; end if;
      if jsonb_typeof(val) <> 'null' and (jsonb_typeof(val) <> 'string' or (val #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$') then raise exception 'Bad date'; end if;
    else
      raise exception 'Field % can''t be changed here', k;
    end if;
  end loop;
  update public.events set
    prep_vehicle_requested = case when p_changes ? 'prep_vehicle_requested' then (p_changes->>'prep_vehicle_requested')::boolean else prep_vehicle_requested end,
    prep_vehicle_confirmed = case when p_changes ? 'prep_vehicle_confirmed' then (p_changes->>'prep_vehicle_confirmed')::boolean else prep_vehicle_confirmed end,
    ammo_556 = case when p_changes ? 'ammo_556' then (p_changes->>'ammo_556')::int else ammo_556 end,
    ammo_9mm = case when p_changes ? 'ammo_9mm' then (p_changes->>'ammo_9mm')::int else ammo_9mm end,
    prep_ammo_draw = case when p_changes ? 'prep_ammo_draw' then (p_changes->>'prep_ammo_draw')::boolean else prep_ammo_draw end,
    ammo_draw_requested_on = case when p_changes ? 'ammo_draw_requested_on' then (p_changes->>'ammo_draw_requested_on')::date else ammo_draw_requested_on end,
    ammo_draw_556 = case when p_changes ? 'ammo_draw_556' then (p_changes->>'ammo_draw_556')::int else ammo_draw_556 end,
    ammo_draw_9mm = case when p_changes ? 'ammo_draw_9mm' then (p_changes->>'ammo_draw_9mm')::int else ammo_draw_9mm end
  where id = p_event;
end $$;
revoke execute on function public.update_event_duty(uuid, jsonb) from public, anon;
grant execute on function public.update_event_duty(uuid, jsonb) to authenticated;
