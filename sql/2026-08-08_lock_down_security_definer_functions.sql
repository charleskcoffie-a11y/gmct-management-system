-- Lock down SECURITY DEFINER functions that should not be callable by client roles.
-- Addresses Security Advisor warnings:
-- - Public Can Execute SECURITY DEFINER Function
-- - Signed-In Users Can Execute SECURITY DEFINER Function

DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('repair_member_auth_accounts', 'reset_member_password_to_default')
  LOOP
    -- Defense in depth: lock function lookup path.
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn);

    -- Remove execute privileges from broad/client roles.
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn);

    -- Keep callable only from trusted backend/service contexts.
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;
