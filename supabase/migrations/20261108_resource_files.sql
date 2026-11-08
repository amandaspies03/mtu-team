-- Private file storage for the Resources tab: approved members can read, staff can upload and delete.
insert into storage.buckets (id, name, public, file_size_limit)
values ('resources', 'resources', false, 26214400)
on conflict (id) do nothing;

create table public.resource_files (
  id uuid primary key default gen_random_uuid(),
  category_id text not null,
  title text not null check (length(trim(title)) > 0),
  path text not null unique,
  size_bytes bigint,
  mime_type text,
  uploaded_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.resource_files(category_id);
create index on public.resource_files(uploaded_by);
alter table public.resource_files enable row level security;
create policy resource_files_read on public.resource_files for select to authenticated using ((select private.is_approved()));
create policy resource_files_staff_insert on public.resource_files for insert to authenticated with check ((select private.is_staff()));
create policy resource_files_staff_update on public.resource_files for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy resource_files_staff_delete on public.resource_files for delete to authenticated using ((select private.is_staff()));
grant select, insert, update, delete on public.resource_files to authenticated;

create policy resources_read on storage.objects for select to authenticated using (bucket_id = 'resources' and (select private.is_approved()));
create policy resources_staff_insert on storage.objects for insert to authenticated with check (bucket_id = 'resources' and (select private.is_staff()));
create policy resources_staff_delete on storage.objects for delete to authenticated using (bucket_id = 'resources' and (select private.is_staff()));

create trigger resource_files_audit after insert or update or delete on public.resource_files for each row execute function private.audit();
