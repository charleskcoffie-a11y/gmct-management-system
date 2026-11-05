-- Add 'dayborn-levy' to the entries.type CHECK constraint.

BEGIN;

ALTER TABLE public.entries DROP CONSTRAINT IF EXISTS entries_type_check;

ALTER TABLE public.entries
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
      'womens-harvest-levy',
      'mens-harvest',
      'mens-harvest-levy',
      'youth-harvest',
      'youth-harvest-levy',
      'dayborn-levy',
      'organizational-anniversary',
      'day-born',
      'lent-donation',
      'development-fund',
      'covenant',
      'childrens-ministry',
      'other'
    )
  );

COMMIT;
