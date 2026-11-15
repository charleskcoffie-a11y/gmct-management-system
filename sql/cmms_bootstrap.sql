-- Canada Mission Management System: standalone bootstrap for an EXISTING project.
-- Target: CANADA MISSION PLANNER (wqdcxqnagftyshqxltec), schema cmms only.
-- Does not copy GMCT data, change public tables, or expose a new Data API schema.
-- No shared/default passwords or authentication accounts are created.
DO $guard$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cmms') THEN
    RAISE EXCEPTION 'cmms already exists; inspect it before running a bootstrap';
  END IF;
END $guard$;
CREATE SCHEMA cmms;
REVOKE ALL ON SCHEMA cmms FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA cmms TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA cmms REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA cmms REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA cmms REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;


-- Source: sql/2026-08-30_create_societies_and_multitenancy.sql
create table if not exists cmms.societies (
    id text primary key, 
    code text unique not null,
    name text not null,
    short_name text not null,
    city text not null,
    province text not null,
    province_code text not null,
    is_primary boolean not null default false,
    address text,
    phone text,
    email text,
    features jsonb not null default '{}'::jsonb,
    accent_color text default 'indigo',
    created_at timestamptz not null default now()
);

-- Source: README.md
create table if not exists cmms.members (
    id uuid primary key default gen_random_uuid(),
    name text not null,
  society_id text not null default 'gmct' references cmms.societies(id)
);

-- Source: sql/2026-01-06_create_weekly_history_table.sql
create table if not exists cmms.weekly_history (
  id uuid primary key default gen_random_uuid(),
  date_of_service date not null,
  society_name text not null default 'Ghana Methodist Church Toronto (GMCT)',
  data jsonb not null,
  created_by text,
  updated_by text,
  last_updated timestamptz default now(),
  created_at timestamptz default now(),
  unique(id),
  society_id text not null default 'gmct' references cmms.societies(id)
);

-- Source: README.md
create table if not exists cmms.app_users (
    username text,
    password text not null,
    role text not null,
    class_led text,
    created_at timestamp with time zone default timezone('utc'::text, now()),
  society_id text not null default 'gmct' references cmms.societies(id),
  primary key (society_id, username)
);

-- Source: sql/2026-01-08_create_month_locks_table.sql
create table if not exists cmms.month_locks (
  month text,
  is_locked boolean not null default false,
  locked_by text,
  locked_at timestamptz,
  society_id text not null default 'gmct' references cmms.societies(id),
  primary key (society_id, month)
);

-- Source: sql/2025-12-15_create_app_settings_table.sql
CREATE TABLE IF NOT EXISTS cmms.app_settings (
    id TEXT DEFAULT 'app_settings',
    currency TEXT DEFAULT 'CAD',
    max_classes INTEGER DEFAULT 14,
    enforce_directory BOOLEAN DEFAULT true,
    supabase_url TEXT,
    logo_url TEXT,
    org_name TEXT,
    org_address TEXT,
    org_phone TEXT,
    org_email TEXT,
    charity_number TEXT,
    signature_image TEXT,
    annual_levy_amount NUMERIC(10,2),
    etransfer_notification_email TEXT,
    etransfer_provider TEXT,
    requisition_approval_limits TEXT,
    requisition_pastor_limits TEXT,
    requisition_finance_approvers TEXT,
    class_access_codes TEXT, 
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
  society_id text not null default 'gmct' references cmms.societies(id),
  primary key (society_id, id)
);

-- Source: README.md
create table if not exists cmms.no_name_entries (
    id uuid primary key default gen_random_uuid(),
    date date not null,
    amount numeric not null,
    notes text,
    created_by text,
    updated_at timestamp with time zone default timezone('utc'::text, now()),
    created_at timestamp with time zone default timezone('utc'::text, now()),
    data jsonb,
  society_id text not null default 'gmct' references cmms.societies(id)
);

-- Source: sql/2025-12-30_create_member_levies_table.sql
CREATE TABLE IF NOT EXISTS cmms.member_levies (
    id TEXT PRIMARY KEY,
    member_id uuid NOT NULL references cmms.members(id),
    year INTEGER NOT NULL,
    base_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    carry_over NUMERIC(10,2) NOT NULL DEFAULT 0,
    remaining NUMERIC(10,2) NOT NULL DEFAULT 0,
    class_number TEXT,
    group_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(society_id, member_id, year),
  society_id text not null default 'gmct' references cmms.societies(id)
);

-- Source: sql/2026-08-13_create_wesley_hall_receipts_table.sql
create table if not exists cmms.wesley_hall_receipts (
  id uuid primary key,
  date date not null,
  amount numeric(12,2) not null default 0,
  notes text,
  created_by text,
  updated_by text,
  last_updated timestamptz,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  society_id text not null default 'gmct' references cmms.societies(id)
);

-- Source: README.md
create table if not exists cmms.assets (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    category text, 
    description text,
    location text,
    purchase_date date,
    purchase_price numeric,
    current_value numeric,
    serial_number text,
    model text,
    condition text, 
    status text, 
    assigned_to text,
    warranty_expires date,
    insurance_policy text,
    insurance_coverage numeric,
    insurance_expires date,
    photo_url text,
    notes text,
    useful_life_years integer,
    disposal_date date,
    disposal_method text,
    disposal_value numeric,
    disposal_notes text,
    created_by text,
    updated_by text,
    created_at timestamptz default timezone('utc'::text, now()),
    updated_at timestamptz,
    deleted boolean default false,
  society_id text not null default 'gmct' references cmms.societies(id)
);

-- Source: sql/2025-12-23_create_etransfers_table.sql
create table if not exists cmms.etransfers (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  amount numeric(12,2),
  currency text,
  sender_name text,
  sender_email text,
  memo text,
  raw_subject text,
  raw_text text,
  reconciled boolean not null default false,
  created_at timestamptz not null default now(),
  society_id text not null default 'gmct' references cmms.societies(id)
);

-- Source: sql/2025-12-23_create_requisitions.sql
create table if not exists cmms.requisitions (
  id uuid primary key,
  requester_username text not null,
  requester_name text,
  title text not null,
  purpose text,
  intended_for text,
  purchase_type text,
  fund text,
  needed_by date,
  total_amount numeric(12,2) default 0 not null,
  status text not null default 'draft', 
  source_type text,
  required_approver_role text,
  required_approver_username text,
  completion_attachment_url text,
  completion_attachment_at timestamptz,
  uploaded_pdf jsonb,
  created_at timestamptz default now(),
  updated_by text,
  last_updated timestamptz,
  society_id text not null default 'gmct' references cmms.societies(id)
);

-- Source: sql/2025-12-30_create_utilities_table.sql
CREATE TABLE IF NOT EXISTS cmms.utilities (
    key TEXT,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by TEXT,
  society_id text not null default 'gmct' references cmms.societies(id),
  primary key (society_id, key)
);

-- Source: sql/2025-12-31_create_class_leaders_table.sql
create table if not exists cmms.class_leaders (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  password text not null,
  class_number text not null,
  access_code text not null,
  full_name text,
  phone text,
  email text,
  active boolean not null default true,
  created_by text,
  updated_by text,
  last_updated timestamptz default now(),
  created_at timestamptz default now(),
  society_id text not null default 'gmct' references cmms.societies(id),
  unique (society_id, username),
  unique (society_id, access_code)
);

-- Source: sql/2026-01-08_create_sunday_locks_table.sql
create table if not exists cmms.sunday_locks (
  date text,
  is_locked boolean not null default false,
  locked_by text,
  locked_at timestamptz,
  society_id text not null default 'gmct' references cmms.societies(id),
  primary key (society_id, date)
);

-- Source: sql/2026-01-11_create_entry_deletions_table.sql
CREATE TABLE IF NOT EXISTS cmms.entry_deletions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID NOT NULL,
    entry_type TEXT NOT NULL,
    member_id UUID,
    member_name TEXT,
    amount DECIMAL(10, 2),
    original_date DATE,
    deletion_reason TEXT NOT NULL,
    deleted_by TEXT NOT NULL,
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    
    original_entry_data JSONB,
    
    
    CONSTRAINT entry_deletions_reason_check CHECK (char_length(deletion_reason) >= 3),
  society_id text not null default 'gmct' references cmms.societies(id)
);

-- Source: sql/2026-07-02_create_organization_funds_tables.sql
create table if not exists cmms.organization_funds_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  society_id text not null default 'gmct' references cmms.societies(id),
  unique (society_id, name)
);

-- Source: sql/2026-08-15_create_parking_receipts_table.sql
create table if not exists cmms.parking_receipts (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  amount numeric(12,2) not null default 0,
  notes text,
  created_by text,
  updated_by text,
  last_updated timestamptz,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  society_id text not null default 'gmct' references cmms.societies(id)
);

-- Source: README.md
create table if not exists cmms.entries (
    id uuid primary key default gen_random_uuid(),
    date date not null,
    member_id uuid references cmms.members(id),
    member_name text,
    type text,
    fund text,
    method text,
    amount numeric,
    note text,
    class_number text,  
    created_by text,    
    updated_by text,    
    last_updated timestamp with time zone,
    deleted boolean default false, 
    created_at timestamp with time zone default timezone('utc'::text, now()),
    remaining numeric, 
    group_name text,
  society_id text not null default 'gmct' references cmms.societies(id)
);

-- Source: sql/2025-12-31_create_attendance_tables.sql
create table if not exists cmms.attendance (
  id uuid primary key default gen_random_uuid(),
  class_number text not null,
  attendance_date date not null,
  service_type text not null default 'sunday' check (service_type in ('sunday', 'bible-study')),
  class_leader_id uuid references cmms.class_leaders(id),
  class_leader_name text,
  total_members_present integer,
  total_members_absent integer,
  total_visitors integer,
  notes text,
  created_by text,
  updated_by text,
  last_updated timestamptz default now(),
  deleted boolean default false,
  created_at timestamptz default now(),
  unique(society_id, class_number, attendance_date, service_type),
  society_id text not null default 'gmct' references cmms.societies(id)
);

-- Source: sql/2025-12-21_create_harvest_pledges_table.sql
create table if not exists cmms.harvest_pledges (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references cmms.members(id),
  member_name text not null,
  class_number text not null,
  date date not null,
  amount numeric not null,
  remaining numeric not null,
  category text not null,
  note text,
  created_by text,
  updated_by text,
  last_updated timestamptz,
  deleted boolean default false,
  created_at timestamptz default now(),
  society_id text not null default 'gmct' references cmms.societies(id)
);

-- Source: README.md
create table if not exists cmms.asset_maintenance (
    id uuid primary key default gen_random_uuid(),
    asset_id uuid references cmms.assets(id),
    maintenance_date date not null,
    description text not null,
    cost numeric,
    service_provider text,
    next_service_date date,
    notes text,
    created_by text,
    created_at timestamptz default timezone('utc'::text, now()),
  society_id text not null default 'gmct' references cmms.societies(id)
);

-- Source: sql/2025-12-23_create_requisitions.sql
create table if not exists cmms.requisition_items (
  id uuid primary key,
  requisition_id uuid references cmms.requisitions(id) on delete cascade,
  description text not null,
  qty numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  account_code text,
  society_id text not null default 'gmct' references cmms.societies(id)
);

-- Source: sql/2025-12-23_create_requisitions.sql
create table if not exists cmms.requisition_approvals (
  id uuid primary key,
  requisition_id uuid references cmms.requisitions(id) on delete cascade,
  approver_username text not null,
  approver_role text,
  decision text not null, 
  note text,
  signature_name text,
  signature_at timestamptz,
  decided_at timestamptz default now(),
  society_id text not null default 'gmct' references cmms.societies(id)
);

-- Source: sql/2025-12-23_create_requisitions.sql
create table if not exists cmms.requisition_comments (
  id uuid primary key,
  requisition_id uuid references cmms.requisitions(id) on delete cascade,
  author_username text not null,
  body text not null,
  created_at timestamptz default now(),
  society_id text not null default 'gmct' references cmms.societies(id)
);

-- Source: sql/2026-07-02_create_organization_funds_tables.sql
create table if not exists cmms.organization_funds_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references cmms.organization_funds_organizations(id) on delete restrict,
  organization_name_snapshot text not null,
  tx_type text not null check (tx_type in ('deposit', 'withdrawal')),
  status text not null default 'pending' check (status in ('posted', 'pending', 'approved', 'rejected')),
  amount numeric(12,2) not null check (amount > 0),
  tx_date date not null default current_date,
  submitted_by text not null,
  entered_by text not null,
  note text,
  approved_by text,
  approver_signature_name text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  
  constraint org_funds_approval_fields_required check (
    status not in ('approved', 'rejected')
    or (
      approved_by is not null
      and approver_signature_name is not null
      and btrim(approver_signature_name) <> ''
      and approved_at is not null
    )
  ),

  
  constraint org_funds_no_self_approval check (
    status not in ('approved', 'rejected')
    or (
      lower(approved_by) <> lower(submitted_by)
      and lower(approved_by) <> lower(entered_by)
    )
  ),
  society_id text not null default 'gmct' references cmms.societies(id)
);

-- Source: sql/2026-08-31_add_tenant_gateway_staging.sql
create table if not exists cmms.tenant_credentials (
    id uuid primary key default gen_random_uuid(),
    username text not null,
    society_id text not null references cmms.societies(id),
    role text not null check (role in ('software-admin', 'admin', 'finance-chair', 'finance-team', 'data-entry', 'pastor', 'statistician', 'class-leader')),
    password_salt text not null,
    password_hash text not null,
    enabled boolean not null default true,
    must_change_password boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (username, society_id)
);

-- Source: sql/2026-09-01_create_tenant_receipt_profiles.sql
create table if not exists cmms.tenant_receipt_profiles (
    society_id text primary key references cmms.societies(id) on delete cascade,
    charity_number text not null,
    logo_image text,
    minister_name text not null,
    minister_signature text,
    treasurer_name text not null,
    treasurer_signature text,
    updated_at timestamptz not null default now()
);

-- Source: sql/2025-12-22_create_harvest_pledge_payments_table.sql
create table if not exists cmms.harvest_pledge_payments (
  id uuid primary key default gen_random_uuid(),
  pledge_id uuid references cmms.harvest_pledges(id) on delete cascade,
  payment_date date not null,
  amount numeric not null,
  entry_id uuid, 
  paid_by text, 
  notes text,
  created_at timestamptz default now(),
  society_id text not null default 'gmct' references cmms.societies(id)
);

-- Source: sql/2025-12-31_create_attendance_tables.sql
create table if not exists cmms.member_attendance (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references cmms.attendance(id) on delete cascade,
  member_id uuid not null references cmms.members(id) on delete cascade,
  member_name text not null,
  class_number text not null,
  status text not null check (status in ('present', 'absent', 'sick', 'travel', 'catechumen')),
  notes text,
  created_by text,
  updated_by text,
  last_updated timestamptz default now(),
  created_at timestamptz default now(),
  society_id text not null default 'gmct' references cmms.societies(id)
);

-- Source: sql/2025-12-31_create_attendance_tables.sql
create table if not exists cmms.visitor_attendance (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references cmms.attendance(id) on delete cascade,
  visitor_name text not null,
  visitor_from text,
  visitor_position text,
  class_number text not null,
  recorded_by text,
  created_at timestamptz default now(),
  society_id text not null default 'gmct' references cmms.societies(id)
);

-- Source: sql/2026-08-31_add_tenant_gateway_staging.sql
create table if not exists cmms.tenant_sessions (
    id uuid primary key default gen_random_uuid(),
    credential_id uuid not null references cmms.tenant_credentials(id) on delete cascade,
    token_hash text not null unique,
    expires_at timestamptz not null,
    revoked_at timestamptz,
    created_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now()
);

-- Source: sql/2026-08-31_add_tenant_gateway_staging.sql
create table if not exists cmms.tenant_audit_log (
    id uuid primary key default gen_random_uuid(),
    society_id text references cmms.societies(id),
    credential_id uuid references cmms.tenant_credentials(id) on delete set null,
    action text not null,
    details jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

-- Additional fields required by the current feature branch.

ALTER TABLE cmms.members ADD COLUMN IF NOT EXISTS class_number text;

ALTER TABLE cmms.members ADD COLUMN IF NOT EXISTS member_number text;

ALTER TABLE cmms.members ADD COLUMN IF NOT EXISTS address text;

ALTER TABLE cmms.members ADD COLUMN IF NOT EXISTS city text;

ALTER TABLE cmms.members ADD COLUMN IF NOT EXISTS province text;

ALTER TABLE cmms.members ADD COLUMN IF NOT EXISTS phone text;

ALTER TABLE cmms.members ADD COLUMN IF NOT EXISTS email text;

ALTER TABLE cmms.members ADD COLUMN IF NOT EXISTS profession text;

ALTER TABLE cmms.members ADD COLUMN IF NOT EXISTS dob_month int;

ALTER TABLE cmms.members ADD COLUMN IF NOT EXISTS dob_day int;

ALTER TABLE cmms.members ADD COLUMN IF NOT EXISTS created_at timestamp with time zone default timezone('utc'::text, now());

ALTER TABLE cmms.members ADD COLUMN IF NOT EXISTS dev_fund_pledge boolean default false;

ALTER TABLE cmms.members ADD COLUMN IF NOT EXISTS dev_fund_pledge_amount numeric default 0;

ALTER TABLE cmms.members ADD COLUMN IF NOT EXISTS created_at timestamp with time zone default timezone('utc'::text, now());

ALTER TABLE cmms.entries ADD COLUMN IF NOT EXISTS remaining numeric;

ALTER TABLE cmms.entries ADD COLUMN IF NOT EXISTS group_name text;

ALTER TABLE cmms.members
ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

ALTER TABLE cmms.members
ADD COLUMN IF NOT EXISTS address text;

ALTER TABLE cmms.members
ADD COLUMN IF NOT EXISTS date_of_birth date;

ALTER TABLE cmms.members
ADD COLUMN IF NOT EXISTS dob_month integer;

ALTER TABLE cmms.members
ADD COLUMN IF NOT EXISTS dob_day integer;

ALTER TABLE cmms.members
ADD COLUMN IF NOT EXISTS email text;

ALTER TABLE cmms.members
ADD COLUMN IF NOT EXISTS profession text;

ALTER TABLE cmms.members
ADD COLUMN IF NOT EXISTS day_born text;

ALTER TABLE cmms.members
ADD COLUMN IF NOT EXISTS dev_fund_pledge boolean DEFAULT false;

ALTER TABLE cmms.members
ADD COLUMN IF NOT EXISTS dev_fund_pledge_amount numeric(10,2);

ALTER TABLE cmms.members
ADD COLUMN IF NOT EXISTS day_born text;

ALTER TABLE cmms.member_levies ADD COLUMN IF NOT EXISTS group_name TEXT;

ALTER TABLE cmms.entries 
ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;

ALTER TABLE cmms.entries 
ADD COLUMN IF NOT EXISTS deleted_by TEXT;

ALTER TABLE cmms.entries 
ADD COLUMN IF NOT EXISTS deleted_reason TEXT;

ALTER TABLE cmms.entries 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE cmms.app_settings
ADD COLUMN IF NOT EXISTS entry_window_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS entry_window_days TEXT, 
ADD COLUMN IF NOT EXISTS entry_window_start_time TEXT DEFAULT '06:00',
ADD COLUMN IF NOT EXISTS entry_window_end_time TEXT DEFAULT '18:00';

alter table cmms.attendance 
add column if not exists service_type text not null default 'sunday' 
check (service_type in ('sunday', 'bible-study'));

ALTER TABLE cmms.app_settings
ADD COLUMN IF NOT EXISTS requisition_approval_limits TEXT;

ALTER TABLE cmms.app_settings
ADD COLUMN IF NOT EXISTS requisition_pastor_limits TEXT;

ALTER TABLE cmms.app_settings
ADD COLUMN IF NOT EXISTS requisition_finance_approvers TEXT;

ALTER TABLE cmms.requisitions
ADD COLUMN IF NOT EXISTS requisition_number TEXT,
ADD COLUMN IF NOT EXISTS date_created DATE;

ALTER TABLE cmms.requisitions
ADD COLUMN IF NOT EXISTS requester_name TEXT,
ADD COLUMN IF NOT EXISTS intended_for TEXT,
ADD COLUMN IF NOT EXISTS purchase_type TEXT,
ADD COLUMN IF NOT EXISTS required_approver_role TEXT,
ADD COLUMN IF NOT EXISTS required_approver_username TEXT,
ADD COLUMN IF NOT EXISTS completion_attachment_url TEXT,
ADD COLUMN IF NOT EXISTS completion_attachment_at TIMESTAMPTZ;

ALTER TABLE cmms.requisition_approvals
ADD COLUMN IF NOT EXISTS approver_role TEXT,
ADD COLUMN IF NOT EXISTS signature_name TEXT,
ADD COLUMN IF NOT EXISTS signature_at TIMESTAMPTZ;

alter table cmms.app_settings add column if not exists parking_monthly_target numeric(12,2) default 2500;

alter table cmms.members add column if not exists society_id text references cmms.societies(id) default 'gmct';

alter table cmms.entries add column if not exists society_id text references cmms.societies(id) default 'gmct';

alter table cmms.harvest_pledges add column if not exists society_id text references cmms.societies(id) default 'gmct';

alter table cmms.requisitions add column if not exists society_id text references cmms.societies(id) default 'gmct';

alter table cmms.weekly_history add column if not exists society_id text references cmms.societies(id) default 'gmct';

alter table cmms.app_users add column if not exists society_id text references cmms.societies(id) default 'gmct';

alter table cmms.societies
    add column if not exists status text not null default 'active'
        check (status in ('active', 'archived')),
    add column if not exists archived_at timestamptz,
    add column if not exists updated_at timestamptz not null default now();

alter table cmms.tenant_receipt_profiles
    add column if not exists logo_image text;

ALTER TABLE cmms.app_settings ADD COLUMN IF NOT EXISTS supabase_key text;

ALTER TABLE cmms.app_settings ADD COLUMN IF NOT EXISTS etransfer_inbound_secret text;

ALTER TABLE cmms.app_settings ADD COLUMN IF NOT EXISTS wesley_hall_monthly_target numeric(12,2) default 2500;

ALTER TABLE cmms.app_settings ADD COLUMN IF NOT EXISTS parking_monthly_target numeric(12,2) default 2500;

ALTER TABLE cmms.requisitions ADD COLUMN IF NOT EXISTS payable_to text;

ALTER TABLE cmms.requisitions ADD COLUMN IF NOT EXISTS organization_committee text;

ALTER TABLE cmms.requisitions ADD COLUMN IF NOT EXISTS receipt_attachment jsonb;

ALTER TABLE cmms.harvest_pledge_payments ADD COLUMN IF NOT EXISTS payment_entry_id uuid references cmms.entries(id);

ALTER TABLE cmms.members ADD CONSTRAINT members_id_society_unique UNIQUE (id, society_id);

ALTER TABLE cmms.entries ADD CONSTRAINT entries_id_society_unique UNIQUE (id, society_id);

ALTER TABLE cmms.class_leaders ADD CONSTRAINT class_leaders_id_society_unique UNIQUE (id, society_id);

ALTER TABLE cmms.attendance ADD CONSTRAINT attendance_id_society_unique UNIQUE (id, society_id);

ALTER TABLE cmms.requisitions ADD CONSTRAINT requisitions_id_society_unique UNIQUE (id, society_id);

ALTER TABLE cmms.assets ADD CONSTRAINT assets_id_society_unique UNIQUE (id, society_id);

ALTER TABLE cmms.harvest_pledges ADD CONSTRAINT harvest_pledges_id_society_unique UNIQUE (id, society_id);

ALTER TABLE cmms.organization_funds_organizations ADD CONSTRAINT organization_funds_organizations_id_society_unique UNIQUE (id, society_id);

ALTER TABLE cmms.entries ADD CONSTRAINT entries_member_id_society_fk FOREIGN KEY (member_id, society_id) REFERENCES cmms.members(id, society_id);

CREATE INDEX entries_member_id_society_idx ON cmms.entries (member_id, society_id);

ALTER TABLE cmms.harvest_pledges ADD CONSTRAINT harvest_pledges_member_id_society_fk FOREIGN KEY (member_id, society_id) REFERENCES cmms.members(id, society_id);

CREATE INDEX harvest_pledges_member_id_society_idx ON cmms.harvest_pledges (member_id, society_id);

ALTER TABLE cmms.harvest_pledge_payments ADD CONSTRAINT harvest_pledge_payments_pledge_id_society_fk FOREIGN KEY (pledge_id, society_id) REFERENCES cmms.harvest_pledges(id, society_id);

CREATE INDEX harvest_pledge_payments_pledge_id_society_idx ON cmms.harvest_pledge_payments (pledge_id, society_id);

ALTER TABLE cmms.harvest_pledge_payments ADD CONSTRAINT harvest_pledge_payments_payment_entry_id_society_fk FOREIGN KEY (payment_entry_id, society_id) REFERENCES cmms.entries(id, society_id);

CREATE INDEX harvest_pledge_payments_payment_entry_id_society_idx ON cmms.harvest_pledge_payments (payment_entry_id, society_id);

ALTER TABLE cmms.member_levies ADD CONSTRAINT member_levies_member_id_society_fk FOREIGN KEY (member_id, society_id) REFERENCES cmms.members(id, society_id);

CREATE INDEX member_levies_member_id_society_idx ON cmms.member_levies (member_id, society_id);

ALTER TABLE cmms.attendance ADD CONSTRAINT attendance_class_leader_id_society_fk FOREIGN KEY (class_leader_id, society_id) REFERENCES cmms.class_leaders(id, society_id);

CREATE INDEX attendance_class_leader_id_society_idx ON cmms.attendance (class_leader_id, society_id);

ALTER TABLE cmms.member_attendance ADD CONSTRAINT member_attendance_attendance_id_society_fk FOREIGN KEY (attendance_id, society_id) REFERENCES cmms.attendance(id, society_id);

CREATE INDEX member_attendance_attendance_id_society_idx ON cmms.member_attendance (attendance_id, society_id);

ALTER TABLE cmms.member_attendance ADD CONSTRAINT member_attendance_member_id_society_fk FOREIGN KEY (member_id, society_id) REFERENCES cmms.members(id, society_id);

CREATE INDEX member_attendance_member_id_society_idx ON cmms.member_attendance (member_id, society_id);

ALTER TABLE cmms.visitor_attendance ADD CONSTRAINT visitor_attendance_attendance_id_society_fk FOREIGN KEY (attendance_id, society_id) REFERENCES cmms.attendance(id, society_id);

CREATE INDEX visitor_attendance_attendance_id_society_idx ON cmms.visitor_attendance (attendance_id, society_id);

ALTER TABLE cmms.requisition_items ADD CONSTRAINT requisition_items_requisition_id_society_fk FOREIGN KEY (requisition_id, society_id) REFERENCES cmms.requisitions(id, society_id);

CREATE INDEX requisition_items_requisition_id_society_idx ON cmms.requisition_items (requisition_id, society_id);

ALTER TABLE cmms.requisition_approvals ADD CONSTRAINT requisition_approvals_requisition_id_society_fk FOREIGN KEY (requisition_id, society_id) REFERENCES cmms.requisitions(id, society_id);

CREATE INDEX requisition_approvals_requisition_id_society_idx ON cmms.requisition_approvals (requisition_id, society_id);

ALTER TABLE cmms.requisition_comments ADD CONSTRAINT requisition_comments_requisition_id_society_fk FOREIGN KEY (requisition_id, society_id) REFERENCES cmms.requisitions(id, society_id);

CREATE INDEX requisition_comments_requisition_id_society_idx ON cmms.requisition_comments (requisition_id, society_id);

ALTER TABLE cmms.asset_maintenance ADD CONSTRAINT asset_maintenance_asset_id_society_fk FOREIGN KEY (asset_id, society_id) REFERENCES cmms.assets(id, society_id);

CREATE INDEX asset_maintenance_asset_id_society_idx ON cmms.asset_maintenance (asset_id, society_id);

ALTER TABLE cmms.organization_funds_transactions ADD CONSTRAINT organization_funds_transactions_organization_id_society_fk FOREIGN KEY (organization_id, society_id) REFERENCES cmms.organization_funds_organizations(id, society_id);

CREATE INDEX organization_funds_transactions_organization_id_society_idx ON cmms.organization_funds_transactions (organization_id, society_id);

CREATE INDEX members_society_idx ON cmms.members (society_id);

CREATE INDEX weekly_history_society_idx ON cmms.weekly_history (society_id);

CREATE INDEX app_users_society_idx ON cmms.app_users (society_id);

CREATE INDEX month_locks_society_idx ON cmms.month_locks (society_id);

CREATE INDEX app_settings_society_idx ON cmms.app_settings (society_id);

CREATE INDEX no_name_entries_society_idx ON cmms.no_name_entries (society_id);

CREATE INDEX member_levies_society_idx ON cmms.member_levies (society_id);

CREATE INDEX wesley_hall_receipts_society_idx ON cmms.wesley_hall_receipts (society_id);

CREATE INDEX assets_society_idx ON cmms.assets (society_id);

CREATE INDEX etransfers_society_idx ON cmms.etransfers (society_id);

CREATE INDEX requisitions_society_idx ON cmms.requisitions (society_id);

CREATE INDEX utilities_society_idx ON cmms.utilities (society_id);

CREATE INDEX class_leaders_society_idx ON cmms.class_leaders (society_id);

CREATE INDEX sunday_locks_society_idx ON cmms.sunday_locks (society_id);

CREATE INDEX entry_deletions_society_idx ON cmms.entry_deletions (society_id);

CREATE INDEX organization_funds_organizations_society_idx ON cmms.organization_funds_organizations (society_id);

CREATE INDEX parking_receipts_society_idx ON cmms.parking_receipts (society_id);

CREATE INDEX entries_society_idx ON cmms.entries (society_id);

CREATE INDEX attendance_society_idx ON cmms.attendance (society_id);

CREATE INDEX harvest_pledges_society_idx ON cmms.harvest_pledges (society_id);

CREATE INDEX asset_maintenance_society_idx ON cmms.asset_maintenance (society_id);

CREATE INDEX requisition_items_society_idx ON cmms.requisition_items (society_id);

CREATE INDEX requisition_approvals_society_idx ON cmms.requisition_approvals (society_id);

CREATE INDEX requisition_comments_society_idx ON cmms.requisition_comments (society_id);

CREATE INDEX organization_funds_transactions_society_idx ON cmms.organization_funds_transactions (society_id);

CREATE INDEX tenant_credentials_society_idx ON cmms.tenant_credentials (society_id);

CREATE INDEX tenant_receipt_profiles_society_idx ON cmms.tenant_receipt_profiles (society_id);

CREATE INDEX harvest_pledge_payments_society_idx ON cmms.harvest_pledge_payments (society_id);

CREATE INDEX member_attendance_society_idx ON cmms.member_attendance (society_id);

CREATE INDEX visitor_attendance_society_idx ON cmms.visitor_attendance (society_id);

CREATE INDEX tenant_audit_log_society_idx ON cmms.tenant_audit_log (society_id);

CREATE INDEX tenant_sessions_credential_id_idx ON cmms.tenant_sessions (credential_id);

CREATE INDEX tenant_audit_log_credential_id_idx ON cmms.tenant_audit_log (credential_id);

CREATE INDEX tenant_sessions_token_hash_active_idx ON cmms.tenant_sessions (token_hash, expires_at) WHERE revoked_at IS NULL;

CREATE INDEX entries_society_date_idx ON cmms.entries (society_id, date DESC);

CREATE INDEX weekly_history_society_date_idx ON cmms.weekly_history (society_id, date_of_service DESC);

insert into cmms.societies (id, code, name, short_name, city, province, province_code, is_primary, address, features, accent_color)
values
    (
        'gmct',
        'GMCT',
        'Ghana Methodist Church Toronto',
        'GMCT',
        'Toronto',
        'Ontario',
        'ON',
        true,
        '69 Milvan Drive, North York, ON M9L 1Y8',
        '{"wesleyHall": true, "parking": true, "etransfers": true, "requisitions": true, "harvest": true, "harvestPledges": true, "developmentFund": true, "taxReceipts": true, "assets": true, "organizationFunds": true, "dayBorn": true, "childrensMinistry": true}'::jsonb,
        'indigo'
    ),
    (
        'ebenezer-hamilton',
        'EBEN-HAM',
        'Ebenezer Methodist Society',
        'Ebenezer',
        'Hamilton',
        'Ontario',
        'ON',
        false,
        'Hamilton, ON',
        '{"wesleyHall": false, "parking": false, "etransfers": true, "requisitions": true, "harvest": true, "harvestPledges": true, "developmentFund": true, "taxReceipts": true, "assets": true, "organizationFunds": true, "dayBorn": true, "childrensMinistry": true}'::jsonb,
        'blue'
    ),
    (
        'redemption-etobicoke',
        'RED-ETOB',
        'Redemption Methodist Society',
        'Redemption',
        'Etobicoke',
        'Ontario',
        'ON',
        false,
        'Etobicoke, ON',
        '{"wesleyHall": false, "parking": false, "etransfers": true, "requisitions": true, "harvest": true, "harvestPledges": true, "developmentFund": true, "taxReceipts": true, "assets": true, "organizationFunds": true, "dayBorn": true, "childrensMinistry": true}'::jsonb,
        'amber'
    ),
    (
        'bethany-brampton',
        'BETH-BRAM',
        'Bethany Methodist Society',
        'Bethany',
        'Brampton',
        'Ontario',
        'ON',
        false,
        'Brampton, ON',
        '{"wesleyHall": false, "parking": false, "etransfers": true, "requisitions": true, "harvest": true, "harvestPledges": true, "developmentFund": true, "taxReceipts": true, "assets": true, "organizationFunds": true, "dayBorn": true, "childrensMinistry": true}'::jsonb,
        'purple'
    ),
    (
        'mt-zion-london',
        'MTZ-LON',
        'Mt. Zion Methodist Society',
        'Mt. Zion',
        'London',
        'Ontario',
        'ON',
        false,
        'London, ON',
        '{"wesleyHall": false, "parking": false, "etransfers": true, "requisitions": true, "harvest": true, "harvestPledges": true, "developmentFund": true, "taxReceipts": true, "assets": true, "organizationFunds": true, "dayBorn": true, "childrensMinistry": true}'::jsonb,
        'teal'
    ),
    (
        'wesley-thunderbay',
        'WES-TBAY',
        'Wesley Methodist Society',
        'Wesley (Thunder Bay)',
        'Thunder Bay',
        'Ontario',
        'ON',
        false,
        'Thunder Bay, ON',
        '{"wesleyHall": false, "parking": false, "etransfers": true, "requisitions": true, "harvest": true, "harvestPledges": true, "developmentFund": true, "taxReceipts": true, "assets": true, "organizationFunds": true, "dayBorn": true, "childrensMinistry": true}'::jsonb,
        'sky'
    ),
    (
        'bethel-calgary',
        'BETH-CAL',
        'Bethel Methodist Society',
        'Bethel (Calgary)',
        'Calgary',
        'Alberta',
        'AB',
        false,
        'Calgary, AB',
        '{"wesleyHall": false, "parking": false, "etransfers": true, "requisitions": true, "harvest": true, "harvestPledges": true, "developmentFund": true, "taxReceipts": true, "assets": true, "organizationFunds": true, "dayBorn": true, "childrensMinistry": true}'::jsonb,
        'rose'
    ),
    (
        'wesley-edmonton',
        'WES-EDM',
        'Wesley Methodist Society',
        'Wesley (Edmonton)',
        'Edmonton',
        'Alberta',
        'AB',
        false,
        'Edmonton, AB',
        '{"wesleyHall": false, "parking": false, "etransfers": true, "requisitions": true, "harvest": true, "harvestPledges": true, "developmentFund": true, "taxReceipts": true, "assets": true, "organizationFunds": true, "dayBorn": true, "childrensMinistry": true}'::jsonb,
        'emerald'
    ),
    (
        'peniel-vancouver',
        'PEN-VAN',
        'Peniel Methodist Society',
        'Peniel',
        'Vancouver',
        'British Columbia',
        'BC',
        false,
        'Vancouver, BC',
        '{"wesleyHall": false, "parking": false, "etransfers": true, "requisitions": true, "harvest": true, "harvestPledges": true, "developmentFund": true, "taxReceipts": true, "assets": true, "organizationFunds": true, "dayBorn": true, "childrensMinistry": true}'::jsonb,
        'cyan'
    ),
    (
        'zion-vancouver',
        'ZION-VAN',
        'Zion Methodist Society',
        'Zion',
        'Vancouver',
        'British Columbia',
        'BC',
        false,
        'Vancouver, BC',
        '{"wesleyHall": false, "parking": false, "etransfers": true, "requisitions": true, "harvest": true, "harvestPledges": true, "developmentFund": true, "taxReceipts": true, "assets": true, "organizationFunds": true, "dayBorn": true, "childrensMinistry": true}'::jsonb,
        'violet'
    ),
    (
        'bethel-winnipeg',
        'BETH-WPG',
        'Bethel Methodist Society',
        'Bethel (Winnipeg)',
        'Winnipeg',
        'Manitoba',
        'MB',
        false,
        'Winnipeg, MB',
        '{"wesleyHall": false, "parking": false, "etransfers": true, "requisitions": true, "harvest": true, "harvestPledges": true, "developmentFund": false, "taxReceipts": true, "assets": true, "organizationFunds": true, "dayBorn": true, "childrensMinistry": true}'::jsonb,
        'fuchsia'
    ),
    (
        'new-life-ottawa',
        'NLIC-OTT',
        'New Life International Methodist Church',
        'New Life (Ottawa)',
        'Ottawa',
        'Ontario',
        'ON',
        false,
        'Ottawa, ON',
        '{"wesleyHall": false, "parking": false, "etransfers": true, "requisitions": true, "harvest": true, "harvestPledges": true, "developmentFund": false, "taxReceipts": true, "assets": true, "organizationFunds": true, "dayBorn": true, "childrensMinistry": true}'::jsonb,
        'indigo'
    ),
    (
        'holy-trinity-montreal',
        'HTM-MTL',
        'Holy Trinity Methodist Society',
        'Holy Trinity (Montreal)',
        'Montreal',
        'Quebec',
        'QC',
        false,
        'Montreal, QC',
        '{"wesleyHall": false, "parking": false, "etransfers": true, "requisitions": true, "harvest": true, "harvestPledges": true, "developmentFund": false, "taxReceipts": true, "assets": true, "organizationFunds": true, "dayBorn": true, "childrensMinistry": true}'::jsonb,
        'blue'
    ),
    (
        'halifax-ns',
        'HAL-NS',
        'Halifax Methodist Society',
        'Halifax',
        'Halifax',
        'Nova Scotia',
        'NS',
        false,
        'Halifax, NS',
        '{"wesleyHall": false, "parking": false, "etransfers": true, "requisitions": true, "harvest": true, "harvestPledges": true, "developmentFund": false, "taxReceipts": true, "assets": true, "organizationFunds": true, "dayBorn": true, "childrensMinistry": true}'::jsonb,
        'orange'
    ),
    (
        'stjohns-newfoundland',
        'STJ-NL',
        'St. John''s Methodist Society',
        'St. John''s',
        'St. John''s',
        'Newfoundland and Labrador',
        'NL',
        false,
        'St. John''s, NL',
        '{"wesleyHall": false, "parking": false, "etransfers": true, "requisitions": true, "harvest": true, "harvestPledges": true, "developmentFund": false, "taxReceipts": true, "assets": true, "organizationFunds": true, "dayBorn": true, "childrensMinistry": true}'::jsonb,
        'rose'
    )
on conflict (id) do update set
    name = excluded.name,
    code = excluded.code,
    short_name = excluded.short_name,
    city = excluded.city,
    province = excluded.province,
    province_code = excluded.province_code,
    is_primary = excluded.is_primary,
    features = excluded.features;

INSERT INTO cmms.app_settings (society_id, id, currency, max_classes, enforce_directory, org_name) SELECT id, 'app_settings', 'CAD', CASE WHEN is_primary THEN 14 ELSE 5 END, true, name FROM cmms.societies;

CREATE VIEW cmms.v_organization_funds_balances WITH (security_invoker = true) AS
SELECT o.society_id, o.id AS organization_id, o.name AS organization_name,
 coalesce(sum(CASE WHEN t.tx_type='deposit' AND t.status='posted' THEN t.amount WHEN t.tx_type='withdrawal' AND t.status='approved' THEN -t.amount ELSE 0 END),0)::numeric(12,2) AS available_balance,
 coalesce(sum(CASE WHEN t.tx_type='withdrawal' AND t.status='pending' THEN t.amount ELSE 0 END),0)::numeric(12,2) AS pending_withdrawals,
 coalesce(sum(CASE WHEN t.tx_type='deposit' AND t.status='posted' THEN t.amount ELSE 0 END),0)::numeric(12,2) AS total_deposited,
 coalesce(sum(CASE WHEN t.tx_type='withdrawal' AND t.status='approved' THEN t.amount ELSE 0 END),0)::numeric(12,2) AS total_withdrawn
FROM cmms.organization_funds_organizations o
LEFT JOIN cmms.organization_funds_transactions t ON t.organization_id=o.id AND t.society_id=o.society_id
GROUP BY o.society_id,o.id,o.name;

-- Keep all data private until the application authentication integration is configured.

ALTER TABLE cmms.societies ENABLE ROW LEVEL SECURITY;

ALTER TABLE cmms.members ENABLE ROW LEVEL SECURITY;

ALTER TABLE cmms.weekly_history ENABLE ROW LEVEL SECURITY;

ALTER TABLE cmms.app_users ENABLE ROW LEVEL SECURITY;

ALTER TABLE cmms.month_locks ENABLE ROW LEVEL SECURITY;

ALTER TABLE cmms.app_settings ENABLE ROW LEVEL SECURITY;

ALTER TABLE cmms.no_name_entries ENABLE ROW LEVEL SECURITY;

ALTER TABLE cmms.member_levies ENABLE ROW LEVEL SECURITY;

ALTER TABLE cmms.wesley_hall_receipts ENABLE ROW LEVEL SECURITY;

ALTER TABLE cmms.assets ENABLE ROW LEVEL SECURITY;

ALTER TABLE cmms.etransfers ENABLE ROW LEVEL SECURITY;

ALTER TABLE cmms.requisitions ENABLE ROW LEVEL SECURITY;

ALTER TABLE cmms.utilities ENABLE ROW LEVEL SECURITY;

ALTER TABLE cmms.class_leaders ENABLE ROW LEVEL SECURITY;

ALTER TABLE cmms.sunday_locks ENABLE ROW LEVEL SECURITY;

ALTER TABLE cmms.entry_deletions ENABLE ROW LEVEL SECURITY;

ALTER TABLE cmms.organization_funds_organizations ENABLE ROW LEVEL SECURITY;

ALTER TABLE cmms.parking_receipts ENABLE ROW LEVEL SECURITY;

ALTER TABLE cmms.entries ENABLE ROW LEVEL SECURITY;

ALTER TABLE cmms.attendance ENABLE ROW LEVEL SECURITY;

ALTER TABLE cmms.harvest_pledges ENABLE ROW LEVEL SECURITY;

ALTER TABLE cmms.asset_maintenance ENABLE ROW LEVEL SECURITY;

ALTER TABLE cmms.requisition_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE cmms.requisition_approvals ENABLE ROW LEVEL SECURITY;

ALTER TABLE cmms.requisition_comments ENABLE ROW LEVEL SECURITY;

ALTER TABLE cmms.organization_funds_transactions ENABLE ROW LEVEL SECURITY;

ALTER TABLE cmms.tenant_credentials ENABLE ROW LEVEL SECURITY;

ALTER TABLE cmms.tenant_receipt_profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE cmms.harvest_pledge_payments ENABLE ROW LEVEL SECURITY;

ALTER TABLE cmms.member_attendance ENABLE ROW LEVEL SECURITY;

ALTER TABLE cmms.visitor_attendance ENABLE ROW LEVEL SECURITY;

ALTER TABLE cmms.tenant_sessions ENABLE ROW LEVEL SECURITY;

ALTER TABLE cmms.tenant_audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA cmms FROM PUBLIC, anon, authenticated;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA cmms FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA cmms TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA cmms TO service_role;

COMMENT ON SCHEMA cmms IS 'Canada Mission Management System. Isolated from public planner/hymn/letter tables. Browser access is disabled pending authentication integration.';
