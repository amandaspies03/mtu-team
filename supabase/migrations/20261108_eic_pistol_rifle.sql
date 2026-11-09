-- EIC badges are earned separately for pistol and rifle. Existing values were moved to pistol.
alter table public.members rename column eic_badge to eic_pistol;
alter table public.members add column eic_rifle text check (eic_rifle in ('bronze', 'silver', 'gold'));
