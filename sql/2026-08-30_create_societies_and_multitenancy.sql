-- ============================================================================
-- Migration: Create Societies Table and Multi-Tenancy Structure for Canada Mission
-- Date: 2026-08-30
-- Description: Sets up multi-society support for Canada Mission with GMCT as primary.
-- ============================================================================

-- 1. Create the societies table
create table if not exists public.societies (
    id text primary key, -- e.g. 'gmct', 'ebenezer-hamilton'
    code text unique not null,
    name text not null,
    short_name text not null,
    city text not null,
    province text not null,
    province_code text not null,
    is_primary boolean not null default false,
    address text,
    phone text,
    email text,
    features jsonb not null default '{}'::jsonb,
    accent_color text default 'indigo',
    created_at timestamptz not null default now()
);

-- 2. Seed all 13 Canada Mission Societies
insert into public.societies (id, code, name, short_name, city, province, province_code, is_primary, address, features, accent_color)
values
    (
        'gmct',
        'GMCT',
        'Ghana Methodist Church Toronto',
        'GMCT',
        'Toronto',
        'Ontario',
        'ON',
        true,
        '69 Milvan Drive, North York, ON M9L 1Y8',
        '{"wesleyHall": true, "parking": true, "etransfers": true, "requisitions": true, "harvest": true, "harvestPledges": true, "developmentFund": true, "taxReceipts": true, "assets": true, "organizationFunds": true, "dayBorn": true, "childrensMinistry": true}'::jsonb,
        'indigo'
    ),
    (
        'ebenezer-hamilton',
        'EBEN-HAM',
        'Ebenezer Methodist Society',
        'Ebenezer',
        'Hamilton',
        'Ontario',
        'ON',
        false,
        'Hamilton, ON',
        '{"wesleyHall": false, "parking": false, "etransfers": true, "requisitions": true, "harvest": true, "harvestPledges": true, "developmentFund": true, "taxReceipts": true, "assets": true, "organizationFunds": true, "dayBorn": true, "childrensMinistry": true}'::jsonb,
        'blue'
    ),
    (
        'redemption-etobicoke',
        'RED-ETOB',
        'Redemption Methodist Society',
        'Redemption',
        'Etobicoke',
        'Ontario',
        'ON',
        false,
        'Etobicoke, ON',
        '{"wesleyHall": false, "parking": false, "etransfers": true, "requisitions": true, "harvest": true, "harvestPledges": true, "developmentFund": true, "taxReceipts": true, "assets": true, "organizationFunds": true, "dayBorn": true, "childrensMinistry": true}'::jsonb,
        'amber'
    ),
    (
        'bethany-brampton',
        'BETH-BRAM',
        'Bethany Methodist Society',
        'Bethany',
        'Brampton',
        'Ontario',
        'ON',
        false,
        'Brampton, ON',
        '{"wesleyHall": false, "parking": false, "etransfers": true, "requisitions": true, "harvest": true, "harvestPledges": true, "developmentFund": true, "taxReceipts": true, "assets": true, "organizationFunds": true, "dayBorn": true, "childrensMinistry": true}'::jsonb,
        'purple'
    ),
    (
        'mt-zion-london',
        'MTZ-LON',
        'Mt. Zion Methodist Society',
        'Mt. Zion',
        'London',
        'Ontario',
        'ON',
        false,
        'London, ON',
        '{"wesleyHall": false, "parking": false, "etransfers": true, "requisitions": true, "harvest": true, "harvestPledges": true, "developmentFund": true, "taxReceipts": true, "assets": true, "organizationFunds": true, "dayBorn": true, "childrensMinistry": true}'::jsonb,
        'teal'
    ),
    (
        'wesley-thunderbay',
        'WES-TBAY',
        'Wesley Methodist Society',
        'Wesley (Thunder Bay)',
        'Thunder Bay',
        'Ontario',
        'ON',
        false,
        'Thunder Bay, ON',
        '{"wesleyHall": false, "parking": false, "etransfers": true, "requisitions": true, "harvest": true, "harvestPledges": true, "developmentFund": true, "taxReceipts": true, "assets": true, "organizationFunds": true, "dayBorn": true, "childrensMinistry": true}'::jsonb,
        'sky'
    ),
    (
        'bethel-calgary',
        'BETH-CAL',
        'Bethel Methodist Society',
        'Bethel (Calgary)',
        'Calgary',
        'Alberta',
        'AB',
        false,
        'Calgary, AB',
        '{"wesleyHall": false, "parking": false, "etransfers": true, "requisitions": true, "harvest": true, "harvestPledges": true, "developmentFund": true, "taxReceipts": true, "assets": true, "organizationFunds": true, "dayBorn": true, "childrensMinistry": true}'::jsonb,
        'rose'
    ),
    (
        'wesley-edmonton',
        'WES-EDM',
        'Wesley Methodist Society',
        'Wesley (Edmonton)',
        'Edmonton',
        'Alberta',
        'AB',
        false,
        'Edmonton, AB',
        '{"wesleyHall": false, "parking": false, "etransfers": true, "requisitions": true, "harvest": true, "harvestPledges": true, "developmentFund": true, "taxReceipts": true, "assets": true, "organizationFunds": true, "dayBorn": true, "childrensMinistry": true}'::jsonb,
        'emerald'
    ),
    (
        'peniel-vancouver',
        'PEN-VAN',
        'Peniel Methodist Society',
        'Peniel',
        'Vancouver',
        'British Columbia',
        'BC',
        false,
        'Vancouver, BC',
        '{"wesleyHall": false, "parking": false, "etransfers": true, "requisitions": true, "harvest": true, "harvestPledges": true, "developmentFund": true, "taxReceipts": true, "assets": true, "organizationFunds": true, "dayBorn": true, "childrensMinistry": true}'::jsonb,
        'cyan'
    ),
    (
        'zion-vancouver',
        'ZION-VAN',
        'Zion Methodist Society',
        'Zion',
        'Vancouver',
        'British Columbia',
        'BC',
        false,
        'Vancouver, BC',
        '{"wesleyHall": false, "parking": false, "etransfers": true, "requisitions": true, "harvest": true, "harvestPledges": true, "developmentFund": true, "taxReceipts": true, "assets": true, "organizationFunds": true, "dayBorn": true, "childrensMinistry": true}'::jsonb,
        'violet'
    ),
    (
        'bethel-winnipeg',
        'BETH-WPG',
        'Bethel Methodist Society',
        'Bethel (Winnipeg)',
        'Winnipeg',
        'Manitoba',
        'MB',
        false,
        'Winnipeg, MB',
        '{"wesleyHall": false, "parking": false, "etransfers": true, "requisitions": true, "harvest": true, "harvestPledges": true, "developmentFund": true, "taxReceipts": true, "assets": true, "organizationFunds": true, "dayBorn": true, "childrensMinistry": true}'::jsonb,
        'fuchsia'
    ),
    (
        'halifax-ns',
        'HAL-NS',
        'Halifax Methodist Society',
        'Halifax',
        'Halifax',
        'Nova Scotia',
        'NS',
        false,
        'Halifax, NS',
        '{"wesleyHall": false, "parking": false, "etransfers": true, "requisitions": true, "harvest": true, "harvestPledges": true, "developmentFund": true, "taxReceipts": true, "assets": true, "organizationFunds": true, "dayBorn": true, "childrensMinistry": true}'::jsonb,
        'orange'
    ),
    (
        'stjohns-newfoundland',
        'STJ-NL',
        'St. John''s Methodist Society',
        'St. John''s',
        'St. John''s',
        'Newfoundland and Labrador',
        'NL',
        false,
        'St. John''s, NL',
        '{"wesleyHall": false, "parking": false, "etransfers": true, "requisitions": true, "harvest": true, "harvestPledges": true, "developmentFund": true, "taxReceipts": true, "assets": true, "organizationFunds": true, "dayBorn": true, "childrensMinistry": true}'::jsonb,
        'rose'
    )
on conflict (id) do update set
    name = excluded.name,
    code = excluded.code,
    short_name = excluded.short_name,
    city = excluded.city,
    province = excluded.province,
    province_code = excluded.province_code,
    is_primary = excluded.is_primary,
    features = excluded.features;

-- 3. Enable RLS on societies
alter table public.societies enable row level security;

drop policy if exists societies_select_all on public.societies;
create policy societies_select_all on public.societies
for select using (true);

drop policy if exists societies_insert_admin on public.societies;
create policy societies_insert_admin on public.societies
for insert with check (true);

drop policy if exists societies_update_admin on public.societies;
create policy societies_update_admin on public.societies
for update using (true) with check (true);

-- 4. Add society_id to core operational tables (defaulting to 'gmct' for existing data)
do $$
begin
    -- members
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'members') then
        alter table public.members add column if not exists society_id text references public.societies(id) default 'gmct';
        update public.members set society_id = 'gmct' where society_id is null;
        create index if not exists idx_members_society_id on public.members(society_id);
    end if;

    -- entries
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'entries') then
        alter table public.entries add column if not exists society_id text references public.societies(id) default 'gmct';
        update public.entries set society_id = 'gmct' where society_id is null;
        create index if not exists idx_entries_society_id on public.entries(society_id);
    end if;

    -- harvest_pledges
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'harvest_pledges') then
        alter table public.harvest_pledges add column if not exists society_id text references public.societies(id) default 'gmct';
        update public.harvest_pledges set society_id = 'gmct' where society_id is null;
        create index if not exists idx_harvest_pledges_society_id on public.harvest_pledges(society_id);
    end if;

    -- requisitions
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'requisitions') then
        alter table public.requisitions add column if not exists society_id text references public.societies(id) default 'gmct';
        update public.requisitions set society_id = 'gmct' where society_id is null;
        create index if not exists idx_requisitions_society_id on public.requisitions(society_id);
    end if;

    -- weekly_history
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'weekly_history') then
        alter table public.weekly_history add column if not exists society_id text references public.societies(id) default 'gmct';
        update public.weekly_history set society_id = 'gmct' where society_id is null;
        create index if not exists idx_weekly_history_society_id on public.weekly_history(society_id);
    end if;

    -- app_users
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'app_users') then
        alter table public.app_users add column if not exists society_id text references public.societies(id) default 'gmct';
        update public.app_users set society_id = 'gmct' where society_id is null;
        create index if not exists idx_app_users_society_id on public.app_users(society_id);
    end if;
end $$;
