-- Ensure members table has email column
ALTER TABLE members
ADD COLUMN IF NOT EXISTS email text;
