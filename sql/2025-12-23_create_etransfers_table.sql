-- Create table to store inbound e-transfer notifications
create table if not exists public.etransfers (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  amount numeric(12,2),
  currency text,
  sender_name text,
  sender_email text,
  memo text,
  raw_subject text,
  raw_text text,
  reconciled boolean not null default false,
  created_at timestamptz not null default now()
);

-- Basic RLS (adjust as needed)
alter table public.etransfers enable row level security;
create policy etransfers_read on public.etransfers for select using (true);
create policy etransfers_write on public.etransfers for insert with check (true);
create policy etransfers_update on public.etransfers for update using (true);
