-- Create entry_deletions table to track all deleted entries
-- This provides an audit trail of deletions with reasons and timestamps

CREATE TABLE IF NOT EXISTS entry_deletions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID NOT NULL,
    entry_type TEXT NOT NULL,
    member_id UUID,
    member_name TEXT,
    amount DECIMAL(10, 2),
    original_date DATE,
    deletion_reason TEXT NOT NULL,
    deleted_by TEXT NOT NULL,
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Store original entry data as JSON for complete audit trail
    original_entry_data JSONB,
    
    -- Indexes for efficient querying
    CONSTRAINT entry_deletions_reason_check CHECK (char_length(deletion_reason) >= 3)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_entry_deletions_entry_id ON entry_deletions(entry_id);
CREATE INDEX IF NOT EXISTS idx_entry_deletions_deleted_by ON entry_deletions(deleted_by);
CREATE INDEX IF NOT EXISTS idx_entry_deletions_deleted_at ON entry_deletions(deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_entry_deletions_member_id ON entry_deletions(member_id);
CREATE INDEX IF NOT EXISTS idx_entry_deletions_entry_type ON entry_deletions(entry_type);

-- Enable Row Level Security
ALTER TABLE entry_deletions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anon users to read deletion logs
CREATE POLICY "Allow anon users to read deletion logs"
    ON entry_deletions FOR SELECT
    TO anon
    USING (true);

-- Create policy to allow anon users to insert deletion logs
CREATE POLICY "Allow anon users to insert deletion logs"
    ON entry_deletions FOR INSERT
    TO anon
    WITH CHECK (true);

-- Create policy to allow authenticated users to read deletion logs
CREATE POLICY "Allow authenticated users to read deletion logs"
    ON entry_deletions FOR SELECT
    TO authenticated
    USING (true);

-- Create policy to allow authenticated users to insert deletion logs
CREATE POLICY "Allow authenticated users to insert deletion logs"
    ON entry_deletions FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Add comment to table
COMMENT ON TABLE entry_deletions IS 'Audit log of all deleted entries with reasons and timestamps';
COMMENT ON COLUMN entry_deletions.entry_id IS 'UUID of the deleted entry';
COMMENT ON COLUMN entry_deletions.deletion_reason IS 'Reason for deletion (minimum 3 characters)';
COMMENT ON COLUMN entry_deletions.original_entry_data IS 'Complete entry data before deletion for audit purposes';
