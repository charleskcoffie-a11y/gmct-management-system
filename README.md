
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
create table if not exists public.members (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    class_number text,
    member_number text, 
    created_at timestamp with time zone default timezone('utc'::text, now())
);

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
    created_at timestamp with time zone default timezone('utc'::text, now())
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

-- 6. Create Development Fund Table
create table if not exists public.development_fund (
    id uuid primary key default uuid_generate_v4(),
    date date not null,
    member_id uuid references public.members(id),
    amount numeric,
    description text,
    created_by text,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 7. Create Users Table (for app login management)
create table if not exists public.app_users (
    username text primary key,
    password text not null,
    role text not null,
    class_led text,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 8. Create Month Locks Table
create table if not exists public.month_locks (
    month text primary key, -- Format YYYY-MM
    is_locked boolean default false,
    locked_by text,
    locked_at timestamp with time zone
);

-- 9. Configure Access Policies (Row Level Security)
alter table public.members enable row level security;
create policy "Enable all access for anon users" on public.members for all using (true) with check (true);

alter table public.entries enable row level security;
create policy "Enable all access for anon users" on public.entries for all using (true) with check (true);

alter table public.attendance enable row level security;
create policy "Enable all access for anon users" on public.attendance for all using (true) with check (true);

alter table public.weekly_history enable row level security;
create policy "Enable all access for anon users" on public.weekly_history for all using (true) with check (true);

alter table public.development_fund enable row level security;
create policy "Enable all access for anon users" on public.development_fund for all using (true) with check (true);

alter table public.app_users enable row level security;
create policy "Enable all access for anon users" on public.app_users for all using (true) with check (true);

alter table public.month_locks enable row level security;
create policy "Enable all access for anon users" on public.month_locks for all using (true) with check (true);
```

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

## Part 2: User Roles Definition

**Admin (Full Authority)**
Admin has full control over financial data and all system settings. Admin can approve corrections, lock/unlock periods, access audit logs, edit/delete any record, manage all user accounts, and export any report. The Admin has complete visibility and management authority.

**Finance Chair (Full Financial Authority)**
Oversees all financial operations. Approves corrections, manages period locking, views audit trails, and exports detailed reports. Cannot change system settings or user roles.

**Finance Team (Standard Financial Authority)**
Handles daily financial entry. Can add contributions, edit recent entries, view reports, and search member histories. Major or old corrections require Admin/Finance Chair approval.

**Data Entry Members (Limited Authority)**
Can only enter new contributions and edit their own recent entries (15 minutes). Cannot view other members’ giving, reports, or historical data.

**Pastor (Leadership Read-Only)**
Can view giving summaries, trends, class totals, and Development Fund progress. Cannot edit financial records or change system settings. Individual giving view is optional based on church policy.

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
