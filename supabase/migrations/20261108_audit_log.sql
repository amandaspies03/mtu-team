-- Change log: every insert/update/delete on team tables, who did it and what changed. Staff can read; nobody can edit.
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  actor_email text,
  table_name text not null,
  op text not null check (op in ('INSERT','UPDATE','DELETE')),
  row_id text,
  old_data jsonb,
  new_data jsonb
);
create index audit_log_at_idx on public.audit_log(at desc);
create index audit_log_table_idx on public.audit_log(table_name, at desc);
alter table public.audit_log enable row level security;
create policy audit_read on public.audit_log for select to authenticated using ((select private.is_staff()));

create or replace function private.audit() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  k text;
  rid text;
begin
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(n) loop
      if o->k = n->k and k not in ('id','event_id','member_id','last_name','first_name','title','start_date','course_code','email') then
        o := o - k; n := n - k;
      end if;
    end loop;
    if o = n then return new; end if;
  end if;
  rid := coalesce(n->>'id', o->>'id', n->>'member_id', o->>'member_id', n->>'email', o->>'email', n->>'team_id', o->>'team_id');
  insert into public.audit_log(actor_id, actor_email, table_name, op, row_id, old_data, new_data)
  values (auth.uid(), (select email from public.profiles where id = auth.uid()), tg_table_name, tg_op, rid, o, n);
  return coalesce(new, old);
end $$;

do $$ declare t text; begin
  foreach t in array array['members','member_compliance','events','attendance','scores','match_teams','match_team_members','profiles','staff_emails','invites'] loop
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s for each row execute function private.audit()', t);
  end loop;
end $$;
