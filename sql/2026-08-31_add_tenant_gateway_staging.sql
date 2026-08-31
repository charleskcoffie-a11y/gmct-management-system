-- Staged multi-tenant gateway. This migration is additive and does not alter
-- the current GMCT application's client-side login or RLS policies.

alter table public.societies
    add column if not exists status text not null default 'active'
        check (status in ('active', 'archived')),
    add column if not exists archived_at timestamptz,
    add column if not exists updated_at timestamptz not null default now();

create table if not exists public.tenant_credentials (
    id uuid primary key default gen_random_uuid(),
    username text not null,
    society_id text not null references public.societies(id),
    role text not null check (role in ('admin', 'finance-chair', 'finance-team', 'data-entry', 'pastor', 'statistician', 'class-leader')),
    password_salt text not null,
    password_hash text not null,
    enabled boolean not null default true,
    must_change_password boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (username, society_id)
);

create table if not exists public.tenant_sessions (
    id uuid primary key default gen_random_uuid(),
    credential_id uuid not null references public.tenant_credentials(id) on delete cascade,
    token_hash text not null unique,
    expires_at timestamptz not null,
    revoked_at timestamptz,
    created_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now()
);

create table if not exists public.tenant_audit_log (
    id uuid primary key default gen_random_uuid(),
    society_id text references public.societies(id),
    credential_id uuid references public.tenant_credentials(id) on delete set null,
    action text not null,
    details jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists tenant_credentials_society_id_idx on public.tenant_credentials(society_id);
create index if not exists tenant_sessions_active_idx on public.tenant_sessions(credential_id, expires_at) where revoked_at is null;
create index if not exists tenant_audit_log_society_id_idx on public.tenant_audit_log(society_id, created_at desc);

alter table public.tenant_credentials enable row level security;
alter table public.tenant_sessions enable row level security;
alter table public.tenant_audit_log enable row level security;

-- No browser role receives access to these tables. The tenant gateway uses the
-- Supabase service-role key, keeping passwords, sessions, and audit data private.
revoke all on public.tenant_credentials, public.tenant_sessions, public.tenant_audit_log from anon, authenticated;
