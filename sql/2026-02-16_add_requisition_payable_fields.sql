-- Add payable and organization fields to requisitions

alter table if exists requisitions
  add column if not exists payable_to text;

alter table if exists requisitions
  add column if not exists organization_committee text;

comment on column requisitions.payable_to is 'Name on cheque for requisition payment.';
comment on column requisitions.organization_committee is 'Organization or committee associated with requisition payment.';
