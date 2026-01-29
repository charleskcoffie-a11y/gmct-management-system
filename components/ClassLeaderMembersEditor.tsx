import React, { useState, useMemo } from 'react';
import type { Member, Settings, SyncStatus } from '../types';
import MemberModal from './MemberModal';
import { saveMemberToSupabase as saveMemberToSupabaseFn, deleteMemberFromSupabase } from '../services/supabase';
import { useToast } from './ToastProvider';
import { sanitizeMember } from '../utils';

interface ClassLeaderMembersEditorProps {
    isOpen: boolean;
    onClose: () => void;
    members: Member[];
    setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
    classNumber: string | undefined;
    settings: Settings;
    syncStatus?: SyncStatus;
}

const ClassLeaderMembersEditor: React.FC<ClassLeaderMembersEditorProps> = ({
    isOpen,
    onClose,
    members,
    setMembers,
    classNumber,
    settings,
    syncStatus
}) => {
    const { showToast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [newMemberName, setNewMemberName] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    const isConnected = !!settings.supabaseUrl && !!settings.supabaseKey && syncStatus?.state === 'synced';

    // Filter members by class
    const classMembers = useMemo(() => {
        return members
            .filter(m => m.classNumber === classNumber)
            .filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()) || (m.phone && m.phone.includes(searchTerm)))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [members, classNumber, searchTerm]);

    const handleAddNewMember = async () => {
        if (!newMemberName.trim()) {
            showToast('Please enter a member name', 'error', 2000);
            return;
        }

        const newMember: Member = {
            id: `member_${Date.now()}`,
            name: newMemberName.trim(),
            classNumber: classNumber || '1',
            phone: '',
            email: '',
            address: '',
            dateOfBirth: undefined,
            dayBorn: undefined,
            profession: '',
            active: true
        };

        try {
            if (isConnected) {
                await saveMemberToSupabaseFn(settings.supabaseUrl, settings.supabaseKey, newMember);
            }
            setMembers(prev => [...prev, newMember]);
            setNewMemberName('');
            setIsAddingNew(false);
            showToast(`✅ Added ${newMember.name}`, 'success', 2000);
        } catch (err: any) {
            showToast(`Failed to add member: ${err.message}`, 'error', 3000);
        }
    };

    const handleDeleteMember = async (memberId: string) => {
        if (!window.confirm('Are you sure you want to delete this member?')) return;

        setIsDeleting(true);
        try {
            if (isConnected) {
                await deleteMemberFromSupabase(memberId, settings.supabaseUrl, settings.supabaseKey);
            }
            setMembers(prev => prev.filter(m => m.id !== memberId));
            showToast('Member deleted', 'success', 2000);
        } catch (err: any) {
            showToast(`Failed to delete member: ${err.message}`, 'error', 3000);
        } finally {
            setIsDeleting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Modal backdrop */}
            <div 
                className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4"
                onClick={onClose}
            >
                {/* Modal content */}
                <div 
                    className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col z-50"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 p-8 text-white flex justify-between items-center flex-shrink-0 shadow-lg">
                        <div>
                            <h2 className="text-3xl font-bold flex items-center gap-2">👥 Manage Class Members</h2>
                            <p className="text-sm text-emerald-100 mt-2">Class {classNumber} • {classMembers.length} members</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white hover:bg-white/20 p-2 rounded-lg text-2xl font-bold transition"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {/* Search Bar */}
                        <div className="mb-6">
                            <label className="block text-sm font-bold text-slate-700 mb-2">🔍 Search Members</label>
                            <input
                                type="text"
                                placeholder="Name or phone number..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full px-4 py-3 border-2 border-emerald-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 bg-emerald-50 font-medium"
                            />
                        </div>

                        {/* Add New Member */}
                        {!isAddingNew ? (
                            <button
                                onClick={() => setIsAddingNew(true)}
                                className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-4 px-4 rounded-xl font-bold text-lg hover:from-emerald-600 hover:to-teal-700 transition flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                </svg>
                                ➕ Add New Member
                            </button>
                        ) : (
                            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-5 rounded-xl border-2 border-emerald-300 space-y-3 shadow-md">
                                <input
                                    type="text"
                                    placeholder="Enter member name"
                                    value={newMemberName}
                                    onChange={e => setNewMemberName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAddNewMember()}
                                    autoFocus
                                    className="w-full px-3 py-2 border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleAddNewMember}
                                        className="flex-1 bg-emerald-600 text-white py-2 px-3 rounded-lg font-bold hover:bg-emerald-700 transition text-sm"
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsAddingNew(false);
                                            setNewMemberName('');
                                        }}
                                        className="flex-1 bg-slate-200 text-slate-700 py-2 px-3 rounded-lg font-bold hover:bg-slate-300 transition text-sm"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Members List */}
                        <div className="space-y-3">
                            {classMembers.length === 0 ? (
                                <div className="text-center text-slate-500 py-16 bg-gradient-to-br from-slate-50 to-emerald-50 rounded-xl border-2 border-dashed border-slate-300">
                                    <p className="text-xl font-bold">📋 No members found</p>
                                    <p className="text-sm mt-2">{searchTerm ? '🔍 Try a different search term' : '➕ Add your first member to get started'}</p>
                                </div>
                            ) : (
                                classMembers.map(member => (
                                    <div
                                        key={member.id}
                                        className="bg-gradient-to-br from-white to-emerald-50 p-5 rounded-xl border-2 border-emerald-200 hover:border-emerald-400 transition-all hover:shadow-md flex justify-between items-center group"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-slate-800 text-lg group-hover:text-emerald-700 transition">{member.name}</h3>
                                            <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-600">
                                                {member.phone && (
                                                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md">📱 {member.phone}</span>
                                                )}
                                                {member.email && (
                                                    <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-md">📧 {member.email}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2 ml-4 flex-shrink-0">
                                            <button
                                                onClick={() => {
                                                    setSelectedMember(member);
                                                    setIsEditModalOpen(true);
                                                }}
                                                className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-5 py-2 rounded-lg font-bold hover:from-blue-600 hover:to-blue-700 transition text-sm shadow-md"
                                            >
                                                ✏️ Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteMember(member.id)}
                                                disabled={isDeleting}
                                                className="bg-gradient-to-r from-red-500 to-red-600 text-white px-5 py-2 rounded-lg font-bold hover:from-red-600 hover:to-red-700 transition text-sm shadow-md disabled:opacity-60"
                                            >
                                                🗑️ Delete
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="bg-gradient-to-r from-slate-50 to-emerald-50 p-6 flex justify-end gap-3 flex-shrink-0 border-t-2 border-emerald-200 shadow-inner">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-white border-2 border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition"
                        >
                            Done
                        </button>
                    </div>
                </div>
            </div>

            {/* Edit Member Modal */}
            {isEditModalOpen && selectedMember && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <MemberModal
                            member={selectedMember}
                            onClose={() => {
                                setIsEditModalOpen(false);
                                setSelectedMember(null);
                            }}
                            onSave={(updatedMember) => {
                                setMembers(prev =>
                                    prev.map(m => m.id === updatedMember.id ? updatedMember : m)
                                );
                                setIsEditModalOpen(false);
                                setSelectedMember(null);
                                showToast(`✅ Updated ${updatedMember.name}`, 'success', 2000);
                            }}
                        />
                    </div>
                </div>
            )}
        </>
    );
};

export default ClassLeaderMembersEditor;
