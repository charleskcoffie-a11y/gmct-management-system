-- Optional: create minimal class leader records if class_leaders is empty.
-- This helps ClassLeader login by access code.

DO $$
BEGIN
  IF to_regclass('public.class_leaders') IS NULL THEN
    RAISE NOTICE 'Table public.class_leaders does not exist. Skipping.';
    RETURN;
  END IF;
END $$;

insert into public.class_leaders (username, password, class_number, access_code, full_name, active)
values
  ('class1', 'GMCT', '1', 'class1', 'Class 1 Leader', true),
  ('class2', 'GMCT', '2', 'class2', 'Class 2 Leader', true)
on conflict (username)
do update set
  password = excluded.password,
  class_number = excluded.class_number,
  access_code = excluded.access_code,
  full_name = excluded.full_name,
  active = excluded.active;

-- Quick verification
-- select username, class_number, access_code, active from public.class_leaders order by class_number;
