-- Restore login visibility/access for app users.
-- Safe: does NOT delete or overwrite rows in public.app_users.

-- 1) Ensure table exists before applying fixes.
do $$
begin
  if to_regclass('public.app_users') is null then
    raise exception 'Table public.app_users does not exist. Create it first before running this script.';
  end if;
end $$;

-- 2) Ensure expected privileges for client roles.
grant select, insert, update, delete on table public.app_users to anon, authenticated;

-- 3) Ensure RLS is enabled, then replace all existing policies on this table
--    with explicit anon/authenticated policies used by this app.
alter table public.app_users enable row level security;

do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'app_users'
  loop
    execute format('drop policy if exists %I on public.app_users', p.policyname);
  end loop;
end $$;

create policy app_users_read
  on public.app_users
  for select
  to anon, authenticated
  using (coalesce(current_setting('request.jwt.claim.role', true), '') in ('anon', 'authenticated'));

create policy app_users_insert
  on public.app_users
  for insert
  to anon, authenticated
  with check (coalesce(current_setting('request.jwt.claim.role', true), '') in ('anon', 'authenticated'));

create policy app_users_update
  on public.app_users
  for update
  to anon, authenticated
  using (coalesce(current_setting('request.jwt.claim.role', true), '') in ('anon', 'authenticated'))
  with check (coalesce(current_setting('request.jwt.claim.role', true), '') in ('anon', 'authenticated'));

create policy app_users_delete
  on public.app_users
  for delete
  to anon, authenticated
  using (coalesce(current_setting('request.jwt.claim.role', true), '') in ('anon', 'authenticated'));

-- 4) Quick verification helpers (run manually after script):
-- select count(*) as app_users_count from public.app_users;
-- select username, role from public.app_users order by username;
