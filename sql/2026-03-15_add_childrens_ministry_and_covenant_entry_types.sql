-- Add 'childrens-ministry' and 'covenant' to the allowed entry types.
-- The entries.type column was created with a CHECK constraint that only included
-- the original types and needs to be expanded.

-- Step 1: Drop the existing type CHECK constraint (Supabase auto-names it entries_type_check).
-- We use a DO block so the statement is ignored safely if the constraint doesn't exist or has a different name.
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'entries'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%type%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE entries DROP CONSTRAINT %I', constraint_name);
    RAISE NOTICE 'Dropped constraint: %', constraint_name;
  ELSE
    RAISE NOTICE 'No type CHECK constraint found on entries table — nothing to drop.';
  END IF;
END $$;

-- Step 2: Add the updated CHECK constraint with all valid types.
ALTER TABLE entries
  ADD CONSTRAINT entries_type_check CHECK (
    type IN (
      'tithe',
      'offering',
      'thanksgiving-offering',
      'pledge',
      'harvest-levy',
      'harvest-pledge',
      'harvest',
      'harvest-launch',
      'day-born',
      'development-fund',
      'covenant',
      'childrens-ministry',
      'other'
    )
  );
