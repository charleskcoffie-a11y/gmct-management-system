-- Fix Supabase Security Advisor: Security Definer View
-- Make the view execute with caller privileges (respects caller RLS/permissions).

alter view if exists public.v_organization_funds_balances
  set (security_invoker = true);

alter view if exists public.v_requisitions_pending
  set (security_invoker = true);
