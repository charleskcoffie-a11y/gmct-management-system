-- Create the Parking receipts table for weekly church parking income
create table if not exists public.parking_receipts (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  amount numeric(12,2) not null default 0,
  notes text,
  created_by text,
  updated_by text,
  last_updated timestamptz,
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.parking_receipts enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'parking_receipts' and policyname = 'parking_receipts_read') then
    create policy parking_receipts_read on public.parking_receipts for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'parking_receipts' and policyname = 'parking_receipts_insert') then
    create policy parking_receipts_insert on public.parking_receipts for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'parking_receipts' and policyname = 'parking_receipts_update') then
    create policy parking_receipts_update on public.parking_receipts for update using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'parking_receipts' and policyname = 'parking_receipts_delete') then
    create policy parking_receipts_delete on public.parking_receipts for delete using (true);
  end if;
end $$;

-- Shared monthly target setting for parking
alter table public.app_settings add column if not exists parking_monthly_target numeric(12,2) default 2500;
