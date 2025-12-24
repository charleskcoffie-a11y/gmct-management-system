-- Add a full date_of_birth column for members (nullable)
ALTER TABLE members
ADD COLUMN IF NOT EXISTS date_of_birth date;
