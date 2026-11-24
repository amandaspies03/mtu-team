-- Ammo by type (DODIC) instead of fixed 5.56 / 9mm boxes, plus a yearly forecast, so the Ammo page
-- can replace the FY ammo usage spreadsheet.
--   ammo_types      every ammo type assigned to the team (nomenclature, DODIC, caliber)
--   ammo_forecasts  forecasted rounds per type per fiscal year (FY27 = 1 Oct 2026 – 30 Sep 2027)
--   event_ammo      one line per ammo type on a practice / event: rounds requested and drawn
-- All rounds drawn for a practice are shot, so the report counts a practice's drawn rounds as
-- expended once its date has passed. Remaining = forecasted - expended.
-- The old events.ammo_* columns are kept (not dropped) but the app no longer uses them.

create table public.ammo_types (
  id uuid primary key default gen_random_uuid(),
  nomenclature text not null check (length(trim(nomenclature)) > 0),
  dodic text not null unique check (length(trim(dodic)) > 0),
  caliber text not null default 'Other',
  sort integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.ammo_forecasts (
  fiscal_year integer not null check (fiscal_year between 2000 and 2100),
  ammo_type_id uuid not null references public.ammo_types(id) on delete cascade,
  rounds integer not null check (rounds >= 0),
  updated_at timestamptz not null default now(),
  primary key (fiscal_year, ammo_type_id)
);
create index on public.ammo_forecasts(ammo_type_id);

create table public.event_ammo (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  ammo_type_id uuid not null references public.ammo_types(id) on delete restrict,
  requested integer check (requested >= 0),
  drawn integer check (drawn >= 0),
  created_at timestamptz not null default now(),
  unique (event_id, ammo_type_id)
);
create index on public.event_ammo(ammo_type_id);

-- Rounds drawn follow the request (as the old issued counts did) until someone types a different number.
create or replace function private.event_ammo_drawn_follows_request()
returns trigger language plpgsql set search_path to '' as $$
begin
  if tg_op = 'INSERT' then
    new.drawn := coalesce(new.drawn, new.requested);
  elsif new.requested is distinct from old.requested
     and new.drawn is not distinct from old.drawn
     and (old.drawn is null or old.drawn = old.requested) then
    new.drawn := new.requested;
  end if;
  return new;
end $$;
create trigger event_ammo_drawn_follows_request before insert or update on public.event_ammo
  for each row execute function private.event_ammo_drawn_follows_request();

-- Access: ammo managers and full staff (has_duty covers staff) read and write; any approved member can
-- see the list of types (it's not sensitive) but not forecasts or draws.
alter table public.ammo_types enable row level security;
alter table public.ammo_forecasts enable row level security;
alter table public.event_ammo enable row level security;

create policy ammo_types_read on public.ammo_types for select to authenticated using ((select private.is_approved()));
create policy ammo_types_write on public.ammo_types for all to authenticated using ((select private.has_duty('ammo'))) with check ((select private.has_duty('ammo')));
create policy ammo_forecasts_rw on public.ammo_forecasts for all to authenticated using ((select private.has_duty('ammo'))) with check ((select private.has_duty('ammo')));
create policy event_ammo_rw on public.event_ammo for all to authenticated using ((select private.has_duty('ammo'))) with check ((select private.has_duty('ammo')));

grant select, insert, update, delete on public.ammo_types, public.ammo_forecasts, public.event_ammo to authenticated;
revoke all on public.ammo_types, public.ammo_forecasts, public.event_ammo from anon;

create trigger ammo_types_audit after insert or update or delete on public.ammo_types for each row execute function private.audit();
create trigger ammo_forecasts_audit after insert or update or delete on public.ammo_forecasts for each row execute function private.audit();
create trigger event_ammo_audit after insert or update or delete on public.event_ammo for each row execute function private.audit();

-- The six types from the FY27 ammo usage sheet, and their FY27 forecast.
insert into public.ammo_types (nomenclature, dodic, caliber, sort) values
  ('12 Gauge', 'A014', '12 ga', 1),
  ('7.62 M118LR', 'AA11', '7.62', 2),
  ('9mm Frang', 'AA16', '9mm', 3),
  ('9mm M1152 Ball', 'AC20', '9mm', 4),
  ('5.56 Frang', 'AA40', '5.56', 5),
  ('5.56 855A1', 'AB57', '5.56', 6);

insert into public.ammo_forecasts (fiscal_year, ammo_type_id, rounds)
select 2027, t.id, f.rounds from public.ammo_types t
join (values ('A014', 4000), ('AA11', 4000), ('AA16', 16000), ('AC20', 10000), ('AA40', 18000), ('AB57', 8000)) f(dodic, rounds) on f.dodic = t.dodic;

-- Move existing 5.56 / 9mm numbers onto Frangible lines (the only type drawn so far).
insert into public.event_ammo (event_id, ammo_type_id, requested, drawn)
select e.id, t.id, e.ammo_draw_556, coalesce(e.ammo_556, e.ammo_draw_556)
from public.events e join public.ammo_types t on t.dodic = 'AA40'
where e.ammo_draw_556 is not null or e.ammo_556 is not null;
insert into public.event_ammo (event_id, ammo_type_id, requested, drawn)
select e.id, t.id, e.ammo_draw_9mm, coalesce(e.ammo_9mm, e.ammo_draw_9mm)
from public.events e join public.ammo_types t on t.dodic = 'AA16'
where e.ammo_draw_9mm is not null or e.ammo_9mm is not null;

-- Include the new tables in the nightly backup.
create or replace function private.snapshot()
 returns jsonb language sql stable security definer set search_path to ''
as $function$
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
    'staff_emails', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.staff_emails t),
    'ammo_types', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.ammo_types t),
    'ammo_forecasts', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.ammo_forecasts t),
    'event_ammo', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.event_ammo t)
  ) $function$;
