import React, { useEffect, useState } from 'react';
import type { Settings, Society } from '../types';
import { getSupabaseClient, loadSocietiesFromSupabase } from '../services/supabase';
import { SOCIETY_PAGE_GROUPS, normalizedSocietyPages, societyPagePreset } from '../services/societyPages';

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
    return <form onSubmit={save} className="space-y-5 rounded-2xl border border-indigo-200 bg-white p-6">
        <div><h2 className="text-xl font-bold">Pages for each society</h2><p className="mt-1 text-sm text-slate-600">Choose the pages this society needs. Each user's role still determines their access.</p></div>
        <label className="block max-w-xl text-sm font-semibold">Society<select value={target?.id || ''} onChange={e => choose(e.target.value)} disabled={busy}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3">{societies.filter(s => s.status !== 'archived').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => { setFeatures(societyPagePreset(features, 'basic')); setDirty(true); setMessage('Basic pages selected. Save to apply.'); }} className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-slate-50">Basic pages</button>
            <button type="button" disabled={busy} onClick={() => { setFeatures(societyPagePreset(features, 'all')); setDirty(true); setMessage('All pages selected. Save to apply.'); }} className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-slate-50">All pages</button>
        </div>
        <div className="grid gap-5 md:grid-cols-2">{SOCIETY_PAGE_GROUPS.map(group => <fieldset key={group.label} className="rounded-xl bg-slate-50 p-4">
            <legend className="px-1 text-sm font-bold text-slate-700">{group.label}</legend>
            <div className="space-y-3">{group.pages.map(page => <label key={page.key} className="flex cursor-pointer items-start gap-3 text-sm">
                <input type="checkbox" checked={features[page.key] === true} disabled={busy} onChange={e => { setFeatures({ ...features, [page.key]: e.target.checked }); setDirty(true); setMessage(''); }} className="mt-0.5 h-4 w-4 accent-indigo-600" />
                <span>{page.label}</span>
            </label>)}</div>
        </fieldset>)}</div>
        <p className="text-xs text-slate-500">Home and administrator controls stay available. Attendance includes its related reports.</p>
        {message && <p role="status" className="rounded-lg bg-indigo-50 p-3 text-sm">{message}</p>}
        <button type="submit" disabled={busy || !dirty || !target} className="rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-500 disabled:opacity-50">{busy ? 'Saving…' : 'Save society pages'}</button>
    </form>;
}
