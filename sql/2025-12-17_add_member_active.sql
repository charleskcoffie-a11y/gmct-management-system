-- Add 'active' column to members table, defaulting to true
ALTER TABLE members
ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Optionally add 'address' column if not already present (used by receipts)
ALTER TABLE members
ADD COLUMN IF NOT EXISTS address text;

-- Backfill existing rows to ensure non-null values
UPDATE members SET active = COALESCE(active, true);
