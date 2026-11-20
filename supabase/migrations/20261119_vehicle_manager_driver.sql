-- Vehicle managers can pick the van driver (and tick "Van driver" on the prep checklist).

drop function if exists public.event_duty_details();
create function public.event_duty_details()
 returns table(id uuid, prep_vehicle_requested boolean, prep_vehicle_confirmed boolean, prep_van_driver boolean, van_driver_id uuid,
               ammo_556 integer, ammo_9mm integer, prep_ammo_draw boolean, ammo_draw_requested_on date, ammo_draw_556 integer, ammo_draw_9mm integer, attended_count integer)
 language plpgsql stable security definer set search_path to ''
as $function$
declare v boolean := private.has_duty('vehicle'); a boolean := private.has_duty('ammo');
begin
  if not (v or a) then return; end if;
  return query
    select e.id,
      case when v then e.prep_vehicle_requested end, case when v then e.prep_vehicle_confirmed end,
      case when v then e.prep_van_driver end, case when v then e.van_driver_id end,
      case when a then e.ammo_556 end, case when a then e.ammo_9mm end, case when a then e.prep_ammo_draw end,
      case when a then e.ammo_draw_requested_on end, case when a then e.ammo_draw_556 end, case when a then e.ammo_draw_9mm end,
      case when a then (select count(*)::int from public.attendance t where t.event_id = e.id and t.status = 'attended') end
    from public.events e;
end $function$;
revoke all on function public.event_duty_details() from public, anon;
grant execute on function public.event_duty_details() to authenticated, service_role;

create or replace function public.update_event_duty(p_event uuid, p_changes jsonb)
 returns void
 language plpgsql security definer set search_path to ''
as $function$
declare
  k text; val jsonb;
  vehicle_keys text[] := array['prep_vehicle_requested', 'prep_vehicle_confirmed', 'prep_van_driver'];
  ammo_int_keys text[] := array['ammo_556', 'ammo_9mm', 'ammo_draw_556', 'ammo_draw_9mm'];
  v boolean := private.has_duty('vehicle'); a boolean := private.has_duty('ammo');
begin
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' or p_changes = '{}'::jsonb then raise exception 'Nothing to save'; end if;
  if not exists (select 1 from public.events where id = p_event) then raise exception 'Event not found'; end if;
  for k, val in select * from jsonb_each(p_changes) loop
    if k = any(vehicle_keys) then
      if not v then raise exception 'You don''t have vehicle access'; end if;
      if jsonb_typeof(val) <> 'boolean' then raise exception '% must be true or false', k; end if;
    elsif k = 'van_driver_id' then
      if not v then raise exception 'You don''t have vehicle access'; end if;
      if jsonb_typeof(val) <> 'null' and (jsonb_typeof(val) <> 'string'
         or (val #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         or not exists (select 1 from public.members m where m.id = (val #>> '{}')::uuid)) then
        raise exception 'Pick a driver from the roster'; end if;
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
    prep_van_driver = case when p_changes ? 'prep_van_driver' then (p_changes->>'prep_van_driver')::boolean else prep_van_driver end,
    van_driver_id = case when p_changes ? 'van_driver_id' then (p_changes->>'van_driver_id')::uuid else van_driver_id end,
    ammo_556 = case when p_changes ? 'ammo_556' then (p_changes->>'ammo_556')::int else ammo_556 end,
    ammo_9mm = case when p_changes ? 'ammo_9mm' then (p_changes->>'ammo_9mm')::int else ammo_9mm end,
    prep_ammo_draw = case when p_changes ? 'prep_ammo_draw' then (p_changes->>'prep_ammo_draw')::boolean else prep_ammo_draw end,
    ammo_draw_requested_on = case when p_changes ? 'ammo_draw_requested_on' then (p_changes->>'ammo_draw_requested_on')::date else ammo_draw_requested_on end,
    ammo_draw_556 = case when p_changes ? 'ammo_draw_556' then (p_changes->>'ammo_draw_556')::int else ammo_draw_556 end,
    ammo_draw_9mm = case when p_changes ? 'ammo_draw_9mm' then (p_changes->>'ammo_draw_9mm')::int else ammo_draw_9mm end
  where id = p_event;
end $function$;
