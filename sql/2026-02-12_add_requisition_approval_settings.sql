-- Migration: Add requisition approval limits to app_settings
-- Date: 2026-02-12

ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS requisition_approval_limits TEXT;

ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS requisition_pastor_limits TEXT;

ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS requisition_finance_approvers TEXT;

COMMENT ON COLUMN app_settings.requisition_approval_limits IS 'JSON approval ranges by role for requisitions';
COMMENT ON COLUMN app_settings.requisition_pastor_limits IS 'JSON approval ranges by pastor username';
COMMENT ON COLUMN app_settings.requisition_finance_approvers IS 'JSON list of finance approver usernames';
