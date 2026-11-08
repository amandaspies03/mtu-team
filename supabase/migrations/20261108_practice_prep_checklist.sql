alter table public.events
  add column prep_ammo_draw boolean not null default false,
  add column prep_placard boolean not null default false,
  add column prep_van_driver boolean not null default false,
  add column van_driver_id uuid references public.members(id) on delete set null;
create index on public.events(van_driver_id);
