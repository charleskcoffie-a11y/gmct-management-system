-- Requisitions MVP schema

create table if not exists requisitions (
  id uuid primary key,
  requester_username text not null,
  requester_name text,
  title text not null,
  purpose text,
  intended_for text,
  purchase_type text,
  fund text,
  needed_by date,
  total_amount numeric(12,2) default 0 not null,
  status text not null default 'draft', -- draft|submitted|approved|rejected|funded|paid|closed
  required_approver_role text,
  required_approver_username text,
  completion_attachment_url text,
  completion_attachment_at timestamptz,
  created_at timestamptz default now(),
  updated_by text,
  last_updated timestamptz
);

create table if not exists requisition_items (
  id uuid primary key,
  requisition_id uuid references requisitions(id) on delete cascade,
  description text not null,
  qty numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  account_code text
);

create table if not exists requisition_approvals (
  id uuid primary key,
  requisition_id uuid references requisitions(id) on delete cascade,
  approver_username text not null,
  approver_role text,
  decision text not null, -- approved|rejected
  note text,
  signature_name text,
  signature_at timestamptz,
  decided_at timestamptz default now()
);

create table if not exists requisition_comments (
  id uuid primary key,
  requisition_id uuid references requisitions(id) on delete cascade,
  author_username text not null,
  body text not null,
  created_at timestamptz default now()
);

-- Simple helpful view for pending approvals (submitted only)
create or replace view v_requisitions_pending as
select r.*
from requisitions r
where r.status = 'submitted';

-- Indexes
create index if not exists idx_requisitions_status on requisitions(status);
create index if not exists idx_requisitions_requester on requisitions(requester_username);
create index if not exists idx_req_items_req on requisition_items(requisition_id);
create index if not exists idx_req_approvals_req on requisition_approvals(requisition_id);
create index if not exists idx_req_comments_req on requisition_comments(requisition_id);

-- Note: RLS policies can be added later; keep open for MVP testing.