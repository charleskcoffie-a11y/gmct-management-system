-- Migration: Add requisition number and date created
-- Date: 2026-02-12

ALTER TABLE requisitions
ADD COLUMN IF NOT EXISTS requisition_number TEXT,
ADD COLUMN IF NOT EXISTS date_created DATE;

COMMENT ON COLUMN requisitions.requisition_number IS 'Formatted requisition number for check attachment (e.g., REQ-2026-001)';
COMMENT ON COLUMN requisitions.date_created IS 'Date the requisition was created (YYYY-MM-DD)';

-- Create index on date_created for efficient yearly lookups
CREATE INDEX IF NOT EXISTS idx_requisitions_date_created ON requisitions(date_created);
