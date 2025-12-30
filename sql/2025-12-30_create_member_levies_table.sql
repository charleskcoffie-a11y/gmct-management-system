-- Create member_levies table to store annual harvest levy records per member
-- This table tracks the base levy amount, carry-over from previous years, and remaining balance

CREATE TABLE IF NOT EXISTS member_levies (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL,
    year INTEGER NOT NULL,
    base_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    carry_over NUMERIC(10,2) NOT NULL DEFAULT 0,
    remaining NUMERIC(10,2) NOT NULL DEFAULT 0,
    class_number TEXT,
    group_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(member_id, year)
);

-- Add missing column if table already exists
ALTER TABLE member_levies ADD COLUMN IF NOT EXISTS group_name TEXT;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_member_levies_member_id ON member_levies(member_id);
CREATE INDEX IF NOT EXISTS idx_member_levies_year ON member_levies(year);
CREATE INDEX IF NOT EXISTS idx_member_levies_remaining ON member_levies(remaining);

-- Add RLS policies
ALTER TABLE member_levies ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists, then recreate
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON member_levies;
CREATE POLICY "Allow all operations for authenticated users" ON member_levies
    FOR ALL USING (true);

COMMENT ON TABLE member_levies IS 'Tracks annual harvest levy records for each member, including base amount, carry-over, and remaining balance';
