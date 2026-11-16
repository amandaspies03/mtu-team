-- One team weapon number per shooter, used for both their pistol and rifle (replaces pistol_no / rifle_no).
alter table public.members add column weapon_no integer check (weapon_no between 1 and 24);
update public.members set weapon_no = coalesce(rifle_no, pistol_no) where rifle_no is not null or pistol_no is not null;
create unique index members_weapon_no_key on public.members(weapon_no) where weapon_no is not null;
