-- No test data or access assignments survive this transaction.
BEGIN;
DO $test$
DECLARE admin_id uuid; other_id uuid; test_society text; member_id uuid:=gen_random_uuid(); result jsonb; denied boolean;
BEGIN
 SELECT user_id INTO admin_id FROM cmms.user_access WHERE role='software-admin' AND active LIMIT 1;
 SELECT user_id INTO other_id FROM public.user_profiles WHERE active AND role::text<>'admin' ORDER BY created_at LIMIT 1;
 SELECT id INTO test_society FROM cmms.societies WHERE id<>'gmct' ORDER BY id LIMIT 1;
 IF admin_id IS NULL OR other_id IS NULL OR test_society IS NULL THEN RAISE EXCEPTION 'Expected setup identities are missing'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',other_id,'role','authenticated')::text,true);
 PERFORM set_config('request.headers','{"x-cmms-society":"gmct"}',true);
 SET LOCAL ROLE authenticated;
 IF cmms.has_role('gmct') THEN RAISE EXCEPTION 'A planner-only account gained management access'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.cmms_upsert_records('members',jsonb_build_object('id',gen_random_uuid(),'name','__ROLE_TEST__'));
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'A planner-only account wrote management data'; END IF;
 RESET ROLE;

 INSERT INTO cmms.user_access(user_id,society_id,email,role) SELECT other_id,test_society,email,'admin' FROM auth.users WHERE id=other_id;
 PERFORM set_config('request.headers',jsonb_build_object('x-cmms-society',test_society)::text,true);
 SET LOCAL ROLE authenticated;
 SELECT public.cmms_upsert_records('members',jsonb_build_object('id',member_id,'name','__ROLE_TEST__','class_number','1')) INTO result;
 IF result->0->>'society_id'<>test_society THEN RAISE EXCEPTION 'The selected society was not applied'; END IF;
 IF (SELECT count(*) FROM public.cmms_members WHERE id=member_id)<>1 THEN RAISE EXCEPTION 'The society administrator cannot read their own record'; END IF;
 PERFORM set_config('request.headers','{"x-cmms-society":"gmct"}',true);
 IF EXISTS(SELECT 1 FROM public.cmms_members WHERE id=member_id) THEN RAISE EXCEPTION 'A record crossed the society boundary'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.cmms_upsert_records('members',jsonb_build_object('id',gen_random_uuid(),'name','__WRONG_SOCIETY__'));
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'The society boundary allowed a write'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.cmms_grant_user_access((SELECT email FROM public.cmms_user_access WHERE user_id=other_id LIMIT 1),'gmct','software-admin');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'A society administrator escalated their role'; END IF;
 RESET ROLE;

 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
 PERFORM set_config('request.headers',jsonb_build_object('x-cmms-society',test_society)::text,true);
 SET LOCAL ROLE authenticated;
 IF (SELECT count(*) FROM public.cmms_members WHERE id=member_id)<>1 THEN RAISE EXCEPTION 'Software administrator oversight failed'; END IF;
 denied:=false;
 BEGIN PERFORM public.cmms_upsert_records('user_profiles',jsonb_build_object('user_id',other_id));
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'The management API accepted a planner table'; END IF;
 SELECT public.cmms_upsert_records('attendance_marks',jsonb_build_object('date','2099-11-15','member_id',member_id,'status','present','service_type','bible-study','class_number','1')) INTO result;
 SELECT public.cmms_upsert_records('attendance_marks',jsonb_build_object('date','2099-11-15','member_id',member_id,'status','absent','service_type','bible-study','class_number','1')) INTO result;
 IF (SELECT count(*) FROM public.cmms_attendance_marks WHERE date='2099-11-15')<>1 THEN RAISE EXCEPTION 'Attendance upsert did not preserve the member/date key'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.cmms_upsert_records('attendance_marks',jsonb_build_object('date','2099-11-16','member_id',member_id,'status','present','class_number','2'));
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Attendance accepted the wrong member class'; END IF;
 RESET ROLE;
END $test$;
SELECT 'planner_separation_society_isolation_upsert_and_privilege_checks_passed' AS verification;
ROLLBACK;
