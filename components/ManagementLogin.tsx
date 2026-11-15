import React, { useEffect, useState } from 'react';
import type { Settings, Society, User } from '../types';
import { getSupabaseClient } from '../services/supabase';
import { managementSessionUser } from '../services/managementClient';

export default function ManagementLogin({ settings, society, onSignedIn, onChangeSociety }: {
    settings: Settings; society: Society; onSignedIn: (user: User) => void; onChangeSociety: () => void;
}) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [register, setRegister] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const client = getSupabaseClient(settings.supabaseUrl, settings.supabaseKey);

    useEffect(() => {
        let cancelled = false;
        if (!client) return;
        client.auth.getSession().then(async ({ data }) => {
            if (!data.session || cancelled) return;
            const user = await managementSessionUser(client, society.id);
            if (cancelled) return;
            if (user) onSignedIn(user);
            else setMessage('You are signed in, but management access has not been assigned for this society. Contact the management administrator.');
        }).catch(error => { if (!cancelled) setMessage(error.message); });
        return () => { cancelled = true; };
    }, [client, society.id]);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!client) return;
        setBusy(true); setMessage('');
        try {
            if (register) {
                const { error } = await client.auth.signUp({ email: email.trim(), password,
                    options: { data: { full_name: name.trim(), application: 'cmms' }, emailRedirectTo: window.location.origin } });
                if (error) throw error;
                setPassword('');
                setMessage('Account request submitted. Check your email for confirmation, then ask the management administrator to assign your role and society. An existing account can sign in directly.');
            } else {
                const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
                if (error) throw error;
                setPassword('');
                const user = await managementSessionUser(client, society.id);
                if (!user) throw new Error('Your account is signed in, but management access has not been assigned for this society. Contact the management administrator.');
                onSignedIn(user);
            }
        } catch (error: any) { setMessage(error.message || 'Unable to sign in.'); }
        finally { setBusy(false); }
    };

    return <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md rounded-3xl border border-indigo-400/30 bg-slate-900 p-8 shadow-2xl">
            <p className="text-xs tracking-widest uppercase text-indigo-300 mb-3">Canada Mission Management</p>
            <h1 className="text-2xl font-bold">{register ? 'Create your account' : 'Sign in'}</h1>
            <p className="mt-2 text-slate-300">{society.name}</p>
            <p className="mt-3 text-sm text-slate-400">Use your existing Canada Mission account, or create one. Management access is assigned separately from programme planning.</p>
            <form onSubmit={submit} className="mt-6 space-y-4">
                {register && <label className="block text-sm">Full name<input value={name} onChange={e => setName(e.target.value)} autoComplete="name" required className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-950 p-3" /></label>}
                <label className="block text-sm">Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-950 p-3" /></label>
                <label className="block text-sm">Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 8 : undefined} required className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-950 p-3" /></label>
                {message && <p role="status" className="rounded-xl border border-indigo-400/30 bg-indigo-950 p-3 text-sm">{message}</p>}
                <button type="submit" disabled={busy || !client} className="w-full rounded-xl bg-indigo-500 p-3 font-bold hover:bg-indigo-400 disabled:opacity-50">{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button>
            </form>
            <button type="button" onClick={() => { setRegister(!register); setMessage(''); setPassword(''); }} className="mt-5 text-sm text-indigo-300 underline">{register ? 'Already registered? Sign in' : 'New user? Create an account'}</button>
            <div className="mt-5 flex flex-wrap justify-between gap-3 border-t border-slate-700 pt-5 text-sm">
                <button type="button" onClick={onChangeSociety} className="text-slate-300 hover:text-white">Change society</button>
                <button type="button" onClick={async () => { await client?.auth.signOut({ scope: 'local' }); setMessage('Signed out of management.'); }} className="text-slate-300 hover:text-white">Clear management sign-in</button>
            </div>
        </div>
    </main>;
}
