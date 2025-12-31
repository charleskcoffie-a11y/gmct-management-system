-- SQL for Supabase: Create class_leaders table
-- This table stores class leader information and their access codes

create table if not exists class_leaders (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password text not null,
  class_number text not null,
  access_code text not null unique,
  full_name text,
  phone text,
  email text,
  active boolean not null default true,
  created_by text,
  updated_by text,
  last_updated timestamptz default now(),
  created_at timestamptz default now()
);

-- Add comments for clarity
comment on table class_leaders is 'Stores class leader credentials and access information';
comment on column class_leaders.username is 'Unique username for the class leader';
comment on column class_leaders.password is 'Encrypted password for authentication';
comment on column class_leaders.class_number is 'The class number this leader manages (e.g., "1", "2", "3")';
comment on column class_leaders.access_code is 'Unique access code for quick login';
comment on column class_leaders.active is 'Whether this class leader account is active';

-- Create index for faster lookups
create index if not exists idx_class_leaders_username on class_leaders(username);
create index if not exists idx_class_leaders_access_code on class_leaders(access_code);
create index if not exists idx_class_leaders_class_number on class_leaders(class_number);

-- Enable Row Level Security (RLS)
alter table class_leaders enable row level security;

-- Drop existing policies if they exist, then create them
drop policy if exists "Allow authenticated users to read class leaders" on class_leaders;
create policy "Allow authenticated users to read class leaders"
  on class_leaders for select
  using (auth.role() = 'authenticated' or auth.role() = 'anon');

drop policy if exists "Allow authenticated users to insert class leaders" on class_leaders;
create policy "Allow authenticated users to insert class leaders"
  on class_leaders for insert
  with check (auth.role() = 'authenticated' or auth.role() = 'anon');

drop policy if exists "Allow authenticated users to update class leaders" on class_leaders;
create policy "Allow authenticated users to update class leaders"
  on class_leaders for update
  using (auth.role() = 'authenticated' or auth.role() = 'anon');

drop policy if exists "Allow authenticated users to delete class leaders" on class_leaders;
create policy "Allow authenticated users to delete class leaders"
  on class_leaders for delete
  using (auth.role() = 'authenticated' or auth.role() = 'anon');
