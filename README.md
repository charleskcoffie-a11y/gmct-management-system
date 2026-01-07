
# GMCT Management System - Setup & Deployment Guide

This guide provides step-by-step instructions to configure and deploy the GMCT Management System using **Supabase** as the backend database.

---

## Part 1: Supabase Database Setup

You need to create a free Supabase project to store your data in the cloud.

### Step 1.1: Create a Project

1.  Go to [Supabase.com](https://supabase.com) and sign in.
2.  Click **"New Project"**.
3.  Choose your organization and enter a **Name** (e.g., `GMCT System`).
4.  Set a strong **Database Password** (save this, though the app uses API keys).
5.  Choose a region close to you.
6.  Click **"Create new project"**.

### Step 1.2: Get Your API Credentials

Once the project is created (it takes a minute):

1.  Go to **Project Settings** (gear icon at the bottom left).
2.  Click **"API"**.
3.  Find the **Project URL** and copy it.
4.  Find the **anon / public** key and copy it.
5.  **Save these!** You will enter them into the application's "Settings" tab.

### Step 1.3: Create Database Tables (SQL)

To set up the database structure, run the following SQL script in Supabase:

1.  In your Supabase dashboard, click on **"SQL Editor"** (icon on the left).
2.  Click **"+ New query"**.
3.  Paste the code below into the editor and click **"Run"**.

```sql
-- 1. Enable UUID extension
create extension if not exists "uuid-ossp";

-- 2. Create Members Table
-- 2. Create Members Table (or add columns if upgrading)
create table if not exists public.members (
    id uuid primary key default uuid_generate_v4(),
    name text not null
);
-- Add columns if not exist (for upgrades/migrations)
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS class_number text;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS member_number text;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS province text;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS profession text;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS dob_month int;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS dob_day int;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS created_at timestamp with time zone default timezone('utc'::text, now());
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS dev_fund_pledge boolean default false;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS dev_fund_pledge_amount numeric default 0;

-- 3. Create Financial Entries Table
create table if not exists public.entries (
    id uuid primary key default uuid_generate_v4(),
    date date not null,
    member_id uuid references public.members(id),
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
    remaining numeric, -- For pledges: tracks unpaid balance
    group_name text -- For harvest pledges: Men, Women, Youth, Dayborn, Main
);

-- 4. Create Attendance Table
create table if not exists public.attendance (
    id uuid primary key default uuid_generate_v4(),
    date date not null,
    member_id uuid references public.members(id),
    status text,
    created_at timestamp with time zone default timezone('utc'::text, now()),
    unique(date, member_id)
);

-- 5. Create Weekly History Table
create table if not exists public.weekly_history (
    id uuid primary key default uuid_generate_v4(),
    date_of_service date,
    society_name text,
    data jsonb, 
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 6. Create Users Table (for app login management)
create table if not exists public.app_users (
    username text primary key,
    password text not null,
    role text not null,
    class_led text,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 7. Create Month Locks Table
create table if not exists public.month_locks (
    month text primary key, -- Format YYYY-MM
    is_locked boolean default false,
    locked_by text,
    locked_at timestamp with time zone
);

-- 8. Create App Settings Table (for centralized config including class access codes)
create table if not exists public.app_settings (
    id text primary key default 'app_settings', -- Single row for org-wide settings
    currency text,
    max_classes int,
    enforce_directory boolean,
    supabase_url text,
    supabase_key text,
    logo_url text,
    org_name text,
    org_address text,
    org_phone text,
    org_email text,
    charity_number text,
    signature_image text,
    annual_levy_amount numeric,
    etransfer_notification_email text,
    etransfer_inbound_secret text,
    etransfer_provider text,
    class_access_codes text, -- JSON string: {"1": "alpha", "2": "beta", ...}
    created_at timestamp with time zone default timezone('utc'::text, now()),
    updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 9. Create No Name Entries Table (for anonymous/flexible entries)
create table if not exists public.no_name_entries (
    id uuid primary key default uuid_generate_v4(),
    date date not null,
    amount numeric not null,
    notes text,
    created_by text,
    updated_at timestamp with time zone default timezone('utc'::text, now()),
    created_at timestamp with time zone default timezone('utc'::text, now()),
    data jsonb -- For flexible JSON storage if needed
);

-- 10. Configure Access Policies (Row Level Security)
alter table public.members enable row level security;
create policy "Enable all access for anon users" on public.members for all using (true) with check (true);

alter table public.entries enable row level security;
create policy "Enable all access for anon users" on public.entries for all using (true) with check (true);

alter table public.attendance enable row level security;
create policy "Enable all access for anon users" on public.attendance for all using (true) with check (true);

alter table public.weekly_history enable row level security;
create policy "Enable all access for anon users" on public.weekly_history for all using (true) with check (true);

alter table public.app_users enable row level security;
create policy "Enable all access for anon users" on public.app_users for all using (true) with check (true);

alter table public.month_locks enable row level security;
create policy "Enable all access for anon users" on public.month_locks for all using (true) with check (true);

alter table public.app_settings enable row level security;
create policy "Enable all access for anon users" on public.app_settings for all using (true) with check (true);

alter table public.no_name_entries enable row level security;
create policy "Enable all access for anon users" on public.no_name_entries for all using (true) with check (true);
```

### Prevent Duplicate Development Fund Entries (Optional but Recommended)
To ensure only one Development Fund contribution per member per date, add a partial unique index on the `entries` table:

```sql
-- Prevent duplicates: same member, same date, Development Fund type
create unique index if not exists entries_unique_devfund_per_day
    on public.entries (date, member_id)
    where (type = 'development-fund');
```

This index blocks duplicates at the database level. The app also checks locally and will alert the user before saving.

### Prevent Duplicate Entries (All Types)
To enforce that a member can have only one entry per date per type, add this partial unique index:

```sql
-- Prevent duplicates across all types for active (non-deleted) rows
create unique index if not exists entries_unique_member_date_type_active
  on public.entries (member_id, date, type)
  where (deleted IS NOT TRUE);
```

Notes:
- This index ignores soft-deleted rows (`deleted = TRUE`).
- If you already have duplicates, clean them up before creating the index (keep one row per member/date/type).

### MIGRATION: If you already have tables
Run this to add the new lock table:
```sql
create table if not exists public.month_locks (
    month text primary key,
    is_locked boolean default false,
    locked_by text,
    locked_at timestamp with time zone
);
alter table public.month_locks enable row level security;
create policy "Enable all access for anon users" on public.month_locks for all using (true) with check (true);

-- Ensure members table has createdAt
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS created_at timestamp with time zone default timezone('utc'::text, now());
```

### MIGRATION: Harvest Pledges and Payment Tracking
Run this SQL **in separate queries** in Supabase SQL Editor to avoid dependency issues:

**Step 1: Add columns to entries table**
```sql
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS remaining numeric;
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS group_name text;
```

**Step 2: Create harvest pledges table**
```sql
create table if not exists public.harvest_pledges (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id) on delete cascade,
  member_name text not null,
  class_number text,
  group_name text,
  date date not null,
  amount numeric not null,
  remaining numeric not null,
  category text,
  note text,
  deleted boolean default false,
  created_by text,
  updated_by text,
  last_updated timestamptz,
  created_at timestamptz default now()
);
```

**IMPORTANT: Verify Step 2 worked before continuing**
Run this to check if the table was created:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'harvest_pledges';
```
You should see `harvest_pledges` in the results. If not, Step 2 failed - check for errors.

**Step 3: Create harvest pledge payments table**
```sql
create table if not exists public.harvest_pledge_payments (
  id uuid primary key default gen_random_uuid(),
  pledge_id uuid references public.harvest_pledges(id) on delete cascade,
  payment_entry_id uuid references public.entries(id) on delete cascade,
  payment_date date not null,
  amount numeric not null,
  paid_by text,
  notes text,
  created_at timestamptz default now()
);
```

**Step 4: Enable Row Level Security**
```sql
alter table public.harvest_pledges enable row level security;
create policy "Enable all access for anon users" on public.harvest_pledges 
  for all using (true) with check (true);

alter table public.harvest_pledge_payments enable row level security;
create policy "Enable all access for anon users" on public.harvest_pledge_payments 
  for all using (true) with check (true);
```

**Step 5: Create indexes for performance**
```sql
create index if not exists idx_harvest_pledges_date on public.harvest_pledges(date);
create index if not exists idx_harvest_pledges_member on public.harvest_pledges(member_id);
create index if not exists idx_pledge_payments_pledge_id on public.harvest_pledge_payments(pledge_id);
create index if not exists idx_pledge_payments_payment_id on public.harvest_pledge_payments(payment_entry_id);
create index if not exists idx_pledge_payments_date on public.harvest_pledge_payments(payment_date);
```

### Member Levies (Annual Harvest Levy)
Apply a fixed yearly levy to all active members on January 1st. Unpaid balances carry forward.

**Step 1: Create member levies table**
```sql
create table if not exists public.member_levies (
  id text primary key, -- "<member_id>-<year>" for easy upserts
  member_id uuid references public.members(id) on delete cascade,
  year int not null,
  base_amount numeric not null, -- levy set for this year
  carry_over numeric default 0,  -- unpaid from previous year
  remaining numeric not null,    -- base_amount + carry_over - payments
  class_number text,
  group_name text,
  created_at timestamptz default now(),
  unique(member_id, year)
);
```

**Step 2: Enable Row Level Security**
```sql
alter table public.member_levies enable row level security;
create policy "Enable all access for anon users" on public.member_levies 
  for all using (true) with check (true);
```

**Step 3: Indexes**
```sql
create index if not exists idx_member_levies_member_year on public.member_levies(member_id, year);
create index if not exists idx_member_levies_year on public.member_levies(year);
```

Notes:
- Use the Utilities tab → Annual Harvest Levy to set the amount and generate levies for the current year.
- Payments saved as `harvest-levy` entries automatically reduce the member's `remaining` for the corresponding year.
- Carryover: When generating a new year, previous year's `remaining` is added to `carry_over` and included in the new `remaining`.

### Automatic Weekly Backups (Entries → CSV → Email)
To automatically export the `entries` table every Sunday morning, set up a Supabase Edge Function + Schedule:

**Step A: Create Storage bucket (one time)**
```sql
-- In SQL Editor
select storage.create_bucket('backups', public := false);
```

**Step B: Deploy Edge Function**
- Ensure you have Supabase CLI installed and project linked.
- Function code is in `supabase/functions/weekly-export/index.ts`.

```bash
# Install CLI (if needed)
npm i -g supabase

# Link your project (replace with your ref)
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
supabase functions deploy weekly-export

# Set required secrets
supabase secrets set \
  SUPABASE_URL=YOUR_SUPABASE_URL \
  SUPABASE_SERVICE_KEY=YOUR_SERVICE_ROLE_KEY \
  BACKUP_BUCKET=backups \
  BACKUP_EMAIL=you@example.com \
  RESEND_API_KEY=YOUR_RESEND_KEY \
  FROM_EMAIL="GMCT Backups <no-reply@example.com>"
```

**Step C: Schedule the function (EST)**
Supabase schedules run in UTC. For 6:00 AM every Sunday in EST, use 11:00 UTC:
```bash
supabase functions schedule create weekly-export --cron "0 11 * * 0"
```

Daylight Saving Time note (EDT): 6:00 AM EDT corresponds to 10:00 UTC. If you need exactly 6:00 AM year‑round, update the schedule at DST changes:
```bash
# Switch to EDT (summer)
supabase functions schedule update weekly-export --cron "0 10 * * 0"

# Switch back to EST (winter)
supabase functions schedule update weekly-export --cron "0 11 * * 0"
```

Notes:
- The function uploads a dated CSV (e.g., `entries_YYYY-MM-DD.csv`) to the `backups` bucket and emails a 7-day signed URL.
- Use a dedicated email provider API key (e.g., Resend). Update recipients via `BACKUP_EMAIL` secret.
- For permanent retention, download the CSV or configure Storage lifecycle rules.

### Wesley Hall Rentals (Receipts)
Record amounts received from Wesley Hall rentals in a dedicated table.

**Step 1: Create table**
```sql
create table if not exists public.wesley_hall_receipts (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  amount numeric not null,
  notes text,
  created_by text,
  updated_by text,
  last_updated timestamptz,
  deleted boolean default false,
  created_at timestamptz default timezone('utc'::text, now())
);
```

**Step 2: Enable Row Level Security**
```sql
alter table public.wesley_hall_receipts enable row level security;
create policy "Enable all access for anon users" on public.wesley_hall_receipts
  for all using (true) with check (true);
```

**Step 3: Indexes**
```sql
create index if not exists idx_wesley_hall_date on public.wesley_hall_receipts(date);
create index if not exists idx_wesley_hall_deleted on public.wesley_hall_receipts(deleted);
```

Notes:
- Use the Wesley Hall tab to add receipts, view totals to date, and see monthly trend.
- Deleting a receipt removes it from the table; consider soft delete for audit by setting `deleted = true` if needed.

### Class Attendance Management
Class leaders can mark attendance for their assigned class, and administrators can generate attendance reports for follow-up.

**Step 1: Ensure attendance table exists** (already created in main schema)
```sql
-- Attendance table should already exist from main setup
-- If not, run this:
create table if not exists public.attendance (
    id uuid primary key default uuid_generate_v4(),
    date date not null,
    member_id uuid references public.members(id),
    status text, -- 'present', 'absent', 'sick', 'travel'
    created_at timestamp with time zone default timezone('utc'::text, now()),
    unique(date, member_id)
);
```

**Step 2: Enable Row Level Security**
```sql
alter table public.attendance enable row level security;

-- Allow all for anon/public (app-level filtering handles class restrictions)
create policy "Enable attendance access" on public.attendance
  for all using (true) with check (true);

-- Optional: Add indexes for performance
create index if not exists idx_attendance_date on public.attendance(date);
create index if not exists idx_attendance_member on public.attendance(member_id);
```

**Step 3: Application-level security**
- Class leaders see only their assigned class members (filtered by `assignedClass` field)
- Admins and pastors can view all class attendance
- Financial tabs are hidden from class-leader role

Notes:
- Class leaders access only their assigned class via Attendance tab
- Attendance data is completely separate from financial records
- Status options: present, absent, sick, travel

### Assets Management
Track church assets, equipment, and property with comprehensive management features.

**Step 1: Create assets tables**
```sql
create table if not exists public.assets (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    category text, -- building, technology, musical-instrument, furniture, vehicle, etc.
    description text,
    location text,
    purchase_date date,
    purchase_price numeric,
    current_value numeric,
    serial_number text,
    model text,
    condition text, -- excellent, good, fair, poor, needs-repair
    status text, -- active, storage, repair, disposed
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
    deleted boolean default false
);

create table if not exists public.asset_maintenance (
    id uuid primary key default uuid_generate_v4(),
    asset_id uuid references public.assets(id),
    maintenance_date date not null,
    description text not null,
    cost numeric,
    service_provider text,
    next_service_date date,
    notes text,
    created_by text,
    created_at timestamptz default timezone('utc'::text, now())
);
```

**Step 2: Enable RLS**
```sql
alter table public.assets enable row level security;
alter table public.asset_maintenance enable row level security;

create policy "Enable asset access" on public.assets
  for all using (true) with check (true);

create policy "Enable maintenance access" on public.asset_maintenance
  for all using (true) with check (true);
```

**Step 3: Indexes**
```sql
create index if not exists idx_assets_category on public.assets(category);
create index if not exists idx_assets_status on public.assets(status);
create index if not exists idx_asset_maintenance_asset on public.asset_maintenance(asset_id);
```

## Part 2: User Roles Definition

**Admin (Full Authority)**
Admin has full control over financial data and all system settings. Admin can approve corrections, lock/unlock periods, access audit logs, edit/delete any record, manage all user accounts, and export any report. The Admin has complete visibility and management authority.

Note: For safety, the application locks the default Admin account from edits, renaming, and deletion. Create additional admin-like users with the `finance-chair` role when you need elevated financial authority without system settings control.

**Finance Chair (Full Financial Authority)**
Oversees all financial operations. Approves corrections, manages period locking, views audit trails, and exports detailed reports. Cannot change system settings or user roles.

**Finance Team (Standard Financial Authority)**
Handles daily financial entry. Can add contributions, edit recent entries, view reports, and search member histories. Major or old corrections require Admin/Finance Chair approval.

**Data Entry Members (Limited Authority)**
Can only enter new contributions and edit their own recent entries (15 minutes). Cannot view other members’ giving, reports, or historical data.

**Pastor (Leadership Read-Only)**
Can view giving summaries, trends, class totals, and Development Fund progress. Cannot edit financial records or change system settings. Individual giving view is optional based on church policy.

**Statistician (Analytics & Reports)**
Can view comprehensive analytics, reports, and trends. Cannot edit financial records or access system settings.

**Class Leader (Attendance Management)**
Can view Member Directory (read-only) and mark attendance for their assigned class only. Cannot access any financial data, financial reports, or settings. Attendance is completely isolated from financial records.

---

## Part 2.5: Core Features

### Development Fund Tab
Tracks contributions to special development projects. Allows members to be selected and contributions to be recorded with optional descriptions. Features include:
- Quick add interface for rapid data entry
- Inline editing of existing entries
- Undo delete functionality with toast notification
- Date range filters (This week, This month, QTD, YTD, Last 12 months)
- Sortable columns (Date and Amount with persistence)
- CSV export of member contributions
- localStorage persistence of user preferences

**Access:** Admin, Finance-Chair, Finance-Team, Data-Entry, Pastor

### No Name Tab
Flexible entry system for unnamed or miscellaneous financial contributions. Used for donations without a specific member attached or for special campaigns. Features include:
- Amount and date entry with optional notes
- Scrollable history with sorting by date or amount
- Inline editing of entries with save/cancel controls
- Undo delete with notification
- CSV data export capability
- Persistent sort preferences
- JSON storage support in Supabase (via `data` column) for flexible metadata

**Access:** Admin, Finance-Chair, Finance-Team only

**Supabase Storage Notes:**
The `no_name_entries` table includes a `data` JSONB column for flexible storage of additional metadata (e.g., campaign name, source, category). This allows storing unstructured data without modifying the table schema.

Example JSON storage in the `data` column:
```json
{
  "campaign": "Building Fund Drive 2024",
  "source": "Online Donation",
  "category": "Major Gift",
  "reference": "Ref#12345"
}
```

---

## Part 3: Version Control (Git & GitHub)

Use Git to back up your code and track changes. You can use either the command line or GitHub Desktop.

### Option A: Using GitHub Desktop (Recommended / Easiest)

**1. Initial Setup**
1.  Download and install [GitHub Desktop](https://desktop.github.com/).
2.  Open GitHub Desktop and log in with your GitHub account.
3.  Go to **File** -> **Add Local Repository...**
4.  Click **Choose...** and select the folder where this project is located on your computer.
5.  Click **Add Repository**.
6.  You will see a button that says **Publish repository**. Click it.
    *   Name: `gmct-management-system`
    *   Uncheck "Keep this code private" if you want it public (or keep it private).
    *   Click **Publish Repository**.

**2. Saving Your Daily Changes**
Every time you make changes to the app (or update the code):
1.  Open GitHub Desktop.
2.  You will see a list of "Changes" on the left side (all the files you modified).
3.  At the bottom left, type a **Summary** (e.g., "Updated Member Form").
4.  Click the blue **Commit to main** button.
5.  Click the **Push origin** button (top right) to save the files to the cloud.

---

### Option B: Using Command Line (Terminal)

**1. Initial Setup**
1.  **Create a Repository:** Go to [GitHub.com](https://github.com/new) and create a new **empty** repository. Name it `gmct-management-system`.
2.  **Initialize Git:** Open your terminal in the project folder and run:
    ```bash
    git init
    git add .
    git commit -m "Initial setup of GMCT System"
    git branch -M main
    ```
3.  **Link to GitHub:** Replace `YOUR_USERNAME` with your actual GitHub username below:
    ```bash
    git remote add origin https://github.com/YOUR_USERNAME/gmct-management-system.git
    git push -u origin main
    ```

**2. Saving Changes**
```bash
# 1. Stage all changes
git add .

# 2. Commit with a message describing what you did
git commit -m "Updated financial entry form validation"

# 3. Push to GitHub
git push
```
/ /   t r i g g e r   r e d e p l o y 
 
 