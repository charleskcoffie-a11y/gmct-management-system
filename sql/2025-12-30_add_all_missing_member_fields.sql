-- Add all missing fields to members table
-- Run this in Supabase SQL Editor

-- Add day_born column
ALTER TABLE members
ADD COLUMN IF NOT EXISTS day_born text;

-- Add check constraint for day_born
ALTER TABLE members
DROP CONSTRAINT IF EXISTS day_born_check;

ALTER TABLE members
ADD CONSTRAINT day_born_check
CHECK (day_born IS NULL OR day_born IN ('Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'));

-- Add dev_fund_pledge column
ALTER TABLE members
ADD COLUMN IF NOT EXISTS dev_fund_pledge boolean DEFAULT false;

-- Add dev_fund_pledge_amount column
ALTER TABLE members
ADD COLUMN IF NOT EXISTS dev_fund_pledge_amount numeric(10,2);

-- Verify all columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'members'
ORDER BY ordinal_position;
