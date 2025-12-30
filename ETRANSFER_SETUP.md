# E-Transfer Notification System Setup Guide

## Overview
The e-transfer system captures Interac e-Transfer notifications via email webhook and displays them in your app with real-time push notifications.

---

## Step 1: Database Setup

### Run SQL Migrations in Supabase

Go to **Supabase Dashboard → SQL Editor** and run this migration:

```sql
-- Create table to store inbound e-transfer notifications
create table if not exists public.etransfers (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  amount numeric(12,2),
  currency text,
  sender_name text,
  sender_email text,
  memo text,
  raw_subject text,
  raw_text text,
  reconciled boolean not null default false,
  created_at timestamptz not null default now()
);

-- Basic RLS (adjust as needed)
alter table public.etransfers enable row level security;
create policy etransfers_read on public.etransfers for select using (true);
create policy etransfers_write on public.etransfers for insert with check (true);
create policy etransfers_update on public.etransfers for update using (true);
```

✅ **Result:** `etransfers` table created and ready to receive webhook data

---

## Step 2: Choose an Email Webhook Provider

Pick ONE of these providers to forward emails:

### Option A: SendGrid (Recommended)
1. Go to https://sendgrid.com and sign up (free tier available)
2. Create an API key: **Settings → API Keys → Create API Key** 
3. Copy the API key - you'll need it for the webhook secret
4. Go to **Mail Settings → Inbound Parse**
5. Add a new inbound parse webhook:
   - **Hostname:** (your email domain, e.g., `inbound.yourdomain.com`)
   - **URL:** `https://your-supabase-project.supabase.co/functions/v1/etransfer-inbound`
   - **POST the raw, full MIME message**

### Option B: Mailgun
1. Go to https://mailgun.com and sign up
2. Create an API key in **Account Settings**
3. Set up a route: **Routing → Routes**
4. Create a forward rule to your webhook URL:
   - **Expression:** `match_recipient("etransfer@yourdomain.com")`
   - **Action:** `forward("https://your-supabase-project.supabase.co/functions/v1/etransfer-inbound")`

### Option C: Resend Inbound
1. Go to https://resend.com
2. Create an inbound webhook in your dashboard
3. Set the endpoint to: `https://your-supabase-project.supabase.co/functions/v1/etransfer-inbound`

---

## Step 3: Configure Supabase Function Secrets

Go to **Supabase Dashboard → Functions → etransfer-inbound → Secrets**

Add these environment variables:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
INBOUND_SECRET=your-webhook-secret-here
```

**How to get these:**
- **SUPABASE_URL & SERVICE_KEY:** Project Settings → API → Copy URL and Service Role Key
- **INBOUND_SECRET:** Create a random secret string (e.g., `SecureRandomString123!`)

---

## Step 4: App Settings Configuration

1. Open the app and go to **Settings**
2. Fill in these fields:

| Field | Value |
|-------|-------|
| **E-Transfer Inbound Secret** | Same as `INBOUND_SECRET` from Step 3 |
| **E-Transfer Notification Email** | The email address that receives e-transfer notifications from your bank |
| **Currency** | CAD (or your currency) |

Save settings.

---

## Step 5: Configure Your Bank Email Forwarding

1. Log into your bank's online portal
2. Look for **e-Transfer Notifications** or **Notifications Settings**
3. Set the notification email to your provider's inbound address:

**For SendGrid:**
- Forward to: `etransfer@yourdomain.com` (or your configured hostname)

**For Mailgun:**
- Forward to: The email address you set up in the route

**For Resend:**
- Forward to: Your Resend inbound address

---

## Step 6: Test the Webhook

### Manual Test:

1. Go to **Supabase Dashboard → Functions → etransfer-inbound**
2. Click **Invoke** and send a test payload:

```json
{
  "subject": "Interac e-Transfer notification - $100.00 CAD received",
  "from": "noreply@bank.com",
  "text": "You have received an Interac e-Transfer for $100.00 CAD from John Smith (john@example.com). Password required: Yes"
}
```

3. Check **Supabase Dashboard → SQL Editor** and run:
```sql
SELECT * FROM etransfers ORDER BY created_at DESC LIMIT 5;
```

✅ You should see your test record

### Live Test:

1. Ask someone to send you a real e-Transfer
2. The notification email should be forwarded to your provider
3. The app should automatically populate the **E-Transfers** page

---

## Step 7: Enable Browser Notifications

**In the App:**

1. Navigate to the **E-Transfers** page
2. Your browser will prompt: "Allow notifications?"
3. Click **Allow**
4. You should see the green "Push notifications active" badge in the header

**If you missed the prompt:**

1. Click the lock icon in your browser's address bar
2. Find **Notifications** → Change to **Allow**
3. Refresh the app

---

## Step 8: Verify Push Notifications Work

When someone sends you an e-Transfer:

1. A desktop notification will appear: `💰 New E-Transfer Received`
2. It will show the sender name and amount
3. The transfer will appear in the table automatically
4. Click **Mark reconciled** when you've processed the payment

---

## Troubleshooting

### "Cloud connected" status but no transfers appearing

**Problem:** Supabase is connected but webhook isn't delivering data

**Fix:**
1. Check your email forwarding rule in the provider (SendGrid/Mailgun)
2. Verify the webhook URL is correct
3. Check the Supabase function logs: **Functions → etransfer-inbound → Logs**
4. Test the function manually (Step 6)

### No push notifications appearing

**Problem:** Notifications enabled but not receiving alerts

**Fix:**
1. Check browser notification permissions: 
   - Chrome: Settings → Privacy → Notifications
   - Firefox: Settings → Privacy → Permissions → Notifications
2. Ensure you clicked **Allow** when prompted
3. Check browser console (F12) for errors
4. Make sure Supabase is connected (`Cloud connected` badge is green)

### Invalid secret or webhook rejected

**Problem:** 403 Forbidden errors in logs

**Fix:**
1. Verify `INBOUND_SECRET` in Supabase matches your provider's secret
2. Check email headers in SendGrid/Mailgun dashboard
3. Ensure `x-inbound-secret` header is being sent by your provider

### Parser not extracting sender name/amount

**Problem:** Table shows empty sender_name or amount

**Fix:**
1. Different banks format emails differently
2. Check `raw_subject` and `raw_text` columns to see what's being received
3. The function tries to parse common patterns but may need adjustment for your bank
4. Contact support with a sample email to improve parsing

---

## Next Steps

✅ **Webhook Setup Complete!**

Now you can:
- Monitor all incoming e-transfers in real-time
- Get desktop notifications when payments arrive
- Track sender info and amounts
- Mark transfers as reconciled
- Export reconciliation records to CSV

**Recommended:** Set up a regular reconciliation schedule to match e-transfer records with your accounting system.

---

## Provider Contact Info

- **SendGrid:** support@sendgrid.com
- **Mailgun:** support@mailgun.com
- **Resend:** support@resend.com
