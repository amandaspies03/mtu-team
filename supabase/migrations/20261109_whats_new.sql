-- What's new: staff publish app updates; each person's read status is tracked so unread updates show a badge,
-- and updates marked "popup" appear once.
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 120),
  body text not null check (length(trim(body)) between 1 and 4000),
  popup boolean not null default false,
  target text check (target in ('dashboard', 'events', 'scores', 'matchday', 'resources', 'me')),
  audience text not null default 'all' check (audience in ('all', 'staff')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create table public.announcement_reads (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, announcement_id)
);
create index announcement_reads_announcement on public.announcement_reads(announcement_id);
create index announcements_created_by on public.announcements(created_by);

alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;
revoke all on public.announcements, public.announcement_reads from anon;
revoke truncate, references, trigger on public.announcements, public.announcement_reads from authenticated;

-- Everyone approved sees published updates for their audience; staff also see drafts and staff-only notes.
create policy announcements_read on public.announcements for select to authenticated
  using ((select private.is_staff()) or ((select private.is_approved()) and published_at is not null and published_at <= now() and audience = 'all'));
create policy announcements_staff_insert on public.announcements for insert to authenticated with check ((select private.is_staff()));
create policy announcements_staff_update on public.announcements for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy announcements_staff_delete on public.announcements for delete to authenticated using ((select private.is_staff()));

-- Read status: your own rows only.
create policy reads_own_select on public.announcement_reads for select to authenticated using (user_id = (select auth.uid()));
create policy reads_own_insert on public.announcement_reads for insert to authenticated with check (user_id = (select auth.uid()) and (select private.is_approved()));
create policy reads_own_update on public.announcement_reads for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.announcements to authenticated;
grant select, insert, update on public.announcement_reads to authenticated;

-- First updates.
insert into public.announcements (title, body, popup, target, audience, published_at, created_by) values
('Tap the scores tile on Home',
 'The "scores on record" number on the Home page is now a button. Tap it to jump straight to Scores.',
 false, 'dashboard', 'all', now() - interval '3 minutes', null),
('Security update',
 'We tightened security across the app: stricter database permissions, limits on the GroupMe posting service, and upload checks. Nothing changes in how you use the app.',
 false, null, 'all', now() - interval '2 minutes', null),
('Digital scorecard on Match day',
 E'Match day now has a scorecard for every match, right under "How to score."\n\nEnter hits as you count them and it adds up the score for you, X count included. It also flags things like a target with too many hits or a Stage 1 target with no facial hit.\n\nYour entries stay on your phone if the page reloads. Tap "Clear card" to start over.',
 true, 'matchday', 'all', now() - interval '1 minute', null),
('What''s new is here',
 E'This page lists changes to the app. Staff can post updates with "Post an update" at the bottom of this page, save drafts, and mark big ones as a one-time popup.\n\nStaff-only updates are hidden from shooters.',
 false, null, 'staff', now(), null);
