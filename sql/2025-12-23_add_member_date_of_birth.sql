-- Add DOB fields for members (nullable)
ALTER TABLE members
ADD COLUMN IF NOT EXISTS date_of_birth date;

-- Also ensure month/day components exist for legacy birthday storage
ALTER TABLE members
ADD COLUMN IF NOT EXISTS dob_month integer;

ALTER TABLE members
ADD COLUMN IF NOT EXISTS dob_day integer;
