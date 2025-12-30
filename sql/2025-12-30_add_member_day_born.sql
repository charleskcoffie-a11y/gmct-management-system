-- Add day_born column to members table
-- Stores the day of the week (Sunday through Saturday)
ALTER TABLE members
ADD COLUMN IF NOT EXISTS day_born text;

-- Optional: Add a check constraint to ensure only valid day names are stored
ALTER TABLE members
DROP CONSTRAINT IF EXISTS day_born_check;

ALTER TABLE members
ADD CONSTRAINT day_born_check
CHECK (day_born IS NULL OR day_born IN ('Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'));
