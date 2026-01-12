-- Migration: Add entry window restriction columns to app_settings table
-- Date: 2026-01-11
-- Purpose: Persist entry window configuration in Supabase for multi-user consistency

-- Add entry window columns to app_settings
ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS entry_window_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS entry_window_days TEXT, -- JSON array of day names
ADD COLUMN IF NOT EXISTS entry_window_start_time TEXT DEFAULT '06:00',
ADD COLUMN IF NOT EXISTS entry_window_end_time TEXT DEFAULT '18:00';

-- Comment the columns
COMMENT ON COLUMN app_settings.entry_window_enabled IS 'Whether to enforce entry window restrictions';
COMMENT ON COLUMN app_settings.entry_window_days IS 'JSON array of allowed day names e.g., ["Sunday", "Monday"]';
COMMENT ON COLUMN app_settings.entry_window_start_time IS 'Start time in HH:MM format (EST)';
COMMENT ON COLUMN app_settings.entry_window_end_time IS 'End time in HH:MM format (EST)';
