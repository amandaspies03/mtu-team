-- "What to expect" box on the event page: instructors write what the practice will focus on.
-- Every approved member can read it; only staff can change it (the existing events_staff_update policy covers writes).
alter table public.events add column if not exists what_to_expect text;
grant select (what_to_expect) on public.events to authenticated;
