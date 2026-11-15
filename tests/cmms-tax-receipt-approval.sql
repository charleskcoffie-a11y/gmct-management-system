-- Verify approval permissions without retaining test access assignments or approval changes.
BEGIN;
DO $test$
DECLARE admin_id uuid; other_id uuid; own_society text; another_society text; denied boolean; affected integer;
BEGIN
 SELECT user_id INTO admin_id FROM cmms.user_access WHERE role='software-admin' AND active LIMIT 1;
 SELECT id INTO other_id FROM auth.users WHERE id<>admin_id AND NOT EXISTS(SELECT 1 FROM cmms.user_access WHERE user_id=auth.users.id) ORDER BY created_at LIMIT 1;
 SELECT id INTO own_society FROM cmms.societies WHERE id<>'gmct' AND status='active' ORDER BY id LIMIT 1;
 another_society:='gmct';
 IF admin_id IS NULL OR other_id IS NULL OR own_society IS NULL THEN RAISE EXCEPTION 'Test identities are missing'; END IF;
 INSERT INTO cmms.user_access(user_id,society_id,email,role) SELECT other_id,own_society,email,'finance-chair' FROM auth.users WHERE id=other_id;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
 PERFORM set_config('request.headers',jsonb_build_object('x-cmms-society',own_society)::text,true);
 SET LOCAL ROLE authenticated;
 UPDATE public.cmms_app_settings SET official_tax_receipts_enabled=true WHERE society_id=own_society;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>1 THEN RAISE EXCEPTION 'Administrator could not approve receipts'; END IF;
 RESET ROLE;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',other_id,'role','authenticated')::text,true);
 SET LOCAL ROLE authenticated;
 IF NOT (SELECT official_tax_receipts_enabled FROM public.cmms_app_settings WHERE society_id=own_society) THEN RAISE EXCEPTION 'Finance chair cannot read approval'; END IF;
 UPDATE public.cmms_app_settings SET official_tax_receipts_enabled=false WHERE society_id=own_society;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>0 THEN RAISE EXCEPTION 'Finance chair changed approval'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.cmms_upsert_records('app_settings',jsonb_build_object('id','app_settings','official_tax_receipts_enabled',false));
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Finance chair changed approval through the save API'; END IF;
 RESET ROLE;
 UPDATE cmms.user_access SET role='admin' WHERE user_id=other_id AND society_id=own_society;
 SET LOCAL ROLE authenticated;
 UPDATE public.cmms_app_settings SET official_tax_receipts_enabled=false WHERE society_id=own_society;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>1 THEN RAISE EXCEPTION 'Society administrator could not return receipts to draft'; END IF;
 PERFORM set_config('request.headers',jsonb_build_object('x-cmms-society',another_society)::text,true);
 denied:=false;
 BEGIN
  PERFORM public.cmms_upsert_records('app_settings',jsonb_build_object('id','app_settings','official_tax_receipts_enabled',true));
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'A society administrator approved another society'; END IF;
 RESET ROLE;
END $test$;
SELECT 'administrator_approval_finance_read_only_and_society_isolation_passed' AS verification;
ROLLBACK;
