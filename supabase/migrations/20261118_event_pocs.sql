-- Points of contact for one event, readable by any approved team member.
-- Shooters can't read events.van_driver_id or other members' phone numbers directly; this returns
-- only the assigned van driver's name and cell so riders know who to contact.
create or replace function public.event_pocs(p_event uuid)
returns table(role text, rank text, first_name text, last_name text, cell_phone text)
language sql stable security definer set search_path to ''
as $$
  select 'Van driver', m.rank, m.first_name, m.last_name, m.cell_phone
  from public.events e join public.members m on m.id = e.van_driver_id
  where e.id = p_event and private.is_approved();
$$;
revoke all on function public.event_pocs(uuid) from public, anon;
grant execute on function public.event_pocs(uuid) to authenticated;
