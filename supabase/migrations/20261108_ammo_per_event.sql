-- Ammo is issued per practice/match, not per shooter.
alter table public.events add column ammo_556 integer check (ammo_556 >= 0);
alter table public.events add column ammo_9mm integer check (ammo_9mm >= 0);
alter table public.attendance drop column ammo_556;
alter table public.attendance drop column ammo_9mm;
