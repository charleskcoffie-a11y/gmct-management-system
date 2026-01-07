-- SQL for Supabase: Create attendance tables
-- This stores class attendance records and member attendance details

-- Main attendance table (one record per class per date)
create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  class_number text not null,
  attendance_date date not null,
  class_leader_id uuid references class_leaders(id),
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
  unique(class_number, attendance_date)
);

-- Individual member attendance records
create table if not exists member_attendance (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references attendance(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  member_name text not null,
  class_number text not null,
  status text not null check (status in ('present', 'absent', 'sick', 'travel', 'catechumen')),
  notes text,
  created_by text,
  updated_by text,
  last_updated timestamptz default now(),
  created_at timestamptz default now()
);

-- Visitor attendance records
create table if not exists visitor_attendance (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references attendance(id) on delete cascade,
  visitor_name text not null,
  visitor_from text,
  visitor_position text,
  class_number text not null,
  recorded_by text,
  created_at timestamptz default now()
);

-- Add comments for clarity
comment on table attendance is 'Stores weekly class attendance summaries';
comment on column attendance.class_number is 'The class number (1-14 or more)';
comment on column attendance.attendance_date is 'Date of the attendance (ISO format YYYY-MM-DD)';
comment on column attendance.class_leader_id is 'Reference to the class leader who recorded attendance';

comment on table member_attendance is 'Individual member attendance details for each class date';
comment on column member_attendance.status is 'Member status: present, absent, sick, travel, catechumen';

comment on table visitor_attendance is 'Stores visitor records for each class attendance session';
comment on column visitor_attendance.visitor_name is 'Name of the visitor';
comment on column visitor_attendance.visitor_from is 'Where the visitor is from';
comment on column visitor_attendance.visitor_position is 'Position/title of the visitor';

-- Create indexes for faster queries
create index if not exists idx_attendance_class_date on attendance(class_number, attendance_date);
create index if not exists idx_attendance_class_leader on attendance(class_leader_id);
create index if not exists idx_member_attendance_attendance_id on member_attendance(attendance_id);
create index if not exists idx_member_attendance_member_id on member_attendance(member_id);
create index if not exists idx_member_attendance_status on member_attendance(status);
create index if not exists idx_visitor_attendance_attendance_id on visitor_attendance(attendance_id);

-- Enable Row Level Security (RLS)
alter table attendance enable row level security;
alter table member_attendance enable row level security;
alter table visitor_attendance enable row level security;

-- Create policies to allow authenticated users to read/write attendance
drop policy if exists "Allow authenticated users to read attendance" on attendance;
create policy "Allow authenticated users to read attendance"
  on attendance for select
  using (auth.role() = 'authenticated' or auth.role() = 'anon');

drop policy if exists "Allow authenticated users to insert attendance" on attendance;
create policy "Allow authenticated users to insert attendance"
  on attendance for insert
  with check (auth.role() = 'authenticated' or auth.role() = 'anon');

drop policy if exists "Allow authenticated users to update attendance" on attendance;
create policy "Allow authenticated users to update attendance"
  on attendance for update
  using (auth.role() = 'authenticated' or auth.role() = 'anon');

drop policy if exists "Allow authenticated users to delete attendance" on attendance;
create policy "Allow authenticated users to delete attendance"
  on attendance for delete
  using (auth.role() = 'authenticated' or auth.role() = 'anon');

-- Member attendance policies
drop policy if exists "Allow authenticated users to read member_attendance" on member_attendance;
create policy "Allow authenticated users to read member_attendance"
  on member_attendance for select
  using (auth.role() = 'authenticated' or auth.role() = 'anon');

drop policy if exists "Allow authenticated users to insert member_attendance" on member_attendance;
create policy "Allow authenticated users to insert member_attendance"
  on member_attendance for insert
  with check (auth.role() = 'authenticated' or auth.role() = 'anon');

drop policy if exists "Allow authenticated users to update member_attendance" on member_attendance;
create policy "Allow authenticated users to update member_attendance"
  on member_attendance for update
  using (auth.role() = 'authenticated' or auth.role() = 'anon');

drop policy if exists "Allow authenticated users to delete member_attendance" on member_attendance;
create policy "Allow authenticated users to delete member_attendance"
  on member_attendance for delete
  using (auth.role() = 'authenticated' or auth.role() = 'anon');

-- Visitor attendance policies
drop policy if exists "Allow authenticated users to read visitor_attendance" on visitor_attendance;
create policy "Allow authenticated users to read visitor_attendance"
  on visitor_attendance for select
  using (auth.role() = 'authenticated' or auth.role() = 'anon');

drop policy if exists "Allow authenticated users to insert visitor_attendance" on visitor_attendance;
create policy "Allow authenticated users to insert visitor_attendance"
  on visitor_attendance for insert
  with check (auth.role() = 'authenticated' or auth.role() = 'anon');

drop policy if exists "Allow authenticated users to update visitor_attendance" on visitor_attendance;
create policy "Allow authenticated users to update visitor_attendance"
  on visitor_attendance for update
  using (auth.role() = 'authenticated' or auth.role() = 'anon');

drop policy if exists "Allow authenticated users to delete visitor_attendance" on visitor_attendance;
create policy "Allow authenticated users to delete visitor_attendance"
  on visitor_attendance for delete
  using (auth.role() = 'authenticated' or auth.role() = 'anon');
