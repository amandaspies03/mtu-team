-- Staff-managed list of ranges for the event Location dropdown.
create table public.ranges (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);
alter table public.ranges enable row level security;
create policy ranges_read on public.ranges for select to authenticated using ((select private.is_approved()));
create policy ranges_staff_insert on public.ranges for insert to authenticated with check ((select private.is_staff()));
create policy ranges_staff_update on public.ranges for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy ranges_staff_delete on public.ranges for delete to authenticated using ((select private.is_staff()));
grant select, insert, update, delete on public.ranges to authenticated;
create trigger ranges_audit after insert or update or delete on public.ranges for each row execute function private.audit();
insert into public.ranges (name) values ('Woopat Training Facility (WTF)');
update public.events set location = 'Woopat Training Facility (WTF)' where location = 'WTF';
