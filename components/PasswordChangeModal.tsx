import React, { useState } from 'react';
import type { User, Settings } from '../types';
import { saveUserToSupabase } from '../services/supabase';

interface PasswordChangeModalProps {
    currentUser: User;
    users: User[];
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    settings: Settings;
    onClose: () => void;
}

const PasswordChangeModal: React.FC<PasswordChangeModalProps> = ({ currentUser, users, setUsers, settings, onClose }) => {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validate old password
        if (currentUser.password && currentUser.password !== oldPassword) {
            setError('Current password is incorrect.');
            return;
        }

        // Validate new password
        if (!newPassword || newPassword.trim().length < 4) {
            setError('New password must be at least 4 characters.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('New passwords do not match.');
            return;
        }

        if (!settings.supabaseUrl || !settings.supabaseKey) {
            setError('Database connection not configured.');
            return;
        }

        setIsSubmitting(true);

        try {
            const updatedUser: User = {
                ...currentUser,
                password: newPassword
            };

            await saveUserToSupabase(settings.supabaseUrl, settings.supabaseKey, updatedUser, currentUser.username);
            
            // Update local state
            setUsers(prev => prev.map(u => u.username.toLowerCase() === currentUser.username.toLowerCase() ? updatedUser : u));
            
            alert('Password changed successfully!');
            onClose();
        } catch (err: any) {
            setError(`Failed to change password: ${err.message || 'Unknown error'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 border-b">
                        <h2 className="text-xl font-bold text-gray-800">Change Password</h2>
                        <p className="text-sm text-gray-600 mt-1">Update your password for user: <span className="font-semibold">{currentUser.username}</span></p>
                    </div>
                    <div className="p-6 space-y-4">
                        {currentUser.password && (
                            <div>
                                <label htmlFor="oldPassword" className="block font-medium text-gray-700">Current Password</label>
                                <input
                                    id="oldPassword"
                                    name="oldPassword"
                                    type="password"
                                    value={oldPassword}
                                    onChange={(e) => setOldPassword(e.target.value)}
                                    required
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                        )}
                        <div>
                            <label htmlFor="newPassword" className="block font-medium text-gray-700">New Password</label>
                            <input
                                id="newPassword"
                                name="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                minLength={4}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                        <div>
                            <label htmlFor="confirmPassword" className="block font-medium text-gray-700">Confirm New Password</label>
                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                minLength={4}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                <p className="text-sm text-red-800">{error}</p>
                            </div>
                        )}
                    </div>
                    <div className="p-4 bg-gray-50 rounded-b-lg flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg">
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={isSubmitting}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Saving...' : 'Change Password'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PasswordChangeModal;
