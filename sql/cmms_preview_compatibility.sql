-- Compatibility for the current management UI; only new cmms objects are changed.
CREATE TABLE cmms.attendance_marks (
 id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
 society_id text NOT NULL REFERENCES cmms.societies(id),
 date date NOT NULL,
 member_id uuid NOT NULL,
 status text NOT NULL CHECK(status IN ('present','absent','sick','travel','catechumen')),
 service_type text NOT NULL DEFAULT 'sunday' CHECK(service_type IN ('sunday','bible-study')),
 class_number text,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(society_id,date,member_id,service_type),
 FOREIGN KEY(member_id,society_id) REFERENCES cmms.members(id,society_id)
);
CREATE INDEX attendance_marks_member_idx ON cmms.attendance_marks(member_id,society_id);
ALTER TABLE cmms.attendance_marks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cmms.attendance_marks FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON cmms.attendance_marks TO authenticated,service_role;
CREATE POLICY attendance_marks_read ON cmms.attendance_marks FOR SELECT TO authenticated USING(cmms.can_access(society_id) AND cmms.can_access_class(society_id,class_number));
CREATE POLICY attendance_marks_write ON cmms.attendance_marks FOR ALL TO authenticated USING(cmms.can_access(society_id,ARRAY['admin','class-leader']) AND cmms.can_access_class(society_id,class_number)) WITH CHECK(cmms.can_access(society_id,ARRAY['admin','class-leader']) AND cmms.can_access_class(society_id,class_number));
CREATE VIEW public.cmms_attendance_marks WITH(security_invoker=true) AS SELECT * FROM cmms.attendance_marks;
REVOKE ALL ON public.cmms_attendance_marks FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cmms_attendance_marks TO authenticated;

DO $view$
DECLARE columns_sql text;
BEGIN
 SELECT string_agg(CASE WHEN attname IN ('supabase_key','etransfer_inbound_secret','class_access_codes') THEN format('NULL::text AS %I',attname) ELSE format('%I',attname) END,',' ORDER BY attnum)
 INTO columns_sql FROM pg_attribute WHERE attrelid='cmms.app_settings'::regclass AND attnum>0 AND NOT attisdropped;
 EXECUTE 'CREATE OR REPLACE VIEW public.cmms_app_settings WITH(security_invoker=true) AS SELECT '||columns_sql||' FROM cmms.app_settings';
END $view$;

CREATE FUNCTION cmms.initialize_society_settings() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT cmms.is_software_admin() THEN RAISE EXCEPTION 'Software administrator access required' USING ERRCODE='42501'; END IF;
 INSERT INTO cmms.app_settings(society_id,id,currency,max_classes,enforce_directory,org_name)
 VALUES(new.id,'app_settings','CAD',5,true,new.name);
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION cmms.initialize_society_settings() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER initialize_management_society AFTER INSERT ON cmms.societies FOR EACH ROW EXECUTE FUNCTION cmms.initialize_society_settings();
CREATE POLICY software_admin_society_directory ON cmms.societies FOR SELECT TO authenticated USING(cmms.is_software_admin());

CREATE OR REPLACE FUNCTION public.cmms_upsert_records(target_table text, records jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE rows jsonb; item jsonb; columns_sql text; values_sql text; keys_sql text; update_sql text;
 result_row jsonb; result_rows jsonb := '[]'::jsonb; column_names text[]; key_names text[];
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE='42501'; END IF;
 IF NOT (target_table=ANY(ARRAY['members','entries','weekly_history','app_settings','month_locks','sunday_locks','no_name_entries','member_levies','wesley_hall_receipts','assets','asset_maintenance','etransfers','requisitions','requisition_items','requisition_approvals','requisition_comments','utilities','attendance','member_attendance','visitor_attendance','entry_deletions','organization_funds_organizations','organization_funds_transactions','parking_receipts','harvest_pledges','harvest_pledge_payments','tenant_receipt_profiles','societies','attendance_marks'])) THEN RAISE EXCEPTION 'Unsupported management table' USING ERRCODE='42501'; END IF;
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
NOTIFY pgrst,'reload schema';

-- Attendance records must belong to the member's real class.
CREATE FUNCTION cmms.validate_attendance_member_class() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE actual_class text;
BEGIN
 SELECT class_number INTO actual_class FROM cmms.members WHERE id=new.member_id AND society_id=new.society_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Member access is required for attendance' USING ERRCODE='42501'; END IF;
 IF new.class_number IS NOT NULL AND new.class_number IS DISTINCT FROM actual_class THEN RAISE EXCEPTION 'Attendance class must match the member class' USING ERRCODE='42501'; END IF;
 new.class_number:=actual_class;
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION cmms.validate_attendance_member_class() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER validate_member_class BEFORE INSERT OR UPDATE ON cmms.attendance_marks FOR EACH ROW EXECUTE FUNCTION cmms.validate_attendance_member_class();
