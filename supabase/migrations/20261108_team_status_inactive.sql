-- Team statuses: Active, New, Tryout, Inactive (Reserve and Alumni retired).
update public.members set team_status = 'Inactive' where team_status in ('Reserve','Alumni');
alter table public.members drop constraint members_team_status_check;
alter table public.members add constraint members_team_status_check check (team_status in ('Active','New','Tryout','Inactive'));
