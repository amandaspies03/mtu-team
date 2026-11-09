-- Support: bug reports and feedback from any approved member, with optional screenshots.
-- Reporters see their own reports and staff replies; staff see everything and set status/reply.
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('bug', 'feedback', 'question')),
  message text not null check (length(trim(message)) between 1 and 4000),
  page text check (page is null or length(page) <= 40),
  device text check (device is null or length(device) <= 300),
  screenshots text[] not null default '{}' check (cardinality(screenshots) <= 5),
  status text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  staff_reply text check (staff_reply is null or length(staff_reply) <= 2000),
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_tickets_created_by on public.support_tickets(created_by);
create index support_tickets_status on public.support_tickets(status, created_at desc);

-- Screenshot paths must sit in the reporter's own folder; reporters can't set staff fields.
create or replace function private.support_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.status := 'open'; new.staff_reply := null; new.notified_at := null;
    new.created_at := now(); new.updated_at := now();
    if exists (select 1 from unnest(new.screenshots) p where p !~ ('^' || new.created_by::text || '/[A-Za-z0-9._-]{1,120}$')) then
      raise exception 'Bad screenshot path';
    end if;
  else
    -- Staff may only change status and reply.
    if new.created_by <> old.created_by or new.kind <> old.kind or new.message <> old.message
       or new.screenshots <> old.screenshots or new.created_at <> old.created_at then
      raise exception 'Only status and reply can be changed';
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;
revoke execute on function private.support_guard() from public, anon, authenticated;
create trigger support_guard before insert or update on public.support_tickets for each row execute function private.support_guard();

alter table public.support_tickets enable row level security;
revoke all on public.support_tickets from anon;
revoke truncate, references, trigger on public.support_tickets from authenticated;
grant select, insert, update on public.support_tickets to authenticated;
create policy support_read on public.support_tickets for select to authenticated
  using (created_by = (select auth.uid()) or (select private.is_staff()));
create policy support_insert on public.support_tickets for insert to authenticated
  with check (created_by = (select auth.uid()) and (select private.is_approved()));
create policy support_staff_update on public.support_tickets for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy support_staff_delete on public.support_tickets for delete to authenticated
  using ((select private.is_staff()));
grant delete on public.support_tickets to authenticated;

-- One GroupMe post per report, only by the person who filed it, only right after filing.
create or replace function public.claim_support_notice(p_ticket uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.support_tickets; who text;
begin
  update public.support_tickets set notified_at = now()
   where id = p_ticket and created_by = auth.uid() and notified_at is null and created_at > now() - interval '10 minutes'
  returning * into t;
  if t.id is null then return null; end if;
  select coalesce(nullif(trim(concat_ws(' ', m.rank, m.first_name, m.last_name)), ''), p.display_name, 'A team member') into who
    from public.profiles p left join public.members m on m.id = p.member_id where p.id = t.created_by;
  return jsonb_build_object('id', t.id, 'kind', t.kind, 'message', t.message, 'page', t.page, 'shots', cardinality(t.screenshots), 'who', who);
end $$;
revoke execute on function public.claim_support_notice(uuid) from public, anon;
grant execute on function public.claim_support_notice(uuid) to authenticated;

-- Private screenshot bucket: images only, 10 MB each. Upload into your own folder; staff read all.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support', 'support', false, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/heif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy support_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'support' and (storage.foldername(name))[1] = (select auth.uid())::text and (select private.is_approved()));
create policy support_read_files on storage.objects for select to authenticated
  using (bucket_id = 'support' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_staff())));
create policy support_staff_delete_files on storage.objects for delete to authenticated
  using (bucket_id = 'support' and (select private.is_staff()));

alter table public.announcements drop constraint announcements_target_check;
alter table public.announcements add constraint announcements_target_check check (target in ('dashboard', 'events', 'scores', 'matchday', 'resources', 'me', 'support'));
-- Saved as a draft; published once the Support page is deployed.
insert into public.announcements (title, body, popup, target, audience, published_at) values
('Report a bug or send feedback',
 E'There''s now a Support page in the menu. Tell us what went wrong or what would make the app better, and attach screenshots if they help.\n\nYou''ll see the status of your reports and any reply from staff on the same page.',
 false, 'support', 'all', null);
