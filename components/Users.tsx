
// components/Users.tsx
import React, { useState } from 'react';
import type { User, Member } from '../types';
import { sanitizeString, sanitizeUserRole } from '../utils';
import UserModal from './UserModal';


interface UsersTabProps {
    users: User[];
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    members: Member[];
}

const UsersTab: React.FC<UsersTabProps> = ({ users, setUsers, members }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    const handleSave = (user: User) => {
        const newUsers = [...users];
        const index = newUsers.findIndex(u => u.username.toLowerCase() === user.username.toLowerCase());
        
        if (index > -1) { // Edit
            const existingUser = newUsers[index];
            newUsers[index] = {
                ...existingUser,
                ...user,
                password: user.password ? user.password : existingUser.password, // Keep old password if new one is blank
            };
        } else { // Add
            newUsers.push(user);
        }
        setUsers(newUsers);
        setIsModalOpen(false);
    };

    const handleDelete = (username: string) => {
        if (users.length <= 1) return alert("Cannot delete the last user.");
        if (username.toLowerCase() === 'admin') return alert("Cannot delete the default Admin user.");
        if (window.confirm(`Are you sure you want to delete user "${username}"?`)) {
            setUsers(users.filter(u => u.username !== username));
        }
    };

    return (
        <div className="space-y-6 max-w-4xl">
             <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">Manage Users</h2>
                <button onClick={() => { setSelectedUser(null); setIsModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg">
                    Add New User
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-x-auto max-h-[70vh] overflow-y-auto">
                <table className="w-full text-left text-slate-500">
                    <thead className="text-base text-slate-700 uppercase bg-slate-100 sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-3">Username</th>
                            <th className="px-6 py-3">Role</th>
                            <th className="px-6 py-3">Details</th>
                            <th className="px-6 py-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.username} className="bg-white border-b hover:bg-slate-50">
                                <td className="px-6 py-4 font-medium text-slate-900">{sanitizeString(user.username)}</td>
                                <td className="px-6 py-4 capitalize">{sanitizeUserRole(user.role).replace('-', ' ')}</td>
                                <td className="px-6 py-4">{user.role === 'class-leader' ? `Leads Class ${sanitizeString(user.classLed)}` : ''}</td>
                                <td className="px-6 py-4 text-right">
                                    <button onClick={() => { setSelectedUser(user); setIsModalOpen(true); }} className="font-medium text-indigo-600 hover:underline mr-4">Edit</button>
                                    <button onClick={() => handleDelete(user.username)} className="font-medium text-red-600 hover:text-red-800 hover:underline">Delete</button>
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
