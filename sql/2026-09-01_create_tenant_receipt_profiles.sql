-- Private per-society signing authority for official tax receipts.
-- Additive only: no existing society, member, entry, or receipt data is changed.

create table if not exists public.tenant_receipt_profiles (
    society_id text primary key references public.societies(id) on delete cascade,
    charity_number text not null,
    logo_image text,
    minister_name text not null,
    minister_signature text,
    treasurer_name text not null,
    treasurer_signature text,
    updated_at timestamptz not null default now()
);

alter table public.tenant_receipt_profiles
    add column if not exists logo_image text;

alter table public.tenant_receipt_profiles enable row level security;

revoke all on public.tenant_receipt_profiles from anon, authenticated;
