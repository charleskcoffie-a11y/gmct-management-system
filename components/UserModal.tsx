
// components/UserModal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import type { User, UserRole } from '../types';

interface UserModalProps {
    user: User | null;
    users: User[];
    onSave: (user: User, originalUsername?: string | null) => void;
    onClose: () => void;
}

const UserModal: React.FC<UserModalProps> = ({ user, users, onSave, onClose }) => {
    // Fix: Default to empty object instead of sanitizing invalid to prevent "InvalidUser" default
    const [formData, setFormData] = useState<User>(user || { username: '', password: '', role: 'finance-team', classLed: '' });
    const [showPassword, setShowPassword] = useState(false);
    const isEditing = !!user;

    useEffect(() => {
        if (user) {
            setFormData(user);
            setShowPassword(false);
        }
        // Don't reset if adding new, allows user to type
    }, [user]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === 'username') {
            const matchedUser = users.find(u => u.username.toLowerCase() === value.toLowerCase());
            if (matchedUser) {
                setFormData(prev => ({ ...prev, role: matchedUser.role, classLed: matchedUser.classLed || '' }));
                return;
            }

        }

        if (name === 'role' && !formData.username) {
            setFormData(prev => ({ ...prev, username: value }));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isEditing && !formData.password) {
            alert("Password is required for new users.");
            return;
        }
        if (!formData.username.trim()) {
            alert("Username is required.");
            return;
        }
        onSave(formData, user?.username || null);
    };

    // Sort users for dropdown
    const sortedUsers = useMemo(() => {
        return [...users].sort((a, b) => a.username.localeCompare(b.username));
    }, [users]);

    const ROLES: {value: UserRole, label: string, desc: string}[] = [
        { value: 'admin', label: 'Admin', desc: 'Full System & Financial Control' },
        { value: 'finance-chair', label: 'Finance Chair', desc: 'Full Financial Control (No System Settings)' },
        { value: 'finance-team', label: 'Finance Team', desc: 'Entry & Limited Edit' },
        { value: 'data-entry', label: 'Data Entry', desc: 'Entry Only (15min edit limit)' },
        { value: 'pastor', label: 'Pastor', desc: 'Read-Only Dashboards' },
        { value: 'class-leader', label: 'Class Leader', desc: 'Mark Attendance Only' },
        { value: 'statistician', label: 'Statistician', desc: 'Weekly History Only' },
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 border-b">
                        <h2 className="text-xl font-bold text-gray-800">{isEditing ? 'Edit User' : 'Add New User'}</h2>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label htmlFor="username" className="block font-medium text-gray-700">Username</label>
                            <input
                                id="username"
                                name="username"
                                type="text"
                                list="user-list"
                                value={formData.username}
                                onChange={handleChange}
                                required
                                placeholder="Select user or type name"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                            />
                            <datalist id="user-list">
                                {sortedUsers.map(u => (
                                    <option key={u.username} value={u.username}>{u.role}</option>
                                ))}
                            </datalist>
                        </div>
                        <div>
                            <label htmlFor="password" className="block font-medium text-gray-700">Password</label>
                            <div className="relative">
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder={isEditing ? 'Leave blank to keep unchanged' : 'Required'}
                                    required={!isEditing}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 pr-24"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(prev => !prev)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-indigo-600 hover:text-indigo-800"
                                >
                                    {showPassword ? 'Hide' : 'Show'}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="role" className="block font-medium text-gray-700">Role</label>
                            <select
                                id="role"
                                name="role"
                                value={formData.role}
                                onChange={handleChange}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                            <p className="text-xs text-slate-500 mt-1 italic">
                                {ROLES.find(r => r.value === formData.role)?.desc}
                            </p>
                        </div>
                        {formData.role === 'class-leader' && (
                            <div>
                                <label htmlFor="classLed" className="block font-medium text-gray-700">Class Led</label>
                                <input
                                    id="classLed"
                                    name="classLed"
                                    type="text"
                                    value={formData.classLed || ''}
                                    onChange={handleChange}
                                    required
                                    placeholder="e.g. 1"
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                />
                                <p className="text-xs text-slate-500 mt-1">Provide the class number led by this user when assigning the Class Leader role.</p>
                            </div>
                        )}
                    </div>
                    <div className="p-4 bg-gray-50 rounded-b-lg flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancel</button>
                        <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg">Save User</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserModal;
