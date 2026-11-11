-- What's New posts can link to the Shooter Progression page.
alter table public.announcements drop constraint announcements_target_check;
alter table public.announcements add constraint announcements_target_check
  check (target in ('dashboard', 'events', 'scores', 'shooter-progression', 'matchday', 'resources', 'me', 'support'));
