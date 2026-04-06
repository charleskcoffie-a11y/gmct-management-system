-- Add 'lent-donation' to the entries.type CHECK constraint.
-- Use this migration for environments where the previous constraint update
-- was already applied without lent-donation.

DO $$
BEGIN
  -- Drop only the known entries type check constraint if it exists.
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'entries_type_check'
      AND conrelid = 'entries'::regclass
  ) THEN
    ALTER TABLE entries DROP CONSTRAINT entries_type_check;
  END IF;
END $$;

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
      'lent-donation',
      'development-fund',
      'covenant',
      'childrens-ministry',
      'other'
    )
  );
