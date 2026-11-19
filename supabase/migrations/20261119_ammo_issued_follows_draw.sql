-- Rounds issued always match the ammo draw request, so copy the requested amounts into the
-- issued fields. Staff can still type a different issued number; once they do, later changes
-- to the request leave it alone.
create or replace function private.ammo_issued_follows_draw()
returns trigger language plpgsql set search_path to '' as $$
begin
  if tg_op = 'INSERT' then
    new.ammo_556 := coalesce(new.ammo_556, new.ammo_draw_556);
    new.ammo_9mm := coalesce(new.ammo_9mm, new.ammo_draw_9mm);
  else
    if new.ammo_draw_556 is distinct from old.ammo_draw_556
       and new.ammo_556 is not distinct from old.ammo_556
       and (old.ammo_556 is null or old.ammo_556 = old.ammo_draw_556) then
      new.ammo_556 := new.ammo_draw_556;
    end if;
    if new.ammo_draw_9mm is distinct from old.ammo_draw_9mm
       and new.ammo_9mm is not distinct from old.ammo_9mm
       and (old.ammo_9mm is null or old.ammo_9mm = old.ammo_draw_9mm) then
      new.ammo_9mm := new.ammo_draw_9mm;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists ammo_issued_follows_draw on public.events;
create trigger ammo_issued_follows_draw before insert or update on public.events
  for each row execute function private.ammo_issued_follows_draw();

-- Fill in events that already have a request but no issued count.
update public.events set ammo_556 = coalesce(ammo_556, ammo_draw_556), ammo_9mm = coalesce(ammo_9mm, ammo_draw_9mm)
 where (ammo_556 is null and ammo_draw_556 is not null) or (ammo_9mm is null and ammo_draw_9mm is not null);
