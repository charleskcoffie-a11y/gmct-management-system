// components/Users.tsx
import React, { useState } from 'react';
import type { User, Member, Settings } from '../types';
import { sanitizeString, sanitizeUserRole } from '../utils';
import UserModal from './UserModal';
import { saveUserToSupabase, deleteUserFromSupabase } from '../services/supabase';

interface UsersTabProps {
    users: User[];
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    members: Member[];
    settings?: Settings;
}

const UsersTab: React.FC<UsersTabProps> = ({ users, setUsers, members, settings }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    const handleSave = async (user: User, originalUsername?: string) => {
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
        return 'bg-slate-100 text-slate-700 border border-slate-200';
    };

    return (
        <div className="space-y-6 max-w-5xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="inline-block text-3xl font-extrabold text-white bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-6 py-3 rounded-xl shadow-lg">👤 Manage Users</h2>
                    <p className="text-base text-slate-600 mt-3 font-medium">{totalUsers} user{totalUsers === 1 ? '' : 's'} • Roles: {roleSet.map(r => r.replace('-', ' ')).join(', ') || '—'}</p>
                </div>
                <button onClick={() => { setSelectedUser(null); setIsModalOpen(true); }} className="bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all hover:scale-105 border-2 border-green-300">
                    + Add New User
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-lg border-2 border-slate-200/80 overflow-x-auto max-h-[70vh] overflow-y-auto">
                <table className="w-full text-left text-slate-600">
                    <thead className="text-sm text-slate-700 uppercase bg-gradient-to-r from-slate-50 to-indigo-50 sticky top-0 z-10 border-b border-indigo-100">
                        <tr>
                            <th className="px-6 py-3">Username</th>
                            <th className="px-6 py-3">Role</th>
                            <th className="px-6 py-3">Details</th>
                            <th className="px-6 py-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.username} className="bg-white border-t border-slate-100 hover:bg-indigo-50/40">
                                <td className="px-6 py-4 font-bold text-slate-900 tracking-wide">{sanitizeString(user.username)}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-3 py-1 rounded-full text-sm font-bold capitalize ${roleBadgeClass(user.role)}`}>{sanitizeUserRole(user.role).replace('-', ' ')}</span>
                                </td>
                                <td className="px-6 py-4 text-slate-500">—</td>
                                <td className="px-6 py-4 text-right">
                                    <button onClick={() => { setSelectedUser(user); setIsModalOpen(true); }} className="font-bold text-indigo-600 hover:text-indigo-800 mr-4">Edit</button>
                                    <button onClick={() => handleDelete(user.username)} className="font-bold text-rose-600 hover:text-rose-800">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && <UserModal user={selectedUser} users={users} members={members} onSave={handleSave} onClose={() => setIsModalOpen(false)} />}
        </div>
    );
};

export default UsersTab;
