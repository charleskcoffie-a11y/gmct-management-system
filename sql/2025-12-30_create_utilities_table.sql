-- Create utilities table to store application-wide utility settings
-- This includes settings like annual levy amount that should be database-driven, not localStorage

CREATE TABLE IF NOT EXISTS utilities (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by TEXT
);

-- Insert default annual levy amount
INSERT INTO utilities (key, value, description) 
VALUES ('annual_levy_amount', '0', 'Annual harvest levy amount per member')
ON CONFLICT (key) DO NOTHING;

-- Add RLS policies
ALTER TABLE utilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for authenticated users" ON utilities
    FOR SELECT USING (true);

CREATE POLICY "Allow write for authenticated users" ON utilities
    FOR ALL USING (true);

COMMENT ON TABLE utilities IS 'Application-wide utility settings stored in database instead of localStorage';
