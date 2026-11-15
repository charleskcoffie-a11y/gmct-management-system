import React, { useEffect, useState } from 'react';
import type { Settings, Society } from '../types';
import { getSupabaseClient, loadSocietiesFromSupabase } from '../services/supabase';
import { SOCIETY_PAGE_GROUPS, normalizedSocietyPages, societyPagePreset } from '../services/societyPages';
import SettingsSymbol from './SettingsSymbol';

export default function SocietyPagesSettings({ settings, societies, currentSocietyId, onSocietiesChanged }: {
    settings: Settings; societies: Society[]; currentSocietyId: string; onSocietiesChanged: (societies: Society[]) => void;
}) {
    const [targetId, setTargetId] = useState(currentSocietyId);
    const target = societies.find(s => s.id === targetId) || societies[0];
    const [features, setFeatures] = useState(() => normalizedSocietyPages(target?.features || {}, !!target?.isPrimary));
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const savedFeatures = JSON.stringify(target?.features || {});
    useEffect(() => {
        if (!dirty) setFeatures(normalizedSocietyPages(target?.features || {}, !!target?.isPrimary));
    }, [target?.id, savedFeatures, dirty]);

    const choose = (id: string) => {
        const society = societies.find(s => s.id === id);
        setTargetId(id); setFeatures(normalizedSocietyPages(society?.features || {}, !!society?.isPrimary));
        setDirty(false); setMessage('');
    };
    const save = async (event: React.FormEvent) => {
        event.preventDefault(); if (!target) return;
        setBusy(true); setMessage('');
        try {
            const client = getSupabaseClient(settings.supabaseUrl, settings.supabaseKey);
            if (!client) throw new Error('Database connection unavailable.');
            const { data, error } = await client.from('societies').update({ features, updated_at: new Date().toISOString() })
                .eq('id', target.id).select('id,features').single();
            if (error) throw error;
            if (!data) throw new Error('The society pages could not be saved.');
            const refreshed = await loadSocietiesFromSupabase(settings.supabaseUrl, settings.supabaseKey);
            onSocietiesChanged(refreshed.length ? refreshed : societies.map(s => s.id === data.id ? { ...s, features: data.features } : s)); setDirty(false);
            setMessage(`Pages saved for ${target.name}.`);
        } catch (error: any) { setMessage(error.message); }
        finally { setBusy(false); }
    };
    const enabledPages = SOCIETY_PAGE_GROUPS.reduce((count, group) => count + group.pages.filter(page => features[page.key] === true).length, 0);
    const groupStyles = {
        Finance: { icon: 'finance' as const, color: 'bg-indigo-50 text-indigo-600' },
        Members: { icon: 'members' as const, color: 'bg-emerald-50 text-emerald-600' },
        Reports: { icon: 'reports' as const, color: 'bg-sky-50 text-sky-600' },
        Property: { icon: 'property' as const, color: 'bg-amber-50 text-amber-600' },
    };
    return <form onSubmit={save} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-4"><span className="rounded-2xl bg-indigo-50 p-3 text-indigo-600"><SettingsSymbol name="pages" /></span><div><h2 className="text-xl font-bold text-slate-900">Pages for each society</h2><p className="mt-1 text-sm leading-relaxed text-slate-500">Give each society the tools it needs.</p></div></div>
                <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">{enabledPages} pages enabled</span>
            </div>
            <div className="mt-7 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">Configure pages for<select value={target?.id || ''} onChange={e => choose(e.target.value)} disabled={busy}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold tracking-normal text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10">{societies.filter(s => s.status !== 'archived').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">Start with a preset, then adjust any page.</p>
                    <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => { setFeatures(societyPagePreset(features, 'basic')); setDirty(true); setMessage('Basic pages selected. Save to apply.'); }} className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-50">Basic pages</button>
                    <button type="button" disabled={busy} onClick={() => { setFeatures(societyPagePreset(features, 'all')); setDirty(true); setMessage('All pages selected. Save to apply.'); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50">All pages</button></div>
                </div>
            </div>
            <div className="mt-7 grid gap-6 lg:grid-cols-2">{SOCIETY_PAGE_GROUPS.map(group => <fieldset key={group.label} className={group.label === 'Finance' ? 'lg:col-span-2' : ''}>
                <legend className="mb-3 flex items-center gap-2.5"><span className={`rounded-lg p-2 ${groupStyles[group.label].color}`}><SettingsSymbol name={groupStyles[group.label].icon} small /></span><span className="text-sm font-bold text-slate-800">{group.label}</span></legend>
                <div className={`grid gap-2.5 ${group.label === 'Finance' ? 'sm:grid-cols-2' : ''}`}>{group.pages.map(page => <label key={page.key} className={`flex cursor-pointer items-center justify-between gap-4 rounded-xl border px-4 py-3.5 transition ${features[page.key] === true ? 'border-indigo-100 bg-indigo-50/40 hover:bg-indigo-50' : 'border-slate-200/80 bg-white hover:bg-slate-50'}`}>
                    <span className="text-sm font-medium leading-snug text-slate-700">{page.label}</span>
                    <span className="relative inline-flex shrink-0"><input type="checkbox" role="switch" checked={features[page.key] === true} disabled={busy} onChange={e => { setFeatures({ ...features, [page.key]: e.target.checked }); setDirty(true); setMessage(''); }} className="peer sr-only" />
                    <span className="h-6 w-11 rounded-full bg-slate-200 transition peer-checked:bg-indigo-600 peer-focus-visible:ring-4 peer-focus-visible:ring-indigo-200 peer-disabled:opacity-50" /><span className="pointer-events-none absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" /></span>
                </label>)}</div>
            </fieldset>)}</div>
            <p className="mt-6 text-xs leading-relaxed text-slate-400">Home and administrator controls stay available. Each user's role determines access to the enabled pages.</p>
            {message && <p role="status" className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">{message}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:px-8"><p className={`text-xs ${dirty ? 'font-semibold text-amber-700' : 'text-slate-400'}`}>{dirty ? 'You have unsaved page changes.' : 'Select a society and adjust its pages.'}</p><button type="submit" disabled={busy || !dirty || !target} className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40">{busy ? 'Saving…' : 'Save society pages'}</button></div>
    </form>;
}
