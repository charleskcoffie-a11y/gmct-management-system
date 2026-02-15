import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppWithToasts } from './App';

const resetInvalidSettings = () => {
  if (typeof window === 'undefined') return;
  const raw = window.localStorage.getItem('gmct-settings');
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    const url = typeof parsed?.supabaseUrl === 'string' ? parsed.supabaseUrl.trim() : '';
    if (!url || !/^https?:\/\//i.test(url)) {
      window.localStorage.removeItem('gmct-settings');
    }
  } catch {
    window.localStorage.removeItem('gmct-settings');
  }
};

const resetOnSupabaseError = () => {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (event) => {
    const message = String(event?.message || '');
    if (!message.includes('supabaseUrl is required')) return;
    if (window.sessionStorage.getItem('gmct-reset-supabase')) return;
    window.sessionStorage.setItem('gmct-reset-supabase', '1');
    try {
      window.localStorage.removeItem('gmct-settings');
    } catch {}
    window.location.reload();
  });
};

resetInvalidSettings();
resetOnSupabaseError();

const resetWhenSupabaseMissing = () => {
  if (typeof window === 'undefined') return;
  const root = document.getElementById('root');
  if (!root) return;
  const raw = window.localStorage.getItem('gmct-settings');
  let hasValidUrl = false;
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    const url = typeof parsed?.supabaseUrl === 'string' ? parsed.supabaseUrl.trim() : '';
    hasValidUrl = !!url && /^https?:\/\//i.test(url);
  } catch {
    hasValidUrl = false;
  }

  if (hasValidUrl) return;

  root.innerHTML = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px; color: #0f172a;">
      <h2 style="margin: 0 0 8px; font-size: 20px;">Loading blocked by missing Supabase settings</h2>
      <p style="margin: 0 0 12px;">We reset invalid settings. Please refresh the page.</p>
      <button id="gmct-reload" style="padding: 8px 14px; border: 1px solid #1e293b; background: #ffffff; border-radius: 6px; cursor: pointer;">Reload</button>
    </div>
  `;
  const btn = document.getElementById('gmct-reload');
  if (btn) {
    btn.addEventListener('click', () => window.location.reload());
  }
};

resetWhenSupabaseMissing();

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
