-- Nightly snapshot of all team data kept 30 days (private schema, not exposed by the API).
create extension if not exists pg_cron;
create table private.backups (
  id bigint generated always as identity primary key,
  taken_at timestamptz not null default now(),
  kind text not null default 'nightly',
  data jsonb not null
);
create or replace function private.snapshot() returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'taken_at', now(),
    'members', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.members t),
    'member_compliance', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.member_compliance t),
    'events', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.events t),
    'attendance', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.attendance t),
    'scores', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.scores t),
    'courses', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.courses t),
    'match_teams', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.match_teams t),
    'match_team_members', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.match_team_members t),
    'profiles', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.profiles t),
    'staff_emails', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.staff_emails t)
  ) $$;
create or replace function private.take_backup(p_kind text default 'nightly') returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into private.backups(kind, data) values (p_kind, private.snapshot());
  delete from private.backups where taken_at < now() - interval '30 days';
end $$;
create or replace function public.list_backups() returns table(id bigint, taken_at timestamptz, kind text, members int, scores int, events int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff() then raise exception 'Staff only'; end if;
  return query select b.id, b.taken_at, b.kind, jsonb_array_length(b.data->'members'), jsonb_array_length(b.data->'scores'), jsonb_array_length(b.data->'events')
    from private.backups b order by b.taken_at desc;
end $$;
create or replace function public.get_backup(p_id bigint) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff() then raise exception 'Staff only'; end if;
  return (select data from private.backups where id = p_id);
end $$;
create or replace function public.backup_now() returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() then raise exception 'Staff only'; end if;
  perform private.take_backup('manual');
end $$;
revoke execute on function public.list_backups(), public.get_backup(bigint), public.backup_now() from public, anon;
grant execute on function public.list_backups(), public.get_backup(bigint), public.backup_now() to authenticated;
select cron.schedule('mtu-nightly-backup', '15 8 * * *', $$select private.take_backup('nightly')$$);
