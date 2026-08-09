-- Emergency seed for login accounts when public.app_users is empty.
-- Use this to restore access quickly before service.
-- NOTE: This creates baseline accounts only; restore full historical users from backup later.

-- Ensure table exists
DO $$
BEGIN
  IF to_regclass('public.app_users') IS NULL THEN
    RAISE EXCEPTION 'Table public.app_users does not exist.';
  END IF;
END $$;

-- Upsert baseline users (safe to re-run)
insert into public.app_users (username, password, role, class_led)
values
  ('Admin', 'GMCT', 'admin', null),
  ('FinanceTeam', 'GMCT', 'finance-team', null),
  ('Pastor', 'GMCT', 'pastor', null),
  ('DataEntry', 'GMCT', 'data-entry', null),
  ('ClassLeader', '', 'class-leader', null)
on conflict (username)
do update set
  password = excluded.password,
  role = excluded.role,
  class_led = excluded.class_led;

-- Quick verification
-- select username, role from public.app_users order by username;
