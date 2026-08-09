-- Restore and normalize RLS for entry_deletions so the audit log insert works for client users.

grant usage on schema public to anon, authenticated;
grant select, insert on table public.entry_deletions to anon, authenticated;

alter table public.entry_deletions enable row level security;

drop policy if exists "Allow anon users to read deletion logs" on public.entry_deletions;
drop policy if exists "Allow anon users to insert deletion logs" on public.entry_deletions;
drop policy if exists "Allow authenticated users to read deletion logs" on public.entry_deletions;
drop policy if exists "Allow authenticated users to insert deletion logs" on public.entry_deletions;

drop policy if exists entry_deletions_read on public.entry_deletions;
drop policy if exists entry_deletions_insert on public.entry_deletions;

create policy entry_deletions_read
    on public.entry_deletions
    for select
    to anon, authenticated
    using (auth.role() = 'anon' or auth.role() = 'authenticated');

create policy entry_deletions_insert
    on public.entry_deletions
    for insert
    to anon, authenticated
    with check (auth.role() = 'anon' or auth.role() = 'authenticated');