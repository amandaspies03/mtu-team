-- Shooters can only say they're going. Staff set every other status on the event page.
create or replace function public.rsvp(p_event uuid, p_status text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare m uuid := private.my_member_id();
begin
  if m is null then raise exception 'Your account is not linked to a roster member yet'; end if;
  if p_status <> 'planned' then raise exception 'You can only RSVP as going. Ask staff to change your status.'; end if;
  insert into public.attendance(event_id, member_id, status) values (p_event, m, 'planned')
  on conflict (event_id, member_id) do update set status = 'planned'
  where public.attendance.status in ('planned','absent');
end $function$;
