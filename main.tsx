import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppWithToasts } from './App';
import { SUPABASE_KEY, SUPABASE_URL } from './constants';

const isValidUrl = (value: string) => !!value && /^https?:\/\//i.test(value.trim());

const ensureSupabaseDefaults = () => {
  if (typeof window === 'undefined') return;
  const raw = window.localStorage.getItem('gmct-settings');
  let parsed: any = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = {};
  }

  const url = typeof parsed?.supabaseUrl === 'string' ? parsed.supabaseUrl.trim() : '';
  const key = typeof parsed?.supabaseKey === 'string' ? parsed.supabaseKey.trim() : '';
  const next = { ...parsed };
  let changed = false;

  if (!isValidUrl(url) && SUPABASE_URL) {
    next.supabaseUrl = SUPABASE_URL;
    changed = true;
  }
  if (!key && SUPABASE_KEY) {
    next.supabaseKey = SUPABASE_KEY;
    changed = true;
  }

  if (changed) {
    window.localStorage.setItem('gmct-settings', JSON.stringify(next));
  }
};

const resetOnSupabaseError = () => {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (event) => {
    const message = String(event?.message || '');
    if (!message.includes('supabaseUrl is required')) return;
    if (window.sessionStorage.getItem('gmct-reset-supabase')) return;
    window.sessionStorage.setItem('gmct-reset-supabase', '1');
    ensureSupabaseDefaults();
    window.location.reload();
  });
};

ensureSupabaseDefaults();
resetOnSupabaseError();

const unregisterServiceWorkers = async () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(reg => reg.unregister()));
  } catch {}
};

const clearServiceWorkerCaches = async () => {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map(key => caches.delete(key)));
  } catch {}
};

unregisterServiceWorkers();
clearServiceWorkerCaches();

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <AppWithToasts />
  </React.StrictMode>
);
