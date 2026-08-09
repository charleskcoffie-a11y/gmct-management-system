-- Restore anon/authenticated client access for core app tables.
-- Use when data exists in Supabase, but app cannot see it due to RLS/grants.

grant usage on schema public to anon, authenticated;

do $$
declare
  t text;
  tables text[] := array[
    'app_users',
    'members',
    'entries',
    'weekly_history',
    'class_leaders',
    'month_locks',
    'sunday_locks',
    'requisitions',
    'app_settings'
  ];
  role_guard text := 'coalesce(current_setting(''request.jwt.claim.role'', true), '''') in (''anon'', ''authenticated'')';
begin
  foreach t in array tables loop
    if to_regclass(format('public.%s', t)) is null then
      raise notice 'Skipping missing table public.%', t;
      continue;
    end if;

    execute format('grant select, insert, update, delete on table public.%I to anon, authenticated', t);
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);

    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (%s)',
      t || '_read', t, role_guard
    );
    execute format(
      'create policy %I on public.%I for insert to anon, authenticated with check (%s)',
      t || '_insert', t, role_guard
    );
    execute format(
      'create policy %I on public.%I for update to anon, authenticated using (%s) with check (%s)',
      t || '_update', t, role_guard, role_guard
    );
    execute format(
      'create policy %I on public.%I for delete to anon, authenticated using (%s)',
      t || '_delete', t, role_guard
    );

    raise notice 'Restored policies for public.%', t;
  end loop;
end $$;

-- Verification queries (run after script)
-- select username, role from public.app_users order by role, username;
-- select count(*) as entries_count from public.entries;
-- select count(*) as members_count from public.members;
