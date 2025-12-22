-- SQL for Supabase: Create harvest_pledges table
create table if not exists harvest_pledges (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references members(id),
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
  created_at timestamptz default now()
);
