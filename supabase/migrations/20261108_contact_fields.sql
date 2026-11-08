-- Separate cell phone, military email and personal email for each shooter.
alter table public.members rename column phone to cell_phone;
alter table public.members rename column email to mil_email;
alter table public.members add column personal_email text;
