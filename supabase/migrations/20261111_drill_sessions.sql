-- Shooter Progression drill scores (Man Card, Bill Drill, 1-Reload-1, Dot Torture), shared by the team.
-- Everyone approved can read every score (leaderboards and comparisons).
-- Shooters can add, edit and delete only their own (member_id = their roster entry). Staff can do this for anyone.
-- The scorecard itself lives in `data` (shape per drill, see app/views/*-drill.tsx); `shot_on` mirrors its date.
create table public.drill_sessions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  drill text not null check (drill in ('man-card', 'bill-drill', 'one-reload-one', 'dot-torture')),
  shot_on date not null,
  data jsonb not null check (jsonb_typeof(data) = 'object' and length(data::text) <= 20000),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index drill_sessions_member on public.drill_sessions(member_id);
create index drill_sessions_drill_date on public.drill_sessions(drill, shot_on);
create index drill_sessions_created_by on public.drill_sessions(created_by);

create or replace function private.drill_touch() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then new.created_by := auth.uid(); new.created_at := now(); end if;
  if tg_op = 'UPDATE' then new.created_by := old.created_by; new.created_at := old.created_at; end if;
  new.updated_at := now();
  return new;
end $$;
revoke execute on function private.drill_touch() from public, anon, authenticated;
create trigger drill_touch before insert or update on public.drill_sessions for each row execute function private.drill_touch();
create trigger audit_drill_sessions after insert or update or delete on public.drill_sessions for each row execute function private.audit();

alter table public.drill_sessions enable row level security;
revoke all on public.drill_sessions from anon;
revoke truncate, references, trigger on public.drill_sessions from authenticated;
grant select, insert, update, delete on public.drill_sessions to authenticated;

create policy drill_read on public.drill_sessions for select to authenticated
  using ((select private.is_approved()));
create policy drill_insert on public.drill_sessions for insert to authenticated
  with check ((select private.is_staff()) or ((select private.is_approved()) and member_id = (select private.my_member_id())));
create policy drill_update on public.drill_sessions for update to authenticated
  using ((select private.is_staff()) or member_id = (select private.my_member_id()))
  with check ((select private.is_staff()) or member_id = (select private.my_member_id()));
create policy drill_delete on public.drill_sessions for delete to authenticated
  using ((select private.is_staff()) or member_id = (select private.my_member_id()));
