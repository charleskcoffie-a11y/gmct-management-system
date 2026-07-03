-- Migration: Organization Funds (multi-device shared storage)
-- Creates:
-- 1) organization_funds_organizations (master list)
-- 2) organization_funds_transactions (deposits + withdrawal requests/approvals)
-- 3) v_organization_funds_balances (current balances by organization)

create table if not exists public.organization_funds_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.organization_funds_organizations is 'Master list of organizations/committees that submit or request funds.';
comment on column public.organization_funds_organizations.name is 'Unique organization name (e.g., AMB, Choir).';
comment on column public.organization_funds_organizations.is_active is 'Soft toggle to hide without losing history.';

create table if not exists public.organization_funds_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization_funds_organizations(id) on delete restrict,
  organization_name_snapshot text not null,
  tx_type text not null check (tx_type in ('deposit', 'withdrawal')),
  status text not null default 'pending' check (status in ('posted', 'pending', 'approved', 'rejected')),
  amount numeric(12,2) not null check (amount > 0),
  tx_date date not null default current_date,
  submitted_by text not null,
  entered_by text not null,
  note text,
  approved_by text,
  approver_signature_name text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Approved/rejected rows must include approver metadata
  constraint org_funds_approval_fields_required check (
    status not in ('approved', 'rejected')
    or (
      approved_by is not null
      and approver_signature_name is not null
      and btrim(approver_signature_name) <> ''
      and approved_at is not null
    )
  ),

  -- Prevent requester/entry user from self-approving in DB layer too
  constraint org_funds_no_self_approval check (
    status not in ('approved', 'rejected')
    or (
      lower(approved_by) <> lower(submitted_by)
      and lower(approved_by) <> lower(entered_by)
    )
  )
);

comment on table public.organization_funds_transactions is 'Organization fund movements: deposits and withdrawal workflow (pending/approved/rejected).';
comment on column public.organization_funds_transactions.organization_name_snapshot is 'Name captured at entry time for reporting continuity.';
comment on column public.organization_funds_transactions.tx_type is 'deposit increases available balance; withdrawal decreases only when approved.';
comment on column public.organization_funds_transactions.status is 'posted for deposits, pending/approved/rejected for withdrawals.';

create index if not exists idx_org_funds_org_name on public.organization_funds_organizations(name);
create index if not exists idx_org_funds_org_active on public.organization_funds_organizations(is_active);

create index if not exists idx_org_funds_tx_org on public.organization_funds_transactions(organization_id);
create index if not exists idx_org_funds_tx_date on public.organization_funds_transactions(tx_date desc);
create index if not exists idx_org_funds_tx_status on public.organization_funds_transactions(status);
create index if not exists idx_org_funds_tx_type on public.organization_funds_transactions(tx_type);

create or replace view public.v_organization_funds_balances as
select
  o.id as organization_id,
  o.name as organization_name,
  coalesce(sum(case
    when t.tx_type = 'deposit' and t.status = 'posted' then t.amount
    when t.tx_type = 'withdrawal' and t.status = 'approved' then -t.amount
    else 0
  end), 0)::numeric(12,2) as available_balance,
  coalesce(sum(case
    when t.tx_type = 'withdrawal' and t.status = 'pending' then t.amount
    else 0
  end), 0)::numeric(12,2) as pending_withdrawals,
  coalesce(sum(case
    when t.tx_type = 'deposit' and t.status = 'posted' then t.amount
    else 0
  end), 0)::numeric(12,2) as total_deposited,
  coalesce(sum(case
    when t.tx_type = 'withdrawal' and t.status = 'approved' then t.amount
    else 0
  end), 0)::numeric(12,2) as total_withdrawn
from public.organization_funds_organizations o
left join public.organization_funds_transactions t on t.organization_id = o.id
group by o.id, o.name;

comment on view public.v_organization_funds_balances is 'Computed balances and totals per organization.';

-- Seed your requested organizations (safe to re-run)
insert into public.organization_funds_organizations (name)
values
  ('AMB'),
  ('Girls Fellowship'),
  ('Women''s Fellowship'),
  ('Men''s Fellowship'),
  ('Singing Band'),
  ('Choir'),
  ('CLB'),
  ('Children Ministries'),
  ('Guild'),
  ('SUWMA MYF')
on conflict (name) do nothing;

-- RLS policies (matching app pattern: allow anon/auth for now)
alter table public.organization_funds_organizations enable row level security;
alter table public.organization_funds_transactions enable row level security;

drop policy if exists org_funds_orgs_read on public.organization_funds_organizations;
create policy org_funds_orgs_read
  on public.organization_funds_organizations for select
  using (true);

drop policy if exists org_funds_orgs_insert on public.organization_funds_organizations;
create policy org_funds_orgs_insert
  on public.organization_funds_organizations for insert
  with check (true);

drop policy if exists org_funds_orgs_update on public.organization_funds_organizations;
create policy org_funds_orgs_update
  on public.organization_funds_organizations for update
  using (true);

drop policy if exists org_funds_orgs_delete on public.organization_funds_organizations;
create policy org_funds_orgs_delete
  on public.organization_funds_organizations for delete
  using (true);

drop policy if exists org_funds_tx_read on public.organization_funds_transactions;
create policy org_funds_tx_read
  on public.organization_funds_transactions for select
  using (true);

drop policy if exists org_funds_tx_insert on public.organization_funds_transactions;
create policy org_funds_tx_insert
  on public.organization_funds_transactions for insert
  with check (true);

drop policy if exists org_funds_tx_update on public.organization_funds_transactions;
create policy org_funds_tx_update
  on public.organization_funds_transactions for update
  using (true);

drop policy if exists org_funds_tx_delete on public.organization_funds_transactions;
create policy org_funds_tx_delete
  on public.organization_funds_transactions for delete
  using (true);
