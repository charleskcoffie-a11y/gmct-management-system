# Class Leader Access Setup Guide

## Overview
Class leaders can now log in with a single shared username and use class-specific passwords to access only their class's attendance.

## Setup Instructions

### 1. Create the Class Leader User (Admin)
1. Log in as Admin
2. Go to **Administration → Manage Users**
3. Click **Add User**
4. Create user:
   - **Username**: `ClassLeader` (or any name you prefer)
   - **Role**: `class-leader`
   - **Password**: (optional - can leave as default or set an admin password)
   - **Assigned Class**: Leave empty (will be set dynamically on login)
5. Click **Save**

### 2. Set Class Access Codes (Admin Only)
1. Go to **Administration → Settings**
2. Scroll to **Class Access Codes** section
3. For each class (1-14), set a unique access code:
   - Class 1: `alpha`
   - Class 2: `beta`
   - Class 3: `gamma`
   - etc.
4. Click **Save Settings**
5. Settings will automatically sync to Supabase

### 3. Run SQL Migration (Database)
Run this SQL in Supabase SQL Editor to create the `app_settings` table:

```sql
-- Create App Settings Table
create table if not exists public.app_settings (
    id text primary key default 'app_settings',
    currency text,
    max_classes int,
    enforce_directory boolean,
    supabase_url text,
    supabase_key text,
    logo_url text,
    org_name text,
    org_address text,
    org_phone text,
    org_email text,
    charity_number text,
    signature_image text,
    annual_levy_amount numeric,
    etransfer_notification_email text,
    etransfer_inbound_secret text,
    etransfer_provider text,
    class_access_codes text, -- JSON string: {"1": "alpha", "2": "beta", ...}
    created_at timestamp with time zone default timezone('utc'::text, now()),
    updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS
alter table public.app_settings enable row level security;
create policy "Enable all access for anon users" on public.app_settings 
  for all using (true) with check (true);
```

## How Class Leaders Log In

### Option 1: Using Class-Specific Access Codes (Recommended)
```
Username: ClassLeader
Password: alpha        → Routes to Class 1
Password: beta         → Routes to Class 2
Password: gamma        → Routes to Class 3
... etc.
```

### Option 2: Using Simple Class Numbers
```
Username: ClassLeader
Password: class1       → Routes to Class 1
Password: class2       → Routes to Class 2
Password: class 7      → Routes to Class 7 (spaces allowed)
... etc.
```

## What Class Leaders See

After login, class leaders:
- ✅ Land directly on **Class Attendance** page
- ✅ See only members from their assigned class
- ✅ Can mark attendance statuses (present, absent, sick, travel)
- ✅ Can save attendance to the database
- ❌ Cannot access Member Directory
- ❌ Cannot access Financial records
- ❌ Cannot access Settings or Admin functions

## Features

### Class Filtering
- Members are automatically filtered by `assignedClass`
- Only active members (`active !== false`) are shown
- Members are sorted alphabetically by name

### Attendance Tracking
- Date selector (defaults to today)
- Status buttons for each member:
  - Present (green)
  - Absent (red)
  - Sick (orange)
  - Travel (blue)
- Stats dashboard showing counts for each status
- Success confirmation after saving

### Database Storage
**Attendance Data**: ✅ Saved to `attendance` table in Supabase
- Unique constraint on `(date, member_id)` prevents duplicates
- Auto-synced every 30 seconds for multi-user updates

**Class Access Codes**: ✅ Saved to `app_settings` table in Supabase
- Synced across all devices automatically
- Updated when admin changes codes in Settings
- Persisted even if localStorage is cleared

## Security Notes

1. **Shared Username**: All class leaders use the same username (`ClassLeader`)
2. **Class Codes**: Each class has a unique access code set by admin
3. **Session Isolation**: Each login session is isolated to one class
4. **No Cross-Class Access**: Leaders cannot see other classes' data
5. **Read-Only Member Data**: Leaders cannot edit member information

## Troubleshooting

### "Class out of range" error
- Ensure the class number is between 1 and 14 (or your max classes setting)
- Check that you typed the number correctly

### "Invalid class access code" error
- Verify the access code matches exactly (case-insensitive)
- Ask admin to check the code in Settings → Class Access Codes

### No members showing
- Ensure members are assigned to the correct class in Member Directory
- Check that members are marked as Active
- Verify Supabase sync is working (green "Connected" badge in header)

### Can't save attendance
- Ensure you're connected to the internet
- Check that Supabase credentials are configured
- Verify the attendance table exists in your database

## Testing Checklist

- [ ] Create ClassLeader user with role `class-leader`
- [ ] Set access codes for classes in Settings
- [ ] Run SQL migration to create app_settings table
- [ ] Test login with `class1` password → Should see Class 1 members
- [ ] Test login with custom code (e.g., `alpha`) → Should see Class 1 members
- [ ] Mark attendance for a few members
- [ ] Click Save → Should see success message
- [ ] Check Supabase attendance table → Should see records
- [ ] Log out and log in as different class → Should see only that class's members
- [ ] Verify Member Directory is not accessible for class leaders
