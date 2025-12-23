-- SQL for Supabase: Create harvest_pledge_payments table to track payment history
-- This table records every payment made toward a harvest pledge

create table if not exists public.harvest_pledge_payments (
  id uuid primary key default gen_random_uuid(),
  pledge_id uuid references public.harvest_pledges(id) on delete cascade,
  payment_date date not null,
  amount numeric not null,
  entry_id uuid, -- Reference to the financial entry created for this payment
  paid_by text, -- Username who processed the payment
  notes text,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.harvest_pledge_payments enable row level security;
create policy "Enable all access for anon users" on public.harvest_pledge_payments 
  for all using (true) with check (true);

-- Index for faster queries
create index if not exists idx_pledge_payments_pledge_id on public.harvest_pledge_payments(pledge_id);
create index if not exists idx_pledge_payments_date on public.harvest_pledge_payments(payment_date);

-- Also enable RLS on harvest_pledges if not already done
alter table public.harvest_pledges enable row level security;
create policy "Enable all access for anon users" on public.harvest_pledges 
  for all using (true) with check (true);
