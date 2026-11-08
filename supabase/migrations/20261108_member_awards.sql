alter table public.members
  add column gov20 boolean not null default false,
  add column chiefs50 boolean not null default false,
  add column eic_badge text check (eic_badge in ('bronze', 'silver', 'gold'));
