// components/Users.tsx
import React, { useState } from 'react';
import type { User, Member, Settings, SyncStatus } from '../types';
import { sanitizeString, sanitizeUserRole } from '../utils';
import UserModal from './UserModal';
import { saveUserToSupabase, deleteUserFromSupabase } from '../services/supabase';

interface UsersTabProps {
    users: User[];
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    members: Member[];
    settings?: Settings;
    syncStatus?: SyncStatus;
}

const UsersTab: React.FC<UsersTabProps> = ({ users, setUsers, members, settings, syncStatus }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    const handleSave = async (user: User, originalUsername?: string) => {
        if (!settings?.supabaseUrl || !settings?.supabaseKey || syncStatus?.state !== 'synced') {
            alert('Writes are disabled until connected to the cloud. Please ensure Supabase is configured and the app shows Connected.');
            return;
        }
        // Disallow any edits or creation targeting the default Admin user
        const isOriginalAdmin = !!originalUsername && originalUsername.toLowerCase() === 'admin';
        const isTargetAdmin = user.username.toLowerCase() === 'admin';
        if (isOriginalAdmin || (!originalUsername && isTargetAdmin)) {
            alert('The default Admin user cannot be edited or recreated.');
            return;
        }
        const newUsers = [...users];
        const matchUsername = (originalUsername || user.username).toLowerCase();
        const index = newUsers.findIndex(u => u.username.toLowerCase() === matchUsername);

        // Protect default Admin account from being renamed
        if (matchUsername === 'admin' && user.username.toLowerCase() !== matchUsername) {
            alert('The default Admin username cannot be renamed.');
            return;
        }

        // Prevent duplicate usernames when creating/renaming
        const hasDuplicate = newUsers.some((u, i) => i !== index && u.username.toLowerCase() === user.username.toLowerCase());
        if (hasDuplicate) {
            alert(`Username "${user.username}" is already in use.`);
            return;
        }

        if (index > -1) {
            const existingUser = newUsers[index];
            newUsers[index] = {
                ...existingUser,
                ...user,
                password: user.password ? user.password : existingUser.password,
            };
        } else {
            newUsers.push(user);
        }

        // Optimistic update local state
        setUsers(newUsers);

        // Persist to Supabase if configured
        if (settings?.supabaseUrl && settings?.supabaseKey) {
            try {
                await saveUserToSupabase(settings.supabaseUrl, settings.supabaseKey, user, originalUsername);
            } catch (e: any) {
                alert(`Cloud save failed. Local updated only. Details: ${e.message || e}`);
            }
        }
        setIsModalOpen(false);
        setSelectedUser(null);
    };

    const handleDelete = async (username: string) => {
        if (!settings?.supabaseUrl || !settings?.supabaseKey || syncStatus?.state !== 'synced') {
            alert('Deletes are disabled until connected to the cloud. Please ensure Supabase is configured and the app shows Connected.');
            return;
        }
        const uname = username.toLowerCase();
        if (uname === 'admin') {
            alert('The default Admin user cannot be deleted.');
            return;
        }
        if (!confirm(`Delete user "${username}"?`)) return;
        // Optimistic local delete
        setUsers(prev => prev.filter(u => u.username.toLowerCase() !== uname));

        // Persist delete to Supabase if configured
        if (settings?.supabaseUrl && settings?.supabaseKey) {
            try {
                await deleteUserFromSupabase(settings.supabaseUrl, settings.supabaseKey, username);
            } catch (e: any) {
                alert(`Cloud delete failed. Local removed only. Details: ${e.message || e}`);
            }
        }
    };

    const totalUsers = users.length;
    const roleSet = Array.from(new Set(users.map(u => sanitizeUserRole(u.role))));
    const roleBadgeClass = (role: string) => {
        const r = role.toLowerCase();
        if (r === 'admin') return 'bg-rose-100 text-rose-800 border border-rose-200';
        if (r === 'finance-chair') return 'bg-indigo-100 text-indigo-800 border border-indigo-200';
        if (r === 'finance-team') return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
        if (r === 'data-entry') return 'bg-sky-100 text-sky-800 border border-sky-200';
        if (r === 'pastor') return 'bg-amber-100 text-amber-800 border border-amber-200';
        if (r === 'statistician') return 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200';
        if (r === 'class-leader') return 'bg-cyan-100 text-cyan-800 border border-cyan-200';
        return 'bg-slate-100 text-slate-700 border border-slate-200';
    };

    return (
        <div className="space-y-6 max-w-5xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="inline-block text-3xl font-extrabold text-white bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-6 py-3 rounded-xl shadow-lg">👤 Manage Users</h2>
                    <p className="text-base text-slate-600 mt-3 font-medium">{totalUsers} user{totalUsers === 1 ? '' : 's'} • Roles: {roleSet.map(r => r.replace('-', ' ')).join(', ') || '—'}</p>
                    <p className="text-sm text-slate-500 mt-1 italic">Note: The default Admin account is locked from edits, rename, and deletion.</p>
                </div>
                <button 
                    onClick={() => { if (syncStatus?.state === 'synced' && settings?.supabaseUrl && settings?.supabaseKey) { setSelectedUser(null); setIsModalOpen(true); } }} 
                    disabled={!(syncStatus?.state === 'synced' && settings?.supabaseUrl && settings?.supabaseKey)}
                    title={!(syncStatus?.state === 'synced' && settings?.supabaseUrl && settings?.supabaseKey) ? 'Connect to Supabase to add users' : ''}
                    className={`bg-gradient-to-br from-green-500 to-emerald-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg border-2 border-green-300 ${!(syncStatus?.state === 'synced' && settings?.supabaseUrl && settings?.supabaseKey) ? 'opacity-60 cursor-not-allowed' : 'hover:from-green-600 hover:to-emerald-700 hover:scale-105'}`}
                >
                    + Add New User
                </button>
            </div>

            <div className="bg-gradient-to-br from-slate-50 to-indigo-50 rounded-xl shadow-lg border-2 border-slate-200/80 p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {users.map(user => {
                        const initials = sanitizeString(user.username).split(' ').map(s => s[0]).join('').slice(0,2).toUpperCase();
                        const isAdmin = user.username.toLowerCase() === 'admin';
                        return (
                            <div key={user.username} className={`relative flex flex-col gap-3 bg-white rounded-2xl border border-slate-200 shadow group hover:shadow-xl transition p-5 ${isAdmin ? 'opacity-80' : ''}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`flex items-center justify-center w-14 h-14 rounded-full font-extrabold text-xl border-4 shadow-inner ${isAdmin ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-indigo-100 text-indigo-700 border-indigo-200'}`}> 
                                        {initials}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-lg text-slate-900 truncate flex items-center gap-2">
                                            {sanitizeString(user.username)}
                                            {isAdmin && <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 font-bold">Admin</span>}
                                        </div>
                                        <div className="mt-1">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${roleBadgeClass(user.role)}`}>{sanitizeUserRole(user.role).replace('-', ' ')}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1 text-slate-500 text-sm mt-2">—</div>
                                <div className="flex gap-2 justify-end mt-2">
                                    <button
                                        onClick={() => {
                                            if (isAdmin) {
                                                alert('The default Admin user cannot be edited.');
                                                return;
                                            }
                                            setSelectedUser(user);
                                            setIsModalOpen(true);
                                        }}
                                        className={`flex items-center gap-1 font-bold px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-900 transition ${isAdmin ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        title={isAdmin ? 'Admin user is locked' : 'Edit user'}
                                        disabled={isAdmin}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536M9 11l6 6M3 21h6v-6l9.293-9.293a1 1 0 00-1.414-1.414L9 11z" /></svg>
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(user.username)}
                                        className={`flex items-center gap-1 font-bold px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-900 transition ${isAdmin ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        title={isAdmin ? 'Admin user cannot be deleted' : 'Delete user'}
                                        disabled={isAdmin}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                        Delete
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {isModalOpen && <UserModal user={selectedUser} users={users} members={members} onSave={handleSave} onClose={() => setIsModalOpen(false)} />}
        </div>
    );
};

export default UsersTab;
