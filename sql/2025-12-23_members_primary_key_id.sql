-- Ensure 'id' is the authoritative key for members
-- This script is idempotent and safe to run multiple times.

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- If 'id' is not UUID yet, attempt conversion
DO $$
BEGIN
  -- Check if column type is already UUID; if not, try convert
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'members'
      AND column_name = 'id'
      AND data_type <> 'uuid'
  ) THEN
    -- Convert text/varchar to uuid using cast
    ALTER TABLE members ALTER COLUMN id TYPE uuid USING id::uuid;
  END IF;
END$$;

-- Backfill any NULL ids with generated UUIDs
UPDATE members SET id = gen_random_uuid() WHERE id IS NULL;

-- Ensure id is NOT NULL
ALTER TABLE members ALTER COLUMN id SET NOT NULL;

-- Add primary key on id if it doesn't exist yet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'members_pkey'
  ) THEN
    ALTER TABLE members ADD CONSTRAINT members_pkey PRIMARY KEY (id);
  END IF;
END$$;