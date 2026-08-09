-- Resolve Security Advisor suggestion: RLS Enabled No Policy on public.sunday_locks
-- Keep behavior aligned with the app's anon/authenticated client access pattern.

alter table if exists public.sunday_locks enable row level security;

drop policy if exists sunday_locks_read on public.sunday_locks;
create policy sunday_locks_read
  on public.sunday_locks
  for select
  to anon, authenticated
  using (coalesce(current_setting('request.jwt.claim.role', true), '') in ('anon', 'authenticated'));

drop policy if exists sunday_locks_insert on public.sunday_locks;
create policy sunday_locks_insert
  on public.sunday_locks
  for insert
  to anon, authenticated
  with check (coalesce(current_setting('request.jwt.claim.role', true), '') in ('anon', 'authenticated'));

drop policy if exists sunday_locks_update on public.sunday_locks;
create policy sunday_locks_update
  on public.sunday_locks
  for update
  to anon, authenticated
  using (coalesce(current_setting('request.jwt.claim.role', true), '') in ('anon', 'authenticated'))
  with check (coalesce(current_setting('request.jwt.claim.role', true), '') in ('anon', 'authenticated'));

drop policy if exists sunday_locks_delete on public.sunday_locks;
create policy sunday_locks_delete
  on public.sunday_locks
  for delete
  to anon, authenticated
  using (coalesce(current_setting('request.jwt.claim.role', true), '') in ('anon', 'authenticated'));
