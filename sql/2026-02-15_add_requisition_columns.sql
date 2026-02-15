-- Add missing requisition columns for older deployments

alter table if exists requisitions
  add column if not exists requisition_number text;

alter table if exists requisitions
  add column if not exists date_created date;

alter table if exists requisitions
  add column if not exists source_type text;

alter table if exists requisitions
  add column if not exists receipt_attachment jsonb;

alter table if exists requisitions
  add column if not exists uploaded_pdf jsonb;
