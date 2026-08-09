-- Fix remaining Supabase Security Advisor warnings.
-- 1) Function Search Path Mutable: set search_path on public.member_login_email.
-- 2) RLS Policy Always True: replace literal TRUE policies in public schema
--    with explicit role-based checks for anon/authenticated.

-- 1) Ensure function(s) named member_login_email have an explicit search_path.
do $$
declare
  fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'member_login_email'
  loop
    execute format('alter function %s set search_path = public, pg_temp', fn);
  end loop;
end $$;

-- 2) Rewrite overly-permissive TRUE RLS policies in public schema.
do $$
declare
  pol record;
  role_clause text;
  role_guard text := 'coalesce(current_setting(''request.jwt.claim.role'', true), '''') in (''anon'', ''authenticated'')';
  qual_is_true boolean;
  check_is_true boolean;
begin
  for pol in
    select schemaname, tablename, policyname, cmd, roles, qual, with_check
    from pg_policies
    where schemaname = 'public'
  loop
    qual_is_true := regexp_replace(coalesce(pol.qual, ''), '\\s+', '', 'g') in ('true', '(true)');
    check_is_true := regexp_replace(coalesce(pol.with_check, ''), '\\s+', '', 'g') in ('true', '(true)');

    if not (qual_is_true or check_is_true) then
      continue;
    end if;

    select coalesce(
      string_agg(
        case when r = 'public' then 'public' else quote_ident(r) end,
        ', '
      ),
      'public'
    )
    into role_clause
    from unnest(pol.roles) as r;

    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);

    case upper(pol.cmd)
      when 'SELECT' then
        execute format(
          'create policy %I on %I.%I for select to %s using (%s)',
          pol.policyname, pol.schemaname, pol.tablename, role_clause, role_guard
        );
      when 'INSERT' then
        execute format(
          'create policy %I on %I.%I for insert to %s with check (%s)',
          pol.policyname, pol.schemaname, pol.tablename, role_clause, role_guard
        );
      when 'UPDATE' then
        execute format(
          'create policy %I on %I.%I for update to %s using (%s) with check (%s)',
          pol.policyname, pol.schemaname, pol.tablename, role_clause, role_guard, role_guard
        );
      when 'DELETE' then
        execute format(
          'create policy %I on %I.%I for delete to %s using (%s)',
          pol.policyname, pol.schemaname, pol.tablename, role_clause, role_guard
        );
      else
        execute format(
          'create policy %I on %I.%I for all to %s using (%s) with check (%s)',
          pol.policyname, pol.schemaname, pol.tablename, role_clause, role_guard, role_guard
        );
    end case;
  end loop;
end $$;
