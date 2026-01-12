-- Migration: Create app_settings table for storing application configuration
-- Date: 2025-12-15
-- Purpose: Central storage for all application settings in Supabase

CREATE TABLE IF NOT EXISTS app_settings (
    id TEXT PRIMARY KEY DEFAULT 'app_settings',
    currency TEXT DEFAULT 'GH₵',
    max_classes INTEGER DEFAULT 14,
    enforce_directory BOOLEAN DEFAULT true,
    supabase_url TEXT,
    logo_url TEXT,
    org_name TEXT,
    org_address TEXT,
    org_phone TEXT,
    org_email TEXT,
    charity_number TEXT,
    signature_image TEXT,
    annual_levy_amount NUMERIC(10,2),
    etransfer_notification_email TEXT,
    etransfer_provider TEXT,
    class_access_codes TEXT, -- JSON object mapping class numbers to access codes
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments for documentation
COMMENT ON TABLE app_settings IS 'Application-wide settings and configuration';
COMMENT ON COLUMN app_settings.id IS 'Fixed ID for single-row settings table';
COMMENT ON COLUMN app_settings.currency IS 'Currency symbol for display';
COMMENT ON COLUMN app_settings.max_classes IS 'Maximum number of classes in the organization';
COMMENT ON COLUMN app_settings.enforce_directory IS 'Whether to enforce member selection from directory';
COMMENT ON COLUMN app_settings.class_access_codes IS 'JSON object mapping class numbers to access codes';

-- Insert default settings row if not exists
INSERT INTO app_settings (id) VALUES ('app_settings')
ON CONFLICT (id) DO NOTHING;
