-- Ensure members table has profession column
ALTER TABLE members
ADD COLUMN IF NOT EXISTS profession text;
