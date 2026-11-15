-- Shared Supabase Auth; independent management access. Existing planner policies are unchanged.
CREATE TABLE cmms.user_access (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 society_id text NOT NULL REFERENCES cmms.societies(id),
 email text NOT NULL,
 full_name text,
 role text NOT NULL CHECK (role IN ('software-admin','admin','finance-chair','finance-team','data-entry','pastor','statistician','class-leader')),
 class_number text,
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (user_id,society_id)
);
CREATE INDEX user_access_society_idx ON cmms.user_access(society_id);
ALTER TABLE cmms.user_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cmms.user_access FROM PUBLIC,anon,authenticated;
GRANT SELECT ON cmms.user_access TO authenticated;
GRANT ALL ON cmms.user_access TO service_role;
GRANT USAGE ON SCHEMA cmms TO authenticated;

CREATE FUNCTION cmms.request_society_id() RETURNS text LANGUAGE sql STABLE SECURITY INVOKER
SET search_path=pg_catalog AS $$
 SELECT nullif(current_setting('request.headers',true),'')::jsonb->>'x-cmms-society';
$$;
CREATE FUNCTION cmms.is_software_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM cmms.user_access a WHERE a.user_id=(SELECT auth.uid()) AND a.active AND a.role='software-admin');
$$;
CREATE FUNCTION cmms.has_role(target_society text, allowed_roles text[] DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM cmms.user_access a
 WHERE a.user_id=(SELECT auth.uid()) AND a.active AND (a.role='software-admin' OR
 (a.society_id=target_society AND (allowed_roles IS NULL OR a.role=ANY(allowed_roles)))))
 AND EXISTS(SELECT 1 FROM cmms.societies s WHERE s.id=target_society AND s.status='active');
$$;
CREATE FUNCTION cmms.can_access(target_society text, allowed_roles text[] DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER
SET search_path=pg_catalog AS $$
 SELECT target_society=cmms.request_society_id() AND cmms.has_role(target_society,allowed_roles);
$$;
CREATE FUNCTION cmms.can_access_class(target_society text, target_class text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog AS $$
 SELECT cmms.can_access(target_society) AND EXISTS(SELECT 1 FROM cmms.user_access a
 WHERE a.user_id=(SELECT auth.uid()) AND a.active AND
 (a.role='software-admin' OR (a.society_id=target_society AND (a.role<>'class-leader' OR a.class_number=target_class))));
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA cmms FROM PUBLIC,anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA cmms TO authenticated;
CREATE POLICY management_access_read ON cmms.user_access FOR SELECT TO authenticated
 USING (user_id=(SELECT auth.uid()) OR cmms.has_role(society_id,ARRAY['admin']));
CREATE VIEW public.cmms_user_access WITH (security_invoker=true) AS SELECT * FROM cmms.user_access;
GRANT SELECT ON public.cmms_user_access TO authenticated;
REVOKE ALL ON public.cmms_user_access FROM PUBLIC,anon;

-- This user's identity already exists; do not copy planner roles to other people.
INSERT INTO cmms.user_access(user_id,society_id,email,full_name,role)
SELECT p.user_id,'gmct',p.email,p.full_name,'software-admin'
FROM public.user_profiles p
WHERE p.active AND p.role::text='admin'
AND lower(p.email)=lower((SELECT value #>> '{}' FROM public.app_settings WHERE setting_key='primary_admin_email'));

-- Public society names can be browsed before sign-in. Private records require explicit management access.
GRANT USAGE ON SCHEMA cmms TO anon;
GRANT SELECT ON cmms.societies TO anon,authenticated;
CREATE POLICY society_directory ON cmms.societies FOR SELECT TO anon,authenticated USING(status='active');
CREATE POLICY society_create ON cmms.societies FOR INSERT TO authenticated WITH CHECK(cmms.is_software_admin());
CREATE POLICY society_update ON cmms.societies FOR UPDATE TO authenticated USING(cmms.is_software_admin()) WITH CHECK(cmms.is_software_admin());
CREATE VIEW public.cmms_societies WITH (security_invoker=true) AS SELECT * FROM cmms.societies;
REVOKE ALL ON public.cmms_societies FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.cmms_societies TO anon,authenticated;
GRANT INSERT,UPDATE ON cmms.societies,public.cmms_societies TO authenticated;

GRANT SELECT,INSERT,UPDATE,DELETE ON cmms.members TO authenticated;
CREATE POLICY management_read ON cmms.members FOR SELECT TO authenticated USING(cmms.can_access(society_id,NULL) AND cmms.can_access_class(society_id,class_number));
CREATE POLICY management_insert ON cmms.members FOR INSERT TO authenticated WITH CHECK(cmms.can_access(society_id,ARRAY['admin','class-leader']) AND cmms.can_access_class(society_id,class_number));
CREATE POLICY management_update ON cmms.members FOR UPDATE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','class-leader']) AND cmms.can_access_class(society_id,class_number)) WITH CHECK(cmms.can_access(society_id,ARRAY['admin','class-leader']) AND cmms.can_access_class(society_id,class_number));
CREATE POLICY management_delete ON cmms.members FOR DELETE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','class-leader']) AND cmms.can_access_class(society_id,class_number));
CREATE VIEW public.cmms_members WITH (security_invoker=true) AS SELECT * FROM cmms.members;
REVOKE ALL ON public.cmms_members FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cmms_members TO authenticated;

GRANT SELECT,INSERT,UPDATE,DELETE ON cmms.entries TO authenticated;
CREATE POLICY management_read ON cmms.entries FOR SELECT TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_insert ON cmms.entries FOR INSERT TO authenticated WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_update ON cmms.entries FOR UPDATE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor'])) WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_delete ON cmms.entries FOR DELETE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE VIEW public.cmms_entries WITH (security_invoker=true) AS SELECT * FROM cmms.entries;
REVOKE ALL ON public.cmms_entries FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cmms_entries TO authenticated;

GRANT SELECT,INSERT,UPDATE,DELETE ON cmms.weekly_history TO authenticated;
CREATE POLICY management_read ON cmms.weekly_history FOR SELECT TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','pastor','statistician']));
CREATE POLICY management_insert ON cmms.weekly_history FOR INSERT TO authenticated WITH CHECK(cmms.can_access(society_id,ARRAY['admin','pastor','statistician']));
CREATE POLICY management_update ON cmms.weekly_history FOR UPDATE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','pastor','statistician'])) WITH CHECK(cmms.can_access(society_id,ARRAY['admin','pastor','statistician']));
CREATE POLICY management_delete ON cmms.weekly_history FOR DELETE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','pastor','statistician']));
CREATE VIEW public.cmms_weekly_history WITH (security_invoker=true) AS SELECT * FROM cmms.weekly_history;
REVOKE ALL ON public.cmms_weekly_history FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cmms_weekly_history TO authenticated;

GRANT SELECT,INSERT,UPDATE,DELETE ON cmms.app_settings TO authenticated;
CREATE POLICY management_read ON cmms.app_settings FOR SELECT TO authenticated USING(cmms.can_access(society_id,NULL));
CREATE POLICY management_insert ON cmms.app_settings FOR INSERT TO authenticated WITH CHECK(cmms.can_access(society_id,ARRAY['admin']));
CREATE POLICY management_update ON cmms.app_settings FOR UPDATE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin'])) WITH CHECK(cmms.can_access(society_id,ARRAY['admin']));
CREATE POLICY management_delete ON cmms.app_settings FOR DELETE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin']));
CREATE VIEW public.cmms_app_settings WITH (security_invoker=true) AS SELECT * FROM cmms.app_settings;
REVOKE ALL ON public.cmms_app_settings FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cmms_app_settings TO authenticated;

GRANT SELECT,INSERT,UPDATE,DELETE ON cmms.month_locks TO authenticated;
CREATE POLICY management_read ON cmms.month_locks FOR SELECT TO authenticated USING(cmms.can_access(society_id,NULL));
CREATE POLICY management_insert ON cmms.month_locks FOR INSERT TO authenticated WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team']));
CREATE POLICY management_update ON cmms.month_locks FOR UPDATE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team'])) WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team']));
CREATE POLICY management_delete ON cmms.month_locks FOR DELETE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team']));
CREATE VIEW public.cmms_month_locks WITH (security_invoker=true) AS SELECT * FROM cmms.month_locks;
REVOKE ALL ON public.cmms_month_locks FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cmms_month_locks TO authenticated;

GRANT SELECT,INSERT,UPDATE,DELETE ON cmms.sunday_locks TO authenticated;
CREATE POLICY management_read ON cmms.sunday_locks FOR SELECT TO authenticated USING(cmms.can_access(society_id,NULL));
CREATE POLICY management_insert ON cmms.sunday_locks FOR INSERT TO authenticated WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team']));
CREATE POLICY management_update ON cmms.sunday_locks FOR UPDATE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team'])) WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team']));
CREATE POLICY management_delete ON cmms.sunday_locks FOR DELETE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team']));
CREATE VIEW public.cmms_sunday_locks WITH (security_invoker=true) AS SELECT * FROM cmms.sunday_locks;
REVOKE ALL ON public.cmms_sunday_locks FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cmms_sunday_locks TO authenticated;

GRANT SELECT,INSERT,UPDATE,DELETE ON cmms.no_name_entries TO authenticated;
CREATE POLICY management_read ON cmms.no_name_entries FOR SELECT TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_insert ON cmms.no_name_entries FOR INSERT TO authenticated WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_update ON cmms.no_name_entries FOR UPDATE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor'])) WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_delete ON cmms.no_name_entries FOR DELETE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE VIEW public.cmms_no_name_entries WITH (security_invoker=true) AS SELECT * FROM cmms.no_name_entries;
REVOKE ALL ON public.cmms_no_name_entries FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cmms_no_name_entries TO authenticated;

GRANT SELECT,INSERT,UPDATE,DELETE ON cmms.member_levies TO authenticated;
CREATE POLICY management_read ON cmms.member_levies FOR SELECT TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_insert ON cmms.member_levies FOR INSERT TO authenticated WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_update ON cmms.member_levies FOR UPDATE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor'])) WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_delete ON cmms.member_levies FOR DELETE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE VIEW public.cmms_member_levies WITH (security_invoker=true) AS SELECT * FROM cmms.member_levies;
REVOKE ALL ON public.cmms_member_levies FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cmms_member_levies TO authenticated;

GRANT SELECT,INSERT,UPDATE,DELETE ON cmms.wesley_hall_receipts TO authenticated;
CREATE POLICY management_read ON cmms.wesley_hall_receipts FOR SELECT TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_insert ON cmms.wesley_hall_receipts FOR INSERT TO authenticated WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_update ON cmms.wesley_hall_receipts FOR UPDATE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor'])) WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_delete ON cmms.wesley_hall_receipts FOR DELETE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE VIEW public.cmms_wesley_hall_receipts WITH (security_invoker=true) AS SELECT * FROM cmms.wesley_hall_receipts;
REVOKE ALL ON public.cmms_wesley_hall_receipts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cmms_wesley_hall_receipts TO authenticated;

GRANT SELECT,INSERT,UPDATE,DELETE ON cmms.assets TO authenticated;
CREATE POLICY management_read ON cmms.assets FOR SELECT TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','pastor']));
CREATE POLICY management_insert ON cmms.assets FOR INSERT TO authenticated WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','pastor']));
CREATE POLICY management_update ON cmms.assets FOR UPDATE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','pastor'])) WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','pastor']));
CREATE POLICY management_delete ON cmms.assets FOR DELETE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','pastor']));
CREATE VIEW public.cmms_assets WITH (security_invoker=true) AS SELECT * FROM cmms.assets;
REVOKE ALL ON public.cmms_assets FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cmms_assets TO authenticated;

GRANT SELECT,INSERT,UPDATE,DELETE ON cmms.asset_maintenance TO authenticated;
CREATE POLICY management_read ON cmms.asset_maintenance FOR SELECT TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','pastor']));
CREATE POLICY management_insert ON cmms.asset_maintenance FOR INSERT TO authenticated WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','pastor']));
CREATE POLICY management_update ON cmms.asset_maintenance FOR UPDATE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','pastor'])) WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','pastor']));
CREATE POLICY management_delete ON cmms.asset_maintenance FOR DELETE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','pastor']));
CREATE VIEW public.cmms_asset_maintenance WITH (security_invoker=true) AS SELECT * FROM cmms.asset_maintenance;
REVOKE ALL ON public.cmms_asset_maintenance FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cmms_asset_maintenance TO authenticated;

GRANT SELECT,INSERT,UPDATE,DELETE ON cmms.etransfers TO authenticated;
CREATE POLICY management_read ON cmms.etransfers FOR SELECT TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_insert ON cmms.etransfers FOR INSERT TO authenticated WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_update ON cmms.etransfers FOR UPDATE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor'])) WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_delete ON cmms.etransfers FOR DELETE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE VIEW public.cmms_etransfers WITH (security_invoker=true) AS SELECT * FROM cmms.etransfers;
REVOKE ALL ON public.cmms_etransfers FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cmms_etransfers TO authenticated;

GRANT SELECT,INSERT,UPDATE,DELETE ON cmms.requisitions TO authenticated;
CREATE POLICY management_read ON cmms.requisitions FOR SELECT TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_insert ON cmms.requisitions FOR INSERT TO authenticated WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_update ON cmms.requisitions FOR UPDATE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor'])) WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_delete ON cmms.requisitions FOR DELETE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE VIEW public.cmms_requisitions WITH (security_invoker=true) AS SELECT * FROM cmms.requisitions;
REVOKE ALL ON public.cmms_requisitions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cmms_requisitions TO authenticated;

GRANT SELECT,INSERT,UPDATE,DELETE ON cmms.requisition_items TO authenticated;
CREATE POLICY management_read ON cmms.requisition_items FOR SELECT TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_insert ON cmms.requisition_items FOR INSERT TO authenticated WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_update ON cmms.requisition_items FOR UPDATE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor'])) WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_delete ON cmms.requisition_items FOR DELETE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE VIEW public.cmms_requisition_items WITH (security_invoker=true) AS SELECT * FROM cmms.requisition_items;
REVOKE ALL ON public.cmms_requisition_items FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cmms_requisition_items TO authenticated;

GRANT SELECT,INSERT,UPDATE,DELETE ON cmms.requisition_approvals TO authenticated;
CREATE POLICY management_read ON cmms.requisition_approvals FOR SELECT TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_insert ON cmms.requisition_approvals FOR INSERT TO authenticated WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_update ON cmms.requisition_approvals FOR UPDATE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor'])) WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_delete ON cmms.requisition_approvals FOR DELETE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE VIEW public.cmms_requisition_approvals WITH (security_invoker=true) AS SELECT * FROM cmms.requisition_approvals;
REVOKE ALL ON public.cmms_requisition_approvals FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cmms_requisition_approvals TO authenticated;

GRANT SELECT,INSERT,UPDATE,DELETE ON cmms.requisition_comments TO authenticated;
CREATE POLICY management_read ON cmms.requisition_comments FOR SELECT TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_insert ON cmms.requisition_comments FOR INSERT TO authenticated WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_update ON cmms.requisition_comments FOR UPDATE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor'])) WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_delete ON cmms.requisition_comments FOR DELETE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE VIEW public.cmms_requisition_comments WITH (security_invoker=true) AS SELECT * FROM cmms.requisition_comments;
REVOKE ALL ON public.cmms_requisition_comments FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cmms_requisition_comments TO authenticated;

GRANT SELECT,INSERT,UPDATE,DELETE ON cmms.utilities TO authenticated;
CREATE POLICY management_read ON cmms.utilities FOR SELECT TO authenticated USING(cmms.can_access(society_id,ARRAY['admin']));
CREATE POLICY management_insert ON cmms.utilities FOR INSERT TO authenticated WITH CHECK(cmms.can_access(society_id,ARRAY['admin']));
CREATE POLICY management_update ON cmms.utilities FOR UPDATE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin'])) WITH CHECK(cmms.can_access(society_id,ARRAY['admin']));
CREATE POLICY management_delete ON cmms.utilities FOR DELETE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin']));
CREATE VIEW public.cmms_utilities WITH (security_invoker=true) AS SELECT * FROM cmms.utilities;
REVOKE ALL ON public.cmms_utilities FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cmms_utilities TO authenticated;

GRANT SELECT,INSERT,UPDATE,DELETE ON cmms.class_leaders TO authenticated;
CREATE POLICY management_read ON cmms.class_leaders FOR SELECT TO authenticated USING(cmms.can_access(society_id,NULL));
REVOKE INSERT,UPDATE,DELETE ON cmms.class_leaders FROM authenticated;
CREATE VIEW public.cmms_class_leaders WITH (security_invoker=true) AS SELECT id,username,class_number,full_name,phone,email,active,created_by,updated_by,last_updated,created_at,society_id FROM cmms.class_leaders;
REVOKE ALL ON public.cmms_class_leaders FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.cmms_class_leaders TO authenticated;

GRANT SELECT,INSERT,UPDATE,DELETE ON cmms.attendance TO authenticated;
CREATE POLICY management_read ON cmms.attendance FOR SELECT TO authenticated USING(cmms.can_access(society_id,NULL) AND cmms.can_access_class(society_id,class_number));
CREATE POLICY management_insert ON cmms.attendance FOR INSERT TO authenticated WITH CHECK(cmms.can_access(society_id,ARRAY['admin','class-leader']) AND cmms.can_access_class(society_id,class_number));
CREATE POLICY management_update ON cmms.attendance FOR UPDATE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','class-leader']) AND cmms.can_access_class(society_id,class_number)) WITH CHECK(cmms.can_access(society_id,ARRAY['admin','class-leader']) AND cmms.can_access_class(society_id,class_number));
CREATE POLICY management_delete ON cmms.attendance FOR DELETE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','class-leader']) AND cmms.can_access_class(society_id,class_number));
CREATE VIEW public.cmms_attendance WITH (security_invoker=true) AS SELECT * FROM cmms.attendance;
REVOKE ALL ON public.cmms_attendance FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cmms_attendance TO authenticated;

GRANT SELECT,INSERT,UPDATE,DELETE ON cmms.member_attendance TO authenticated;
CREATE POLICY management_read ON cmms.member_attendance FOR SELECT TO authenticated USING(cmms.can_access(society_id,NULL) AND cmms.can_access_class(society_id,class_number));
CREATE POLICY management_insert ON cmms.member_attendance FOR INSERT TO authenticated WITH CHECK(cmms.can_access(society_id,ARRAY['admin','class-leader']) AND cmms.can_access_class(society_id,class_number));
CREATE POLICY management_update ON cmms.member_attendance FOR UPDATE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','class-leader']) AND cmms.can_access_class(society_id,class_number)) WITH CHECK(cmms.can_access(society_id,ARRAY['admin','class-leader']) AND cmms.can_access_class(society_id,class_number));
CREATE POLICY management_delete ON cmms.member_attendance FOR DELETE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','class-leader']) AND cmms.can_access_class(society_id,class_number));
CREATE VIEW public.cmms_member_attendance WITH (security_invoker=true) AS SELECT * FROM cmms.member_attendance;
REVOKE ALL ON public.cmms_member_attendance FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cmms_member_attendance TO authenticated;

GRANT SELECT,INSERT,UPDATE,DELETE ON cmms.visitor_attendance TO authenticated;
CREATE POLICY management_read ON cmms.visitor_attendance FOR SELECT TO authenticated USING(cmms.can_access(society_id,NULL) AND cmms.can_access_class(society_id,class_number));
CREATE POLICY management_insert ON cmms.visitor_attendance FOR INSERT TO authenticated WITH CHECK(cmms.can_access(society_id,ARRAY['admin','class-leader']) AND cmms.can_access_class(society_id,class_number));
CREATE POLICY management_update ON cmms.visitor_attendance FOR UPDATE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','class-leader']) AND cmms.can_access_class(society_id,class_number)) WITH CHECK(cmms.can_access(society_id,ARRAY['admin','class-leader']) AND cmms.can_access_class(society_id,class_number));
CREATE POLICY management_delete ON cmms.visitor_attendance FOR DELETE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','class-leader']) AND cmms.can_access_class(society_id,class_number));
CREATE VIEW public.cmms_visitor_attendance WITH (security_invoker=true) AS SELECT * FROM cmms.visitor_attendance;
REVOKE ALL ON public.cmms_visitor_attendance FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cmms_visitor_attendance TO authenticated;

GRANT SELECT,INSERT,UPDATE,DELETE ON cmms.entry_deletions TO authenticated;
CREATE POLICY management_read ON cmms.entry_deletions FOR SELECT TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair']));
CREATE POLICY management_insert ON cmms.entry_deletions FOR INSERT TO authenticated WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_update ON cmms.entry_deletions FOR UPDATE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor'])) WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_delete ON cmms.entry_deletions FOR DELETE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE VIEW public.cmms_entry_deletions WITH (security_invoker=true) AS SELECT * FROM cmms.entry_deletions;
REVOKE ALL ON public.cmms_entry_deletions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cmms_entry_deletions TO authenticated;

GRANT SELECT,INSERT,UPDATE,DELETE ON cmms.organization_funds_organizations TO authenticated;
CREATE POLICY management_read ON cmms.organization_funds_organizations FOR SELECT TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_insert ON cmms.organization_funds_organizations FOR INSERT TO authenticated WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_update ON cmms.organization_funds_organizations FOR UPDATE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor'])) WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_delete ON cmms.organization_funds_organizations FOR DELETE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE VIEW public.cmms_organization_funds_organizations WITH (security_invoker=true) AS SELECT * FROM cmms.organization_funds_organizations;
REVOKE ALL ON public.cmms_organization_funds_organizations FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cmms_organization_funds_organizations TO authenticated;

GRANT SELECT,INSERT,UPDATE,DELETE ON cmms.organization_funds_transactions TO authenticated;
CREATE POLICY management_read ON cmms.organization_funds_transactions FOR SELECT TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_insert ON cmms.organization_funds_transactions FOR INSERT TO authenticated WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_update ON cmms.organization_funds_transactions FOR UPDATE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor'])) WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_delete ON cmms.organization_funds_transactions FOR DELETE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE VIEW public.cmms_organization_funds_transactions WITH (security_invoker=true) AS SELECT * FROM cmms.organization_funds_transactions;
REVOKE ALL ON public.cmms_organization_funds_transactions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cmms_organization_funds_transactions TO authenticated;

GRANT SELECT,INSERT,UPDATE,DELETE ON cmms.parking_receipts TO authenticated;
CREATE POLICY management_read ON cmms.parking_receipts FOR SELECT TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_insert ON cmms.parking_receipts FOR INSERT TO authenticated WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_update ON cmms.parking_receipts FOR UPDATE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor'])) WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_delete ON cmms.parking_receipts FOR DELETE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE VIEW public.cmms_parking_receipts WITH (security_invoker=true) AS SELECT * FROM cmms.parking_receipts;
REVOKE ALL ON public.cmms_parking_receipts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cmms_parking_receipts TO authenticated;

GRANT SELECT,INSERT,UPDATE,DELETE ON cmms.harvest_pledges TO authenticated;
CREATE POLICY management_read ON cmms.harvest_pledges FOR SELECT TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_insert ON cmms.harvest_pledges FOR INSERT TO authenticated WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_update ON cmms.harvest_pledges FOR UPDATE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor'])) WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_delete ON cmms.harvest_pledges FOR DELETE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE VIEW public.cmms_harvest_pledges WITH (security_invoker=true) AS SELECT * FROM cmms.harvest_pledges;
REVOKE ALL ON public.cmms_harvest_pledges FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cmms_harvest_pledges TO authenticated;

GRANT SELECT,INSERT,UPDATE,DELETE ON cmms.harvest_pledge_payments TO authenticated;
CREATE POLICY management_read ON cmms.harvest_pledge_payments FOR SELECT TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_insert ON cmms.harvest_pledge_payments FOR INSERT TO authenticated WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_update ON cmms.harvest_pledge_payments FOR UPDATE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor'])) WITH CHECK(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE POLICY management_delete ON cmms.harvest_pledge_payments FOR DELETE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair','finance-team','data-entry','pastor']));
CREATE VIEW public.cmms_harvest_pledge_payments WITH (security_invoker=true) AS SELECT * FROM cmms.harvest_pledge_payments;
REVOKE ALL ON public.cmms_harvest_pledge_payments FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cmms_harvest_pledge_payments TO authenticated;

GRANT SELECT,INSERT,UPDATE,DELETE ON cmms.tenant_receipt_profiles TO authenticated;
CREATE POLICY management_read ON cmms.tenant_receipt_profiles FOR SELECT TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','finance-chair']));
CREATE POLICY management_insert ON cmms.tenant_receipt_profiles FOR INSERT TO authenticated WITH CHECK(cmms.can_access(society_id,ARRAY['admin']));
CREATE POLICY management_update ON cmms.tenant_receipt_profiles FOR UPDATE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin'])) WITH CHECK(cmms.can_access(society_id,ARRAY['admin']));
CREATE POLICY management_delete ON cmms.tenant_receipt_profiles FOR DELETE TO authenticated USING(cmms.can_access(society_id,ARRAY['admin']));
CREATE VIEW public.cmms_tenant_receipt_profiles WITH (security_invoker=true) AS SELECT * FROM cmms.tenant_receipt_profiles;
REVOKE ALL ON public.cmms_tenant_receipt_profiles FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cmms_tenant_receipt_profiles TO authenticated;

CREATE FUNCTION public.cmms_upsert_records(target_table text, records jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE rows jsonb; item jsonb; columns_sql text; values_sql text; keys_sql text; update_sql text;
 result_row jsonb; result_rows jsonb := '[]'::jsonb; column_names text[]; key_names text[];
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE='42501'; END IF;
 IF NOT (target_table=ANY(ARRAY['members','entries','weekly_history','app_settings','month_locks','sunday_locks','no_name_entries','member_levies','wesley_hall_receipts','assets','asset_maintenance','etransfers','requisitions','requisition_items','requisition_approvals','requisition_comments','utilities','attendance','member_attendance','visitor_attendance','entry_deletions','organization_funds_organizations','organization_funds_transactions','parking_receipts','harvest_pledges','harvest_pledge_payments','tenant_receipt_profiles','societies'])) THEN RAISE EXCEPTION 'Unsupported management table' USING ERRCODE='42501'; END IF;
 rows:=CASE WHEN jsonb_typeof(records)='array' THEN records ELSE jsonb_build_array(records) END;
 IF jsonb_array_length(rows)>1000 THEN RAISE EXCEPTION 'Save no more than 1000 rows at once'; END IF;
 SELECT array_agg(a.attname ORDER BY k.ord) INTO key_names FROM pg_constraint c
 JOIN LATERAL unnest(c.conkey) WITH ORDINALITY k(attnum,ord) ON true
 JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum
 WHERE c.conrelid=format('cmms.%I',target_table)::regclass AND c.contype='p';
 FOR item IN SELECT value FROM jsonb_array_elements(rows) LOOP
  IF jsonb_typeof(item)<>'object' THEN RAISE EXCEPTION 'A record must be an object'; END IF;
  IF target_table<>'societies' THEN item:=item || jsonb_build_object('society_id',cmms.request_society_id()); END IF;
  IF target_table='app_settings' THEN item:=item-'supabase_key'-'etransfer_inbound_secret'; END IF;
  SELECT array_agg(k ORDER BY k) INTO column_names FROM jsonb_object_keys(item) k;
  IF EXISTS(SELECT 1 FROM unnest(column_names) n WHERE NOT EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=format('cmms.%I',target_table)::regclass AND a.attname=n AND a.attnum>0 AND NOT a.attisdropped)) THEN RAISE EXCEPTION 'Unknown record field'; END IF;
  SELECT string_agg(format('%I',n),','),string_agg(format('r.%I',n),',') INTO columns_sql,values_sql FROM unnest(column_names) n;
  SELECT string_agg(format('%I',n),',') INTO keys_sql FROM unnest(key_names) n;
  SELECT string_agg(format('%I=EXCLUDED.%I',n,n),',') INTO update_sql FROM unnest(column_names) n WHERE NOT n=ANY(key_names);
  EXECUTE format('INSERT INTO cmms.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::cmms.%I,$1) r ON CONFLICT (%s) DO UPDATE SET %s RETURNING to_jsonb(%I.*)',target_table,columns_sql,values_sql,target_table,keys_sql,coalesce(update_sql,format('%I=EXCLUDED.%I',key_names[1],key_names[1])),target_table) USING item INTO result_row;
  result_rows:=result_rows||jsonb_build_array(result_row);
 END LOOP;
 RETURN result_rows;
END $fn$;
REVOKE ALL ON FUNCTION public.cmms_upsert_records(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cmms_upsert_records(text,jsonb) TO authenticated;

CREATE FUNCTION cmms.grant_user_access(target_email text,target_society text,target_role text,target_class text DEFAULT NULL,enabled boolean DEFAULT true) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE target_id uuid; target_name text;
BEGIN
 IF NOT cmms.has_role(target_society,ARRAY['admin']) THEN RAISE EXCEPTION 'Management administrator access required' USING ERRCODE='42501'; END IF;
 IF target_role NOT IN ('software-admin','admin','finance-chair','finance-team','data-entry','pastor','statistician','class-leader') THEN RAISE EXCEPTION 'Invalid role'; END IF;
 IF target_role IN ('software-admin','admin') AND NOT cmms.is_software_admin() THEN RAISE EXCEPTION 'Only the software administrator can assign administrator roles' USING ERRCODE='42501'; END IF;
 IF target_role='software-admin' AND target_society<>'gmct' THEN RAISE EXCEPTION 'Software administrator access belongs to the headquarters account'; END IF;
 SELECT id,coalesce(raw_user_meta_data->>'full_name',email) INTO target_id,target_name FROM auth.users WHERE lower(email)=lower(trim(target_email));
 IF target_id IS NULL THEN RAISE EXCEPTION 'That email is not registered yet. Ask the person to create an account on the sign-in page first.'; END IF;
 IF target_id=auth.uid() AND (NOT enabled OR target_role<>'software-admin') AND EXISTS(SELECT 1 FROM cmms.user_access WHERE user_id=target_id AND role='software-admin') THEN RAISE EXCEPTION 'You cannot remove your own software administrator access'; END IF;
 IF target_role='class-leader' AND nullif(trim(target_class),'') IS NULL THEN RAISE EXCEPTION 'Assign a class number for a class leader'; END IF;
 INSERT INTO cmms.user_access(user_id,society_id,email,full_name,role,class_number,active)
 VALUES(target_id,target_society,lower(trim(target_email)),target_name,target_role,nullif(trim(target_class),''),enabled)
 ON CONFLICT(user_id,society_id) DO UPDATE SET role=excluded.role,class_number=excluded.class_number,active=excluded.active,updated_at=now();
 IF target_role='class-leader' THEN
  INSERT INTO cmms.class_leaders(username,password,class_number,access_code,full_name,email,active,society_id)
  VALUES(lower(trim(target_email)),'',target_class,gen_random_uuid()::text,target_name,lower(trim(target_email)),enabled,target_society)
  ON CONFLICT(society_id,username) DO UPDATE SET class_number=excluded.class_number,active=excluded.active;
 END IF;
END $fn$;
REVOKE ALL ON FUNCTION cmms.grant_user_access(text,text,text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION cmms.grant_user_access(text,text,text,text,boolean) TO authenticated;
CREATE FUNCTION public.cmms_grant_user_access(target_email text,target_society text,target_role text,target_class text DEFAULT NULL,enabled boolean DEFAULT true) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT cmms.grant_user_access(target_email,target_society,target_role,target_class,enabled); $$;
REVOKE ALL ON FUNCTION public.cmms_grant_user_access(text,text,text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cmms_grant_user_access(text,text,text,text,boolean) TO authenticated;

CREATE VIEW public.cmms_v_organization_funds_balances WITH (security_invoker=true) AS SELECT * FROM cmms.v_organization_funds_balances;
REVOKE ALL ON public.cmms_v_organization_funds_balances FROM PUBLIC,anon;
GRANT SELECT ON cmms.v_organization_funds_balances,public.cmms_v_organization_funds_balances TO authenticated;
NOTIFY pgrst,'reload schema';
