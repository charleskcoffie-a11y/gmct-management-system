-- SQL for Supabase: Create month_locks table
-- This stores monthly financial period locks with audit trail

create table if not exists month_locks (
  month text primary key,
  is_locked boolean not null default false,
  locked_by text,
  locked_at timestamptz,
  unique(month)
);

-- Create index for faster queries
create index if not exists idx_month_locks_is_locked on month_locks(is_locked);
create index if not exists idx_month_locks_locked_at on month_locks(locked_at);

-- Add comments for clarity
comment on table month_locks is 'Stores monthly financial period locks to prevent editing of past month data';
comment on column month_locks.month is 'Month identifier in YYYY-MM format (e.g., 2026-01)';
comment on column month_locks.is_locked is 'Whether the month is locked (true) or unlocked (false)';
comment on column month_locks.locked_by is 'Username of the user who locked/unlocked the month';
comment on column month_locks.locked_at is 'Timestamp when the month was last locked/unlocked';
