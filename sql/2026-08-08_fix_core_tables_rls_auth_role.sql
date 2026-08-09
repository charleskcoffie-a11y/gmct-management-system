-- Fix core table RLS policies to use auth.role(), which is reliable for Supabase anon/authenticated JWTs.
-- This restores row visibility when policies based on current_setting('request.jwt.claim.role', true)
-- evaluate to empty and hide all rows.

grant usage on schema public to anon, authenticated;

do $$
declare
  t text;
  p record;
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
  role_guard text := '(auth.role() = ''anon'' or auth.role() = ''authenticated'')';
begin
  foreach t in array tables loop
    if to_regclass(format('public.%s', t)) is null then
      raise notice 'Skipping missing table public.%', t;
      continue;
    end if;

    execute format('grant select, insert, update, delete on table public.%I to anon, authenticated', t);
    execute format('alter table public.%I enable row level security', t);

    for p in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;

    execute format('create policy %I on public.%I for select to anon, authenticated using %s', t || '_read', t, role_guard);
    execute format('create policy %I on public.%I for insert to anon, authenticated with check %s', t || '_insert', t, role_guard);
    execute format('create policy %I on public.%I for update to anon, authenticated using %s with check %s', t || '_update', t, role_guard, role_guard);
    execute format('create policy %I on public.%I for delete to anon, authenticated using %s', t || '_delete', t, role_guard);

    raise notice 'Rebuilt policies for public.%', t;
  end loop;
end $$;

-- Verify with these:
-- select username, role from public.app_users order by role, username;
-- select count(*) as entries_count from public.entries;
-- select count(*) as members_count from public.members;
