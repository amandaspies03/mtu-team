-- First-login walkthrough for shooters: remember when someone has finished or skipped it.
alter table public.profiles add column tutorial_done_at timestamptz;

create or replace function public.mark_tutorial_done() returns void
language sql security definer set search_path = '' as $$
  update public.profiles set tutorial_done_at = now() where id = auth.uid();
$$;
revoke all on function public.mark_tutorial_done() from public, anon;
grant execute on function public.mark_tutorial_done() to authenticated;
