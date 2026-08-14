-- Create table for Wesley Hall rental receipts
create table if not exists public.wesley_hall_receipts (
  id uuid primary key,
  date date not null,
  amount numeric(12,2) not null default 0,
  notes text,
  created_by text,
  updated_by text,
  last_updated timestamptz,
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_wesley_hall_receipts_date on public.wesley_hall_receipts(date desc);
create index if not exists idx_wesley_hall_receipts_deleted on public.wesley_hall_receipts(deleted);

alter table public.wesley_hall_receipts enable row level security;

drop policy if exists wesley_hall_receipts_select on public.wesley_hall_receipts;
create policy wesley_hall_receipts_select on public.wesley_hall_receipts
for select using (true);

drop policy if exists wesley_hall_receipts_insert on public.wesley_hall_receipts;
create policy wesley_hall_receipts_insert on public.wesley_hall_receipts
for insert with check (true);

drop policy if exists wesley_hall_receipts_update on public.wesley_hall_receipts;
create policy wesley_hall_receipts_update on public.wesley_hall_receipts
for update using (true) with check (true);

drop policy if exists wesley_hall_receipts_delete on public.wesley_hall_receipts;
create policy wesley_hall_receipts_delete on public.wesley_hall_receipts
for delete using (true);
