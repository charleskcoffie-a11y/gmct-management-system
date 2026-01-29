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
                await saveMemberToSupabaseFn(newMember, settings.supabaseUrl, settings.supabaseKey);
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
                    <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white flex justify-between items-center flex-shrink-0">
                        <div>
                            <h2 className="text-2xl font-bold">Edit Members</h2>
                            <p className="text-sm text-teal-100 mt-1">Class {classNumber} • {classMembers.length} members</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white hover:text-teal-100 text-3xl font-bold transition"
                        >
                            ×
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {/* Search Bar */}
                        <div className="mb-4">
                            <input
                                type="text"
                                placeholder="Search members by name or phone..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                            />
                        </div>

                        {/* Add New Member */}
                        {!isAddingNew ? (
                            <button
                                onClick={() => setIsAddingNew(true)}
                                className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-3 px-4 rounded-lg font-bold hover:from-emerald-600 hover:to-teal-700 transition flex items-center justify-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                </svg>
                                Add New Member
                            </button>
                        ) : (
                            <div className="bg-emerald-50 p-4 rounded-lg border-2 border-emerald-200 space-y-3">
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
                                <div className="text-center text-slate-400 py-12">
                                    <p className="text-lg font-semibold">No members found</p>
                                    <p className="text-sm mt-1">{searchTerm ? 'Try a different search' : 'Add your first member'}</p>
                                </div>
                            ) : (
                                classMembers.map(member => (
                                    <div
                                        key={member.id}
                                        className="bg-gradient-to-br from-slate-50 to-emerald-50 p-4 rounded-lg border-2 border-slate-200 hover:border-emerald-300 transition-all flex justify-between items-center"
                                    >
                                        <div className="flex-1">
                                            <h3 className="font-bold text-slate-800 text-base">{member.name}</h3>
                                            {member.phone && <p className="text-sm text-slate-500 mt-1">{member.phone}</p>}
                                            {member.email && <p className="text-sm text-slate-500">{member.email}</p>}
                                        </div>
                                        <div className="flex gap-2 ml-4">
                                            <button
                                                onClick={() => {
                                                    setSelectedMember(member);
                                                    setIsEditModalOpen(true);
                                                }}
                                                className="bg-blue-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-600 transition text-sm"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteMember(member.id)}
                                                disabled={isDeleting}
                                                className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-600 transition text-sm disabled:opacity-60"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="bg-slate-100 p-4 flex justify-end gap-3 flex-shrink-0 border-t border-slate-200">
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
                            currentUser={{ id: '', email: '', name: '', role: 'class-leader', classLed: classNumber }}
                            settings={settings}
                        />
                    </div>
                </div>
            )}
        </>
    );
};

export default ClassLeaderMembersEditor;
