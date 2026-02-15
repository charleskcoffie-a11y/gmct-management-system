-- Add receipt attachment JSON to requisitions

alter table if exists requisitions
  add column if not exists receipt_attachment jsonb;

alter table if exists requisitions
  add column if not exists source_type text,
  add column if not exists uploaded_pdf jsonb;

comment on column requisitions.receipt_attachment is 'JSON receipt attachments (array of dataUrl, contentType, fileName, size, source, createdAt).';
comment on column requisitions.source_type is 'Source type for requisition: form or pdf-upload.';
comment on column requisitions.uploaded_pdf is 'JSON metadata for uploaded requisition PDF.';
