-- Restore client access for requisition approval records.
-- Required for the My Approvals and Requisition modal approve/reject buttons.

grant usage on schema public to anon, authenticated;

do $$
declare
  role_guard text := '(auth.role() = ''anon'' or auth.role() = ''authenticated'')';
begin
  if to_regclass('public.requisition_approvals') is null then
    raise notice 'Skipping missing table public.requisition_approvals';
    return;
  end if;

  grant select, insert, update, delete on table public.requisition_approvals to anon, authenticated;
  alter table public.requisition_approvals enable row level security;

  drop policy if exists requisition_approvals_read on public.requisition_approvals;
  drop policy if exists requisition_approvals_insert on public.requisition_approvals;
  drop policy if exists requisition_approvals_update on public.requisition_approvals;
  drop policy if exists requisition_approvals_delete on public.requisition_approvals;

  create policy requisition_approvals_read
    on public.requisition_approvals
    for select to anon, authenticated
    using (auth.role() = 'anon' or auth.role() = 'authenticated');

  create policy requisition_approvals_insert
    on public.requisition_approvals
    for insert to anon, authenticated
    with check (auth.role() = 'anon' or auth.role() = 'authenticated');

  create policy requisition_approvals_update
    on public.requisition_approvals
    for update to anon, authenticated
    using (auth.role() = 'anon' or auth.role() = 'authenticated')
    with check (auth.role() = 'anon' or auth.role() = 'authenticated');

  create policy requisition_approvals_delete
    on public.requisition_approvals
    for delete to anon, authenticated
    using (auth.role() = 'anon' or auth.role() = 'authenticated');

  raise notice 'Restored policies for public.requisition_approvals';
end $$;
