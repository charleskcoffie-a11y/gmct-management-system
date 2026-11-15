import React, { useEffect, useState } from 'react';
import type { Settings, Society, UserRole } from '../types';
import { getSupabaseClient } from '../services/supabase';
import { loadManagementAccess, type ManagementAccess as Access } from '../services/managementClient';

export default function ManagementAccess({ settings, societies, societyId, softwareAdmin }: {
    settings: Settings; societies: Society[]; societyId: string; softwareAdmin: boolean;
}) {
    const [users, setUsers] = useState<Access[]>([]);
    const [email, setEmail] = useState('');
    const [targetSociety, setTargetSociety] = useState(societyId);
    const [role, setRole] = useState<UserRole>('data-entry');
    const [classNumber, setClassNumber] = useState('');
    const [enabled, setEnabled] = useState(true);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const client = getSupabaseClient(settings.supabaseUrl, settings.supabaseKey);
    const reload = async () => { if (client) setUsers(await loadManagementAccess(client)); };
    useEffect(() => { reload().catch(error => setMessage(error.message)); }, [client, societyId]);
    const submit = async (event: React.FormEvent) => {
        event.preventDefault(); if (!client) return;
        setBusy(true); setMessage('');
        try {
            const { error } = await client.rpc('cmms_grant_user_access', { target_email: email.trim(), target_society: targetSociety,
                target_role: role, target_class: classNumber.trim() || null, enabled });
            if (error) throw error;
            await reload(); setMessage('Management access saved. The user can now sign in to their assigned society.');
        } catch (error: any) { setMessage(error.message); }
        finally { setBusy(false); }
    };
    const roles: UserRole[] = ['admin','finance-chair','finance-team','data-entry','pastor','statistician','class-leader'];
    if (softwareAdmin) roles.unshift('software-admin');
    return <section className="mx-auto max-w-6xl py-7">
        <h1 className="text-2xl font-bold">Management user access</h1>
        <p className="mt-2 text-slate-600">Assign a registered email to a society and role. These assignments apply to management only.</p>
        <form onSubmit={submit} className="my-6 grid gap-4 rounded-2xl border bg-white p-6 md:grid-cols-2">
            <label>Email<input type="email" autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} required className="mt-1 w-full rounded-lg border p-2" /></label>
            <label>Society<select value={targetSociety} onChange={e => setTargetSociety(e.target.value)} disabled={!softwareAdmin} className="mt-1 w-full rounded-lg border p-2">{societies.filter(s => softwareAdmin || s.id === societyId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            <label>Role<select value={role} onChange={e => setRole(e.target.value as UserRole)} className="mt-1 w-full rounded-lg border p-2">{roles.filter(r => softwareAdmin || r !== 'admin').map(r => <option key={r} value={r}>{r.replace(/-/g,' ')}</option>)}</select></label>
            <label>Class number {role !== 'class-leader' && '(optional)'}<input value={classNumber} onChange={e => setClassNumber(e.target.value)} required={role === 'class-leader'} className="mt-1 w-full rounded-lg border p-2" /></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />Access enabled</label>
            <button disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 font-bold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save management access'}</button>
            {message && <p role="status" className="rounded-lg bg-indigo-50 p-3 md:col-span-2">{message}</p>}
        </form>
        <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-100"><tr><th className="p-3">Email</th><th className="p-3">Society</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead><tbody>{users.map(user => <tr key={`${user.user_id}-${user.society_id}`} className="border-t"><td className="p-3">{user.email}</td><td className="p-3">{societies.find(s => s.id === user.society_id)?.shortName || user.society_id}</td><td className="p-3">{user.role.replace(/-/g,' ')}</td><td className="p-3">{user.active ? 'Enabled' : 'Disabled'}</td><td className="p-3"><button type="button" className="text-indigo-600 underline" onClick={() => { setEmail(user.email); setTargetSociety(user.society_id); setRole(user.role); setClassNumber(user.class_number || ''); setEnabled(user.active); }}>Edit</button></td></tr>)}</tbody></table></div>
    </section>;
}
