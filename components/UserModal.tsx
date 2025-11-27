
// components/UserModal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import type { User, UserRole, Member } from '../types';
import { sanitizeUser, sanitizeString } from '../utils';

interface UserModalProps {
    user: User | null;
    members: Member[];
    onSave: (user: User) => void;
    onClose: () => void;
}

const UserModal: React.FC<UserModalProps> = ({ user, members, onSave, onClose }) => {
    // Fix: Default to empty object instead of sanitizing invalid to prevent "InvalidUser" default
    const [formData, setFormData] = useState<User>(user || { username: '', password: '', role: 'finance-team', classLed: '' });
    const isEditing = !!user;

    useEffect(() => {
        if (user) {
            setFormData(user);
        }
        // Don't reset if adding new, allows user to type
    }, [user]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        
        // Auto-fill class number if selecting a member for Class Leader role
        if (name === 'username' && formData.role === 'class-leader') {
            const member = members.find(m => m.name.toLowerCase() === value.toLowerCase());
            if (member && member.classNumber) {
                setFormData(prev => ({ ...prev, classLed: member.classNumber }));
            }
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
        onSave(formData);
    };
    
    // Sort members for dropdown
    const sortedMembers = useMemo(() => {
        return [...members].sort((a,b) => a.name.localeCompare(b.name));
    }, [members]);

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
                            <label htmlFor="username" className="block font-medium text-gray-700">Username / Member Name</label>
                            <input
                                id="username"
                                name="username"
                                type="text"
                                list="user-member-list"
                                value={formData.username}
                                onChange={handleChange}
                                required
                                disabled={isEditing}
                                placeholder="Select Member or Type Name"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                            />
                            <datalist id="user-member-list">
                                {sortedMembers.map(m => (
                                    <option key={m.id} value={m.name}>Class {m.classNumber || 'N/A'}</option>
                                ))}
                            </datalist>
                        </div>
                        <div>
                            <label htmlFor="password" className="block font-medium text-gray-700">Password</label>
                             <input
                                id="password"
                                name="password"
                                type="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder={isEditing ? 'Leave blank to keep unchanged' : 'Required'}
                                required={!isEditing}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            />
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
                                <p className="text-xs text-slate-500 mt-1">If selecting a member, this may auto-fill based on their class.</p>
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
