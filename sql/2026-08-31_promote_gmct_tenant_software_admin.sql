-- Run after creating the first tenant administrator.
-- This promotes the single bootstrap account to the dedicated Software Admin role.

alter table public.tenant_credentials
    drop constraint if exists tenant_credentials_role_check;

alter table public.tenant_credentials
    add constraint tenant_credentials_role_check
    check (role in ('software-admin', 'admin', 'finance-chair', 'finance-team', 'data-entry', 'pastor', 'statistician', 'class-leader'));

update public.tenant_credentials
set role = 'software-admin', updated_at = now()
where society_id = 'gmct'
  and role = 'admin';