-- Weapons out of service (e.g. a rifle sent off to be fixed). The number can still be assigned (the pistol is fine);
-- a rifle that's down can't be drawn for a practice. Everyone approved can see which are down; staff and vault access mark them.
create table public.weapons_out_of_service (
  weapon_type text not null check (weapon_type in ('rifle', 'pistol')),
  weapon_no integer not null check (weapon_no between 1 and 24),
  note text check (length(note) <= 200),
  marked_by uuid references auth.users(id) on delete set null default auth.uid(),
  marked_at timestamptz not null default now(),
  primary key (weapon_type, weapon_no)
);
create index weapons_oos_marked_by on public.weapons_out_of_service(marked_by);
alter table public.weapons_out_of_service enable row level security;
revoke all on public.weapons_out_of_service from anon;
revoke truncate, references, trigger on public.weapons_out_of_service from authenticated;
grant select, insert, update, delete on public.weapons_out_of_service to authenticated;
create policy oos_read on public.weapons_out_of_service for select to authenticated using ((select private.is_approved()));
create policy oos_insert on public.weapons_out_of_service for insert to authenticated with check ((select private.has_duty('vault')));
create policy oos_update on public.weapons_out_of_service for update to authenticated using ((select private.has_duty('vault'))) with check ((select private.has_duty('vault')));
create policy oos_delete on public.weapons_out_of_service for delete to authenticated using ((select private.has_duty('vault')));
create trigger audit_weapons_out_of_service after insert or update or delete on public.weapons_out_of_service for each row execute function private.audit();

-- Drawing a rifle that's out of service is refused.
create or replace function public.set_event_weapons(p_event uuid, p_list text, p_numbers integer[], p_on boolean)
returns void language plpgsql security definer set search_path to '' as $$
declare cur integer[]; down integer[];
begin
  if not private.has_duty('vault') then raise exception 'You don''t have vault access'; end if;
  if p_list not in ('rifles_out', 'rifles_in', 'pistols_in') then raise exception 'Unknown weapon list'; end if;
  if p_numbers is null or not private.valid_weapon_list(p_numbers) then raise exception 'Weapon numbers run 1–24'; end if;
  if not exists (select 1 from public.events where id = p_event) then raise exception 'Event not found'; end if;
  if p_list = 'rifles_out' and p_on then
    down := array(select weapon_no from public.weapons_out_of_service where weapon_type = 'rifle' and weapon_no = any(p_numbers) order by 1);
    if cardinality(down) > 0 then raise exception 'Rifle % is out of service', array_to_string(down, ', '); end if;
  end if;
  execute format('select %I from public.events where id = $1 for update', p_list) into cur using p_event;
  if p_on then
    cur := array(select distinct x from unnest(cur || p_numbers) x order by x);
  else
    cur := array(select x from unnest(cur) x where x <> all(p_numbers) order by x);
  end if;
  execute format('update public.events set %I = $1 where id = $2', p_list) using cur, p_event;
  if p_list = 'rifles_out' and not p_on then
    update public.events set rifles_in = array(select x from unnest(rifles_in) x where x <> all(p_numbers) order by x) where id = p_event;
  end if;
end $$;
revoke all on function public.set_event_weapons(uuid, text, integer[], boolean) from public, anon;
grant execute on function public.set_event_weapons(uuid, text, integer[], boolean) to authenticated;

-- Out-of-service numbers can't be newly assigned (whoever already has one keeps it).
create or replace function private.weapon_assignable() returns trigger
language plpgsql security definer set search_path to '' as $$
begin
  if new.weapon_no is not null and (tg_op = 'INSERT' or new.weapon_no is distinct from old.weapon_no)
     and exists (select 1 from public.weapons_out_of_service w where w.weapon_type = 'rifle' and w.weapon_no = new.weapon_no) then
    raise exception 'Weapon #% is out of service and can''t be assigned', new.weapon_no;
  end if;
  return new;
end $$;
create trigger members_weapon_assignable before insert or update of weapon_no on public.members
  for each row execute function private.weapon_assignable();
