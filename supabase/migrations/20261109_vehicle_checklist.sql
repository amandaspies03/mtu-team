-- Prep checklist: vehicle requested / vehicle confirmed. Staff-only like the other prep fields
-- (authenticated has column-level SELECT on events, so these stay hidden; staff read them via event_staff_details).
alter table public.events
  add column prep_vehicle_requested boolean not null default false,
  add column prep_vehicle_confirmed boolean not null default false;

drop function public.event_staff_details();
create function public.event_staff_details()
returns table(id uuid, notes text, aar text, ammo_556 integer, ammo_9mm integer, prep_ammo_draw boolean, prep_placard boolean,
              prep_van_driver boolean, van_driver_id uuid, ammo_draw_requested_on date, ammo_draw_556 integer, ammo_draw_9mm integer,
              groupme_posted_at timestamptz, prep_vehicle_requested boolean, prep_vehicle_confirmed boolean)
language sql stable security definer set search_path = '' as $$
  select e.id, e.notes, e.aar, e.ammo_556, e.ammo_9mm, e.prep_ammo_draw, e.prep_placard, e.prep_van_driver, e.van_driver_id,
    e.ammo_draw_requested_on, e.ammo_draw_556, e.ammo_draw_9mm, e.groupme_posted_at, e.prep_vehicle_requested, e.prep_vehicle_confirmed
  from public.events e
  where (select private.is_staff());
$$;
revoke execute on function public.event_staff_details() from public, anon;
grant execute on function public.event_staff_details() to authenticated;
