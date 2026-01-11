# Entry Deletions Audit Log Setup

This document explains how to set up the deletion audit log table in Supabase.

## Overview

The `entry_deletions` table provides a complete audit trail of all deleted entries, including:
- Who deleted the entry
- When it was deleted
- Why it was deleted (required reason)
- Complete snapshot of the original entry data

## Setup Instructions

### 1. Run the SQL Migration

Execute the SQL script in your Supabase SQL Editor:

```bash
sql/2026-01-11_create_entry_deletions_table.sql
```

Or copy and paste the SQL directly into the Supabase SQL Editor and run it.

### 2. Verify Table Creation

After running the SQL, verify the table was created:

```sql
SELECT * FROM entry_deletions LIMIT 1;
```

### 3. Check Policies

Verify Row Level Security policies are enabled:

```sql
SELECT * FROM pg_policies WHERE tablename = 'entry_deletions';
```

You should see two policies:
- `Allow authenticated users to read deletion logs`
- `Allow authenticated users to insert deletion logs`

## Table Structure

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `entry_id` | UUID | ID of the deleted entry |
| `entry_type` | TEXT | Type of entry (tithe, offering, etc.) |
| `member_id` | UUID | ID of the member (if applicable) |
| `member_name` | TEXT | Name of the member (snapshot) |
| `amount` | DECIMAL | Amount of the entry |
| `original_date` | DATE | Original date of the entry |
| `deletion_reason` | TEXT | Required reason for deletion (min 3 chars) |
| `deleted_by` | TEXT | Username of person who deleted |
| `deleted_at` | TIMESTAMPTZ | Timestamp of deletion |
| `original_entry_data` | JSONB | Complete entry object as JSON |

## How It Works

### When Deleting an Entry

1. User clicks delete button (admin only)
2. Confirmation modal appears requesting a reason
3. Upon confirmation:
   - Entry data is logged to `entry_deletions` table
   - Entry is marked as deleted in `entries` table (soft delete)
   - Success message is shown
   - Modal/card closes automatically

### Querying Deletion Logs

**View all deletions:**
```sql
SELECT * FROM entry_deletions ORDER BY deleted_at DESC;
```

**View deletions by a specific user:**
```sql
SELECT * FROM entry_deletions 
WHERE deleted_by = 'username' 
ORDER BY deleted_at DESC;
```

**View deletions for a specific date range:**
```sql
SELECT * FROM entry_deletions 
WHERE deleted_at >= '2026-01-01' 
  AND deleted_at < '2026-02-01'
ORDER BY deleted_at DESC;
```

**View deletions for a specific member:**
```sql
SELECT * FROM entry_deletions 
WHERE member_id = 'uuid-here'
ORDER BY deleted_at DESC;
```

**Extract original entry data:**
```sql
SELECT 
  deleted_at,
  deleted_by,
  deletion_reason,
  original_entry_data->>'memberName' as member_name,
  original_entry_data->>'amount' as amount,
  original_entry_data->>'type' as entry_type
FROM entry_deletions
ORDER BY deleted_at DESC;
```

## Security

- Only authenticated users can read/write to this table
- Deletion reason must be at least 3 characters
- Original entry data is preserved as immutable JSON
- All deletions are timestamped with server time

## Maintenance

This table will grow over time. Consider:
- Periodic archiving of old deletion logs (older than 2 years)
- Regular backups
- Monitoring table size

## Notes

- Deletions are "soft deletes" - entries are marked as deleted but not removed
- The `entry_deletions` table provides a permanent audit trail
- All deletion operations are atomic (all or nothing)
- Failed deletions do not create log entries
