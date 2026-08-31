-- ============================================================================
-- SAFETY BACKUP SCRIPT FOR SUPABASE
-- Date: 2026-08-30
-- Description: Creates full duplicate backup tables of all existing data
--              BEFORE applying any multi-tenancy changes.
-- ============================================================================

-- 1. Backup entries table (exact snapshot of all columns and rows)
create table if not exists public.entries_backup_20260830 as 
select * from public.entries;

-- 2. Backup members table
create table if not exists public.members_backup_20260830 as 
select * from public.members;

-- 3. Backup app_users table
create table if not exists public.app_users_backup_20260830 as 
select * from public.app_users;

-- 4. Backup harvest pledges & payments
create table if not exists public.harvest_pledges_backup_20260830 as 
select * from public.harvest_pledges;

-- 5. Backup weekly history
create table if not exists public.weekly_history_backup_20260830 as 
select * from public.weekly_history;

-- 6. Backup requisitions
create table if not exists public.requisitions_backup_20260830 as 
select * from public.requisitions;

-- 7. Backup attendance
create table if not exists public.attendance_backup_20260830 as 
select * from public.attendance;

-- Verify backup row counts
select 
    'entries_backup' as table_name, count(*) as total_rows from public.entries_backup_20260830
union all
select 
    'members_backup' as table_name, count(*) as total_rows from public.members_backup_20260830
union all
select 
    'app_users_backup' as table_name, count(*) as total_rows from public.app_users_backup_20260830;
