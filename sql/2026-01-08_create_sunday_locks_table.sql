-- SQL for Supabase: Create sunday_locks table
-- This stores weekly Sunday financial period locks with audit trail

create table if not exists sunday_locks (
  date text primary key,
  is_locked boolean not null default false,
  locked_by text,
  locked_at timestamptz,
  unique(date)
);

-- Create index for faster queries
create index if not exists idx_sunday_locks_is_locked on sunday_locks(is_locked);
create index if not exists idx_sunday_locks_date on sunday_locks(date);
create index if not exists idx_sunday_locks_locked_at on sunday_locks(locked_at);

-- Add comments for clarity
comment on table sunday_locks is 'Stores weekly Sunday financial period locks to prevent editing of past week data';
comment on column sunday_locks.date is 'Sunday date in YYYY-MM-DD format (e.g., 2026-01-05)';
comment on column sunday_locks.is_locked is 'Whether the Sunday is locked (true) or unlocked (false)';
comment on column sunday_locks.locked_by is 'Username of the user who locked/unlocked the Sunday';
comment on column sunday_locks.locked_at is 'Timestamp when the Sunday was last locked/unlocked';
