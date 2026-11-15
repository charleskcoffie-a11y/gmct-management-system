import React, { useEffect, useState } from 'react';
import type { Settings, Society } from '../types';
import { getSupabaseClient, saveSettingsToSupabase, loadSocietiesFromSupabase } from '../services/supabase';
import SocietyPagesSettings from './SocietyPagesSettings';
import { societyPagePreset } from '../services/societyPages';

export default function ManagementSettings({ settings, setSettings, society, societies, onSocietiesChanged, softwareAdmin }: {
    settings: Settings; setSettings: React.Dispatch<React.SetStateAction<Settings>>; society: Society;
    societies: Society[]; onSocietiesChanged: (societies: Society[]) => void; softwareAdmin: boolean;
}) {
    const [form, setForm] = useState(settings);
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const [newSociety, setNewSociety] = useState({ id: '', code: '', name: '', short_name: '', city: '', province: '', province_code: '' });
    useEffect(() => { setForm(settings); }, [society.id]);
    const save = async (event: React.FormEvent) => {
        event.preventDefault(); setBusy(true); setMessage('');
        try {
            await saveSettingsToSupabase(settings.supabaseUrl, settings.supabaseKey, form);
            setSettings(form); setMessage('Society settings saved.');
        } catch (error: any) { setMessage(error.message); }
        finally { setBusy(false); }
    };
    const create = async (event: React.FormEvent) => {
        event.preventDefault(); setBusy(true); setMessage('');
        try {
            const client = getSupabaseClient(settings.supabaseUrl, settings.supabaseKey)!;
            const { error } = await client.from('societies').insert({ ...newSociety, is_primary: false, features: societyPagePreset({}, 'basic'), accent_color: 'indigo' });
            if (error) throw error;
            onSocietiesChanged(await loadSocietiesFromSupabase(settings.supabaseUrl, settings.supabaseKey));
            setNewSociety({ id: '', code: '', name: '', short_name: '', city: '', province: '', province_code: '' });
            setMessage('Society created with empty records. Assign its administrator in Manage Users.');
        } catch (error: any) { setMessage(error.message); }
        finally { setBusy(false); }
    };
    const input = 'mt-1 w-full rounded-lg border border-slate-300 p-2';
    return <section className="mx-auto max-w-5xl space-y-6 py-7">
        <div><h1 className="text-2xl font-bold">Society settings</h1><p className="mt-2 text-slate-600">{society.name}</p></div>
        {softwareAdmin && <SocietyPagesSettings settings={settings} societies={societies} currentSocietyId={society.id} onSocietiesChanged={onSocietiesChanged} />}
        {message && <p role="status" className="rounded-xl bg-indigo-50 p-4">{message}</p>}
        <form onSubmit={save} className="grid gap-4 rounded-2xl border bg-white p-6 md:grid-cols-2">
            <h2 className="text-xl font-bold md:col-span-2">Details for {society.shortName}</h2>
            <label>Organization name<input value={form.orgName || ''} onChange={e => setForm({ ...form, orgName: e.target.value })} className={input} required /></label>
            <label>Currency<input value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} className={input} required /></label>
            <label>Address<input value={form.orgAddress || ''} onChange={e => setForm({ ...form, orgAddress: e.target.value })} className={input} /></label>
            <label>Telephone<input type="tel" value={form.orgPhone || ''} onChange={e => setForm({ ...form, orgPhone: e.target.value })} className={input} /></label>
            <label>Email<input type="email" value={form.orgEmail || ''} onChange={e => setForm({ ...form, orgEmail: e.target.value })} className={input} /></label>
            <label>Charity number<input value={form.charityNumber || ''} onChange={e => setForm({ ...form, charityNumber: e.target.value })} className={input} /></label>
            <label>Number of classes<input type="number" min="1" max="100" value={form.maxClasses} onChange={e => setForm({ ...form, maxClasses: Number(e.target.value) })} className={input} required /></label>
            <label>Logo URL<input type="url" value={form.logoUrl || ''} onChange={e => setForm({ ...form, logoUrl: e.target.value })} className={input} /></label>
            <button disabled={busy} className="rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white disabled:opacity-50 md:col-span-2">{busy ? 'Saving…' : 'Save settings'}</button>
        </form>
        {softwareAdmin && <form onSubmit={create} className="grid gap-4 rounded-2xl border bg-white p-6 md:grid-cols-2">
            <h2 className="text-xl font-bold md:col-span-2">Add a society</h2>
            {Object.keys(newSociety).map(key => <label key={key} className="capitalize">{key.replace(/_/g,' ')}<input value={newSociety[key as keyof typeof newSociety]} onChange={e => setNewSociety({ ...newSociety, [key]: e.target.value })} pattern={key === 'id' ? '[a-z0-9-]+' : undefined} className={input} required /></label>)}
            <button disabled={busy} className="rounded-xl bg-slate-900 px-5 py-3 font-bold text-white disabled:opacity-50 md:col-span-2">Create society</button>
        </form>}
    </section>;
}
