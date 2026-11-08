-- Schema for the mtu-team Supabase project (applied 2026-11-07).
create table public.members (id uuid primary key default gen_random_uuid(), last_name text not null, first_name text, rank text, unit text,
  duty_status text check (duty_status in ('AGR','Traditional','Technician','DSG','Civilian','Other')),
  team_status text not null default 'Active' check (team_status in ('Active','New','Tryout','Reserve','Alumni')),
  staff_role text, email text, phone text, notes text, created_at timestamptz not null default now());
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, email text, display_name text,
  role text not null default 'shooter' check (role in ('staff','shooter')), approved boolean not null default false,
  member_id uuid references public.members(id) on delete set null, created_at timestamptz not null default now());
create table public.member_compliance (member_id uuid primary key references public.members(id) on delete cascade,
  handgun_qual_date date, handgun_qual_exp date, rifle_qual_date date, rifle_qual_exp date, lautenberg_date date, range_waiver_date date,
  gov_license boolean not null default false, gov_license_date date, vco boolean not null default false, notes text, updated_at timestamptz not null default now());
create table public.events (id uuid primary key default gen_random_uuid(), title text not null,
  kind text not null default 'practice' check (kind in ('practice','match','tryout','qual','cleaning','meeting','other')),
  start_date date not null, end_date date, location text, notes text, aar text, created_at timestamptz not null default now());
create table public.attendance (id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  status text not null default 'planned' check (status in ('planned','attended','absent','excused')),
  orders_status text not null default 'none' check (orders_status in ('none','submitted','cut','signed','not_required')),
  transport text, ammo_556 integer check (ammo_556 >= 0), ammo_9mm integer check (ammo_9mm >= 0), note text, unique (event_id, member_id));
create table public.courses (code text primary key, name text not null, weapon text not null check (weapon in ('Pistol','Rifle')),
  max_score integer, has_x boolean not null default true, sort integer not null default 0);
create table public.scores (id uuid primary key default gen_random_uuid(), member_id uuid not null references public.members(id) on delete cascade,
  course_code text not null references public.courses(code), event_id uuid references public.events(id) on delete set null,
  shot_on date, session_label text, total numeric, x_count integer, raw text, notes text, created_at timestamptz not null default now());
create table public.match_teams (id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete cascade,
  name text not null, nickname text, captain_id uuid references public.members(id) on delete set null);
create table public.match_team_members (team_id uuid not null references public.match_teams(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade, primary key (team_id, member_id));
create table public.links (id uuid primary key default gen_random_uuid(), title text not null, url text not null check (url ~* '^https://'),
  category text, created_at timestamptz not null default now());
create index on public.scores(member_id); create index on public.scores(course_code, shot_on); create index on public.scores(event_id);
create index on public.attendance(member_id); create index on public.match_team_members(member_id); create index on public.match_teams(captain_id);
create index on public.match_teams(event_id); create index on public.profiles(member_id);

create schema if not exists private;
grant usage on schema private to authenticated;
create function private.is_staff() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'staff' and approved) $$;
create function private.is_approved() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and approved) $$;
create function private.my_member_id() returns uuid language sql stable security definer set search_path = '' as $$
  select member_id from public.profiles where id = auth.uid() and approved $$;

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, email, display_name, role, approved)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)),
          case when lower(new.email) = 'amandaspies03@gmail.com' then 'staff' else 'shooter' end,
          lower(new.email) = 'amandaspies03@gmail.com');
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Shooters RSVP only through this function.
create function public.rsvp(p_event uuid, p_status text) returns void language plpgsql security definer set search_path = '' as $$
declare m uuid := private.my_member_id();
begin
  if m is null then raise exception 'Your account is not linked to a roster member yet'; end if;
  if p_status not in ('planned','absent') then raise exception 'Invalid status'; end if;
  insert into public.attendance(event_id, member_id, status) values (p_event, m, p_status)
  on conflict (event_id, member_id) do update set status = excluded.status where public.attendance.status in ('planned','absent');
end $$;
revoke execute on function public.rsvp(uuid,text) from public, anon;
grant execute on function public.rsvp(uuid,text) to authenticated;

alter table public.members enable row level security; alter table public.profiles enable row level security;
alter table public.member_compliance enable row level security; alter table public.events enable row level security;
alter table public.attendance enable row level security; alter table public.courses enable row level security;
alter table public.scores enable row level security; alter table public.match_teams enable row level security;
alter table public.match_team_members enable row level security; alter table public.links enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (id = (select auth.uid()) or (select private.is_staff()));
create policy profiles_staff_update on public.profiles for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy profiles_staff_delete on public.profiles for delete to authenticated using ((select private.is_staff()) and id <> (select auth.uid()));
create policy compliance_read on public.member_compliance for select to authenticated using ((select private.is_staff()) or member_id = (select private.my_member_id()));
create policy compliance_staff_write on public.member_compliance for all to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
do $$ declare t text; begin
  foreach t in array array['members','events','attendance','courses','scores','match_teams','match_team_members','links'] loop
    execute format('create policy %1$s_read on public.%1$s for select to authenticated using ((select private.is_approved()))', t);
    execute format('create policy %1$s_staff_insert on public.%1$s for insert to authenticated with check ((select private.is_staff()))', t);
    execute format('create policy %1$s_staff_update on public.%1$s for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()))', t);
    execute format('create policy %1$s_staff_delete on public.%1$s for delete to authenticated using ((select private.is_staff()))', t);
  end loop;
end $$;
revoke all on all tables in schema public from anon;

insert into public.courses(code,name,weapon,max_score,has_x,sort) values
 ('PISTOL_EIC','Pistol EIC (PI2210)','Pistol',200,true,1), ('PISTOL_AB','Pistol Anti-Body Armor (PI2250)','Pistol',180,true,2),
 ('PISTOL_AFQC','Pistol AF Qual','Pistol',null,false,3), ('RIFLE_EIC','Rifle EIC','Rifle',500,true,4),
 ('RIFLE_RR','Rifle Reflexive Fire (RI3020)','Rifle',180,true,5), ('RIFLE_AFQC','Rifle AF Qual','Rifle',null,false,6),
 ('DOT_TORTURE','Dot Torture (practice)','Pistol',50,false,7), ('PISTOL_EIC_MOD','Pistol EIC – modified course','Pistol',null,true,8),
 ('RIFLE_EIC_MOD','Rifle EIC – modified course','Rifle',null,true,9);
