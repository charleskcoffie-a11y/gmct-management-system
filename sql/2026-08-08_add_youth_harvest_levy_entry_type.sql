-- Add 'youth-harvest-levy' to the entries.type CHECK constraint.

DO $$
BEGIN
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
      'womens-harvest',
      'mens-harvest',
      'youth-harvest',
      'youth-harvest-levy',
      'organizational-anniversary',
      'day-born',
      'lent-donation',
      'development-fund',
      'covenant',
      'childrens-ministry',
      'other'
    )
  );
