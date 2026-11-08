alter table public.events
  add column ammo_draw_requested_on date,
  add column ammo_draw_556 integer check (ammo_draw_556 >= 0),
  add column ammo_draw_9mm integer check (ammo_draw_9mm >= 0);
