-- Add soft delete columns to entries table
-- This allows entries to be marked as deleted rather than permanently removed

-- Add deleted flag column (defaults to false for existing entries)
ALTER TABLE entries 
ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;

-- Add deleted metadata columns
ALTER TABLE entries 
ADD COLUMN IF NOT EXISTS deleted_by TEXT;

ALTER TABLE entries 
ADD COLUMN IF NOT EXISTS deleted_reason TEXT;

ALTER TABLE entries 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Create index for efficient querying of deleted entries
CREATE INDEX IF NOT EXISTS idx_entries_deleted ON entries(deleted);

-- Add comments to document the columns
COMMENT ON COLUMN entries.deleted IS 'Soft delete flag - true if entry has been deleted';
COMMENT ON COLUMN entries.deleted_by IS 'Username of user who deleted the entry';
COMMENT ON COLUMN entries.deleted_reason IS 'Reason provided for deletion';
COMMENT ON COLUMN entries.deleted_at IS 'Timestamp when entry was deleted';
