import React, { useEffect, useState } from 'react';
import type { Settings, Society } from '../types';
import { getSupabaseClient, saveSettingsToSupabase, loadSocietiesFromSupabase } from '../services/supabase';
import SocietyPagesSettings from './SocietyPagesSettings';
import { societyPagePreset } from '../services/societyPages';
import SettingsSymbol from './SettingsSymbol';

export default function ManagementSettings({ settings, setSettings, society, societies, onSocietiesChanged, softwareAdmin }: {
    settings: Settings; setSettings: React.Dispatch<React.SetStateAction<Settings>>; society: Society;
    societies: Society[]; onSocietiesChanged: (societies: Society[]) => void; softwareAdmin: boolean;
}) {
    const [form, setForm] = useState(settings);
    const [panel, setPanel] = useState<'details' | 'pages' | 'receipts' | 'new'>('details');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const [newSociety, setNewSociety] = useState({ id: '', code: '', name: '', short_name: '', city: '', province: '', province_code: '' });
    useEffect(() => { setForm(settings); }, [society.id]);
    const save = async (event: React.FormEvent) => {
        event.preventDefault(); setBusy(true); setMessage('');
        try {
            if (panel === 'receipts') {
                const client = getSupabaseClient(settings.supabaseUrl, settings.supabaseKey);
                if (!client) throw new Error('Database connection unavailable.');
                const enabled = form.officialTaxReceiptsEnabled === true;
                const { error } = await client.from('app_settings').update({ official_tax_receipts_enabled: enabled })
                    .eq('society_id', society.id).eq('id', 'app_settings').select('id').single();
                if (error) throw error;
                setSettings(previous => ({ ...previous, officialTaxReceiptsEnabled: enabled }));
                setMessage(enabled ? `Official tax receipts enabled for ${society.shortName}.` : `Future receipts for ${society.shortName} will be generated as drafts.`);
            } else {
                const { officialTaxReceiptsEnabled: _approval, ...details } = form;
                await saveSettingsToSupabase(settings.supabaseUrl, settings.supabaseKey, details);
                setSettings(previous => ({ ...details, officialTaxReceiptsEnabled: previous.officialTaxReceiptsEnabled }));
                setMessage('Church details saved.');
            }
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
    const input = 'mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-60';
    const label = 'block text-xs font-bold tracking-wide text-slate-600';
    const sections = [
        { id: 'details' as const, label: 'Church details', icon: 'church' as const },
        ...(softwareAdmin ? [{ id: 'pages' as const, label: 'Society pages', icon: 'pages' as const }] : []),
        { id: 'receipts' as const, label: 'Tax receipts', icon: 'receipt' as const },
        ...(softwareAdmin ? [{ id: 'new' as const, label: 'Add society', icon: 'plus' as const }] : []),
    ];
    const officialEnabled = settings.officialTaxReceiptsEnabled === true;
    return <section className="mx-auto max-w-5xl space-y-6 py-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 px-6 py-7 text-white shadow-xl shadow-slate-900/10 sm:px-8">
            <div aria-hidden="true" className="absolute -right-16 -top-24 h-72 w-72 rounded-full border-[35px] border-white/[0.035]" />
            <div className="relative flex flex-wrap items-start justify-between gap-5">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-300">Canada Mission · Administration</p>
                    <h1 className="mt-3 text-3xl font-bold tracking-tight">Society settings</h1>
                    <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-300">Your church details, the pages you need, and control over tax receipts.</p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-indigo-200">{softwareAdmin ? 'Mission administrator' : 'Society administrator'}</span>
            </div>
            <div className="relative mt-6 flex items-center gap-3 border-t border-white/10 pt-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-400/15 text-indigo-200"><SettingsSymbol name="church" /></span>
                <div><p className="text-sm font-semibold">{society.name}</p><p className="mt-1 text-xs text-slate-400">{[society.city, society.province].filter(Boolean).join(', ')}</p></div>
            </div>
        </div>
        <div role="group" aria-label="Settings sections" className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-200/70 bg-slate-100/80 p-1.5">
            {sections.map(item => <button key={item.id} type="button" aria-pressed={panel === item.id} disabled={busy} onClick={() => setPanel(item.id)}
                className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${panel === item.id ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/60' : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'}`}><SettingsSymbol name={item.icon} small />{item.label}</button>)}
        </div>
        {message && <p role="status" className="rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4 text-sm font-medium text-indigo-900">{message}</p>}
        {softwareAdmin && <div hidden={panel !== 'pages'}><SocietyPagesSettings settings={settings} societies={societies} currentSocietyId={society.id} onSocietiesChanged={onSocietiesChanged} /></div>}
        <form onSubmit={save} hidden={panel !== 'details' && panel !== 'receipts'} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <fieldset hidden={panel !== 'details'} disabled={busy || panel !== 'details'} className="p-6 sm:p-8">
                <div className="mb-7 flex items-start gap-4"><span className="rounded-2xl bg-indigo-50 p-3 text-indigo-600"><SettingsSymbol name="church" /></span><div><h2 className="text-xl font-bold text-slate-900">Church details</h2><p className="mt-1 text-sm text-slate-500">Contact information and identity for {society.shortName}.</p></div></div>
                <div className="grid gap-5 sm:grid-cols-2">
                    <label className={label}>Organization name<input value={form.orgName || ''} onChange={e => setForm({ ...form, orgName: e.target.value })} className={input} required /></label>
                    <label className={label}>Charity registration number<input value={form.charityNumber || ''} onChange={e => setForm({ ...form, charityNumber: e.target.value })} className={input} /></label>
                    <label className={`${label} sm:col-span-2`}>Church address<input value={form.orgAddress || ''} onChange={e => setForm({ ...form, orgAddress: e.target.value })} className={input} /></label>
                    <label className={label}>Telephone<input type="tel" value={form.orgPhone || ''} onChange={e => setForm({ ...form, orgPhone: e.target.value })} className={input} /></label>
                    <label className={label}>Email address<input type="email" value={form.orgEmail || ''} onChange={e => setForm({ ...form, orgEmail: e.target.value })} className={input} /></label>
                </div>
                <div className="my-7 border-t border-dashed border-slate-200" />
                <h3 className="mb-4 text-sm font-bold text-slate-900">Preferences & branding</h3>
                <div className="grid gap-5 sm:grid-cols-2">
                    <label className={label}>Currency<input value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} className={input} required /></label>
                    <label className={label}>Number of classes<input type="number" min="1" max="100" value={form.maxClasses} onChange={e => setForm({ ...form, maxClasses: Number(e.target.value) })} className={input} required /></label>
                    <label className={`${label} sm:col-span-2`}>Logo URL<input type="url" value={form.logoUrl || ''} onChange={e => setForm({ ...form, logoUrl: e.target.value })} className={input} /><span className="mt-2 block text-xs font-normal tracking-normal text-slate-400">Use the web address of your society's logo.</span></label>
                </div>
            </fieldset>
            <fieldset hidden={panel !== 'receipts'} disabled={busy || panel !== 'receipts'} className="p-6 sm:p-8">
                <div className="mb-7 flex items-start gap-4"><span className="rounded-2xl bg-amber-50 p-3 text-amber-600"><SettingsSymbol name="receipt" /></span><div><h2 className="text-xl font-bold text-slate-900">Tax receipt approval</h2><p className="mt-1 text-sm text-slate-500">Review first. Issue when your society is ready.</p></div></div>
                <div className={`mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5 ${officialEnabled ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                    <div><p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Current mode · {society.shortName}</p><p className={`mt-2 text-lg font-bold ${officialEnabled ? 'text-emerald-800' : 'text-amber-900'}`}>{officialEnabled ? 'Official receipts enabled' : 'Draft receipts only'}</p><p className="mt-1 max-w-lg text-sm leading-relaxed text-slate-600">{officialEnabled ? 'Receipts with a donor mailing address can be generated as official receipts.' : 'Downloads are marked DRAFT and cannot be used for tax purposes.'}</p></div>
                    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${officialEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}><SettingsSymbol name="receipt" /></span>
                </div>
                <label className="flex cursor-pointer items-center justify-between gap-5 rounded-2xl border border-slate-200 p-5 transition hover:border-indigo-300 hover:bg-indigo-50/30">
                    <span><span className="block text-sm font-bold text-slate-900">Enable official tax receipts for {society.shortName}</span><span className="mt-1.5 block max-w-md text-sm leading-relaxed text-slate-500">Turn on after reviewing the receipt details and signing authority. Save settings to apply.</span></span>
                    <span className="relative inline-flex shrink-0"><input type="checkbox" role="switch" checked={form.officialTaxReceiptsEnabled === true} onChange={e => setForm({ ...form, officialTaxReceiptsEnabled: e.target.checked })} className="peer sr-only" /><span className="h-7 w-12 rounded-full bg-slate-200 transition peer-checked:bg-indigo-600 peer-focus-visible:ring-4 peer-focus-visible:ring-indigo-200" /><span className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" /></span>
                </label>
                <p className="mt-5 rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-500">Turning this off returns future receipts to draft mode. Previously downloaded PDFs stay unchanged. Signing details are managed under Tax Receipts → Receipt Details.</p>
            </fieldset>
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:px-8"><p className="text-xs text-slate-400">Changes apply to {society.shortName}.</p><button disabled={busy} className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-500 disabled:opacity-50">{busy ? 'Saving…' : 'Save settings'}</button></div>
        </form>
        {softwareAdmin && <form onSubmit={create} hidden={panel !== 'new'} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <fieldset disabled={busy} className="p-6 sm:p-8">
                <div className="mb-7 flex items-start gap-4"><span className="rounded-2xl bg-emerald-50 p-3 text-emerald-600"><SettingsSymbol name="plus" /></span><div><h2 className="text-xl font-bold text-slate-900">Welcome a new society</h2><p className="mt-1 text-sm text-slate-500">Start with basic pages and a fresh set of records.</p></div></div>
                <div className="grid gap-5 sm:grid-cols-2">{[
                    ['name', 'Full society name', 'e.g. Ebenezer Methodist Society'], ['short_name', 'Short name', 'e.g. Ebenezer'],
                    ['id', 'Society link name', 'e.g. ebenezer-hamilton'], ['code', 'Society code', 'e.g. EBEN-HAM'],
                    ['city', 'City', 'e.g. Hamilton'], ['province', 'Province', 'e.g. Ontario'], ['province_code', 'Province code', 'e.g. ON'],
                ].map(([key, title, placeholder]) => <label key={key} className={label}>{title}<input value={newSociety[key as keyof typeof newSociety]} onChange={e => setNewSociety({ ...newSociety, [key]: e.target.value })} pattern={key === 'id' ? '[a-z0-9-]+' : undefined} placeholder={placeholder} className={input} required /></label>)}</div>
            </fieldset>
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:px-8"><p className="max-w-xs text-xs leading-relaxed text-slate-400">After creating the society, assign its administrator in Manage Users.</p><button disabled={busy} className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-50">{busy ? 'Creating…' : 'Create society'}</button></div>
        </form>}
    </section>;
}
