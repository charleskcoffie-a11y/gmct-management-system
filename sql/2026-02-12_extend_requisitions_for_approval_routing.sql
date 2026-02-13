-- Migration: Extend requisitions and approvals for routing and completion
-- Date: 2026-02-12

ALTER TABLE requisitions
ADD COLUMN IF NOT EXISTS requester_name TEXT,
ADD COLUMN IF NOT EXISTS intended_for TEXT,
ADD COLUMN IF NOT EXISTS purchase_type TEXT,
ADD COLUMN IF NOT EXISTS required_approver_role TEXT,
ADD COLUMN IF NOT EXISTS required_approver_username TEXT,
ADD COLUMN IF NOT EXISTS completion_attachment_url TEXT,
ADD COLUMN IF NOT EXISTS completion_attachment_at TIMESTAMPTZ;

ALTER TABLE requisition_approvals
ADD COLUMN IF NOT EXISTS approver_role TEXT,
ADD COLUMN IF NOT EXISTS signature_name TEXT,
ADD COLUMN IF NOT EXISTS signature_at TIMESTAMPTZ;

COMMENT ON COLUMN requisitions.requester_name IS 'Requester full name (required)';
COMMENT ON COLUMN requisitions.intended_for IS 'Beneficiary or department';
COMMENT ON COLUMN requisitions.purchase_type IS 'routine or adhoc';
COMMENT ON COLUMN requisitions.required_approver_role IS 'Role required to approve';
COMMENT ON COLUMN requisitions.required_approver_username IS 'Username required to approve';
COMMENT ON COLUMN requisitions.completion_attachment_url IS 'Completion photo URL';
COMMENT ON COLUMN requisitions.completion_attachment_at IS 'Completion photo upload time';
COMMENT ON COLUMN requisition_approvals.signature_name IS 'Typed approval signature name';
COMMENT ON COLUMN requisition_approvals.signature_at IS 'Approval signature time';
