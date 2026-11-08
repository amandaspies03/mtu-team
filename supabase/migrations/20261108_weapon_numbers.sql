-- Team weapon numbers (not serial numbers). 24 pistols and 24 rifles; each number goes to one shooter at a time.
alter table public.members add column pistol_no integer check (pistol_no between 1 and 24);
alter table public.members add column rifle_no integer check (rifle_no between 1 and 24);
create unique index members_pistol_no_key on public.members(pistol_no) where pistol_no is not null;
create unique index members_rifle_no_key on public.members(rifle_no) where rifle_no is not null;
