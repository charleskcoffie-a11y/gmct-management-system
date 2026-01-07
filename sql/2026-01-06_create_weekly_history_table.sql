-- SQL for Supabase: Create weekly_history table
-- This stores weekly service history records for the church

create table if not exists weekly_history (
  id uuid primary key default gen_random_uuid(),
  date_of_service date not null,
  society_name text not null default 'Ghana Methodist Church Toronto (GMCT)',
  data jsonb not null,
  created_by text,
  updated_by text,
  last_updated timestamptz default now(),
  created_at timestamptz default now(),
  unique(id)
);

-- Create index for faster queries
create index if not exists idx_weekly_history_date on weekly_history(date_of_service);
create index if not exists idx_weekly_history_created on weekly_history(created_at);

-- Add comment for clarity
comment on table weekly_history is 'Stores weekly service history records with complete service details (attendance, donations, visitors, etc.) stored in JSONB format';
comment on column weekly_history.id is 'Unique identifier for the weekly history record';
comment on column weekly_history.date_of_service is 'Date of the service (ISO format YYYY-MM-DD)';
comment on column weekly_history.society_name is 'Name of the society/church';
comment on column weekly_history.data is 'Complete weekly history record stored as JSON including officiant, liturgist, attendance, visitors, donations, events, and no_donation flag';

-- Enable Row Level Security (RLS)
alter table weekly_history enable row level security;

-- Create policies to allow authenticated users to read/write
drop policy if exists "Allow authenticated users to read weekly_history" on weekly_history;
create policy "Allow authenticated users to read weekly_history"
  on weekly_history for select
  using (auth.role() = 'authenticated' or auth.role() = 'anon');

drop policy if exists "Allow authenticated users to insert weekly_history" on weekly_history;
create policy "Allow authenticated users to insert weekly_history"
  on weekly_history for insert
  with check (auth.role() = 'authenticated' or auth.role() = 'anon');

drop policy if exists "Allow authenticated users to update weekly_history" on weekly_history;
create policy "Allow authenticated users to update weekly_history"
  on weekly_history for update
  using (auth.role() = 'authenticated' or auth.role() = 'anon');

drop policy if exists "Allow authenticated users to delete weekly_history" on weekly_history;
create policy "Allow authenticated users to delete weekly_history"
  on weekly_history for delete
  using (auth.role() = 'authenticated' or auth.role() = 'anon');
