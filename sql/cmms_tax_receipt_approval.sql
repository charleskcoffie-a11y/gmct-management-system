-- Only the isolated management schema changes. Existing administrator-only settings policies apply.
ALTER TABLE cmms.app_settings ADD COLUMN IF NOT EXISTS official_tax_receipts_enabled boolean NOT NULL DEFAULT false;
DO $view$
DECLARE columns_sql text;
BEGIN
 SELECT string_agg(CASE WHEN attname IN ('supabase_key','etransfer_inbound_secret','class_access_codes') THEN format('NULL::text AS %I',attname) ELSE format('%I',attname) END,',' ORDER BY attnum)
 INTO columns_sql FROM pg_attribute WHERE attrelid='cmms.app_settings'::regclass AND attnum>0 AND NOT attisdropped;
 EXECUTE 'CREATE OR REPLACE VIEW public.cmms_app_settings WITH(security_invoker=true) AS SELECT '||columns_sql||' FROM cmms.app_settings';
END $view$;
NOTIFY pgrst,'reload schema';
