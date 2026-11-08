alter table public.members rename column gov20 to gov20_pistol;
alter table public.members add column gov20_rifle boolean not null default false;
