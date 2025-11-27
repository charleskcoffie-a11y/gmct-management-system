
// components/Members.tsx
import React, { useState, useMemo } from 'react';
import type { Member, Settings, Entry, DevelopmentFundEntry } from '../types';
import { sanitizeString, sanitizeMember, fromCsv } from '../utils';
import MemberModal from './MemberModal';
import ConfirmationModal from './ConfirmationModal';
import MemberProfileModal from './MemberProfileModal';
import { UploadIcon } from './icons';

interface MembersProps {
    members: Member[];
    setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
    settings: Settings;
    // Props needed for profile calculation
    entries?: Entry[];
    developmentEntries?: DevelopmentFundEntry[];
}

const Members: React.FC<MembersProps> = ({ members, setMembers, settings, entries = [], developmentEntries = [] }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [classFilter, setClassFilter] = useState<string>('all');
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [memberToDeleteId, setMemberToDeleteId] = useState<string | null>(null);
    
    // New State for Profile Modal
    const [viewProfileMember, setViewProfileMember] = useState<Member | null>(null);

    const classOptions = useMemo(() => {
        return ['all', ...Array.from({ length: settings.maxClasses }, (_, i) => String(i + 1))];
    }, [settings.maxClasses]);

    const handleImportMembers = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const rows = fromCsv(String(reader.result));
                const importedMembers = rows
                    .map(r => sanitizeMember(r))
                    .filter(m => m.name && m.name !== "Unnamed Member");

                if (importedMembers.length === 0) {
                    alert("No valid members to import were found in the file.");
                    return;
                }

                // Check for duplicates based on name (case-insensitive)
                const existingMemberNames = new Set(
                    members.map(m => sanitizeString(m.name).toLowerCase())
                );

                const newMembers: Member[] = [];
                let duplicateCount = 0;

                importedMembers.forEach(member => {
                    const key = sanitizeString(member.name).toLowerCase();
                    if (existingMemberNames.has(key)) {
                        duplicateCount++;
                    } else {
                        newMembers.push(member);
                        existingMemberNames.add(key);
                    }
                });
                
                if (newMembers.length > 0) {
                    setMembers(prev => [...prev, ...newMembers].sort((a, b) => a.name.localeCompare(b.name)));
                }

                alert(`Import Complete\n- Added: ${newMembers.length}\n- Duplicates Skipped: ${duplicateCount}`);

            } catch (e) {
                console.error("Member CSV Import Error:", e);
                alert("Failed to import CSV. Please check the file format.");
            }
        };
        reader.readAsText(file);
        event.target.value = ""; 
    };

    const handleSave = (member: Member) => {
        const newMembers = [...members];
        const index = newMembers.findIndex(m => m.id === member.id);

        if (index > -1) { // Edit
            newMembers[index] = member;
        } else { // Add
            newMembers.push(member);
        }
        setMembers(newMembers.sort((a,b) => a.name.localeCompare(b.name)));
        setIsModalOpen(false);
    };
    
    const handleDelete = (id: string) => {
        setMemberToDeleteId(id);
        setIsConfirmDeleteOpen(true);
    };

    const confirmDeleteMember = () => {
        if (memberToDeleteId) {
            setMembers(members.filter(m => m.id !== memberToDeleteId));
        }
        setIsConfirmDeleteOpen(false);
        setMemberToDeleteId(null);
    };
    
    const filteredMembers = useMemo(() => {
        return members.filter(m => {
            const term = searchTerm.toLowerCase();
            const searchTermMatch = 
                term === '' ||
                m.name.toLowerCase().includes(term) ||
                m.id.toLowerCase().includes(term) ||
                (m.classNumber && m.classNumber.toLowerCase().includes(term)) ||
                (m.memberNumber && m.memberNumber.toLowerCase().includes(term));
            
            const classFilterMatch = classFilter === 'all' || m.classNumber === classFilter;

            return searchTermMatch && classFilterMatch;
        });
    }, [members, searchTerm, classFilter]);

    const clearFilters = () => {
        setSearchTerm('');
        setClassFilter('all');
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Member Directory</h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Manage membership, assign classes, and view giving history.
                    </p>
                </div>
                <div className="flex gap-3">
                     <label className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg cursor-pointer inline-flex items-center gap-2 transition-colors border border-slate-200">
                        <UploadIcon />
                        <span className="hidden sm:inline">Import</span>
                        <input type="file" accept=".csv" className="hidden" onChange={handleImportMembers} />
                    </label>
                    <button onClick={() => { setSelectedMember(null); setIsModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex-shrink-0 shadow-md transition-transform hover:scale-105">
                        + Add Member
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200/80 space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-grow">
                        <input 
                            type="text"
                            placeholder="Search Name, Member #, or Class..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="block w-full border-slate-300 rounded-lg py-3 px-4 focus:ring-indigo-500 text-lg"
                        />
                    </div>
                    <div className="w-full md:w-64">
                        <select
                            value={classFilter}
                            onChange={e => setClassFilter(e.target.value)}
                            className="block w-full border-slate-300 rounded-lg py-3 px-4 focus:ring-indigo-500 text-lg"
                        >
                             <option value="all">All Classes</option>
                            {classOptions.slice(1).map(cls => (
                                <option key={cls} value={cls}>Class {cls}</option>
                            ))}
                        </select>
                    </div>
                </div>
                
                <div className="text-sm text-slate-500 pl-1">
                    Showing <span className="font-bold text-slate-900">{filteredMembers.length}</span> results
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-x-auto max-h-[70vh] overflow-y-auto">
                <table className="w-full text-left text-slate-500">
                    <thead className="text-base text-slate-700 uppercase bg-slate-50 sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-3">ID</th>
                            <th className="px-6 py-3">Name</th>
                            <th className="px-6 py-3">Class</th>
                            <th className="px-6 py-3">Member #</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredMembers.map(member => (
                            <tr key={member.id} className="bg-white border-b hover:bg-slate-50">
                                <td className="px-6 py-4 text-sm font-mono text-slate-400">{member.id.substring(0, 8)}</td>
                                <td className="px-6 py-4 font-bold text-slate-900 text-lg">
                                    {sanitizeString(member.name)}
                                </td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-slate-100 text-slate-800">
                                        {member.classNumber || '-'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-slate-800 font-medium">{sanitizeString(member.memberNumber) || '-'}</td>
                                <td className="px-6 py-4 text-right flex justify-end gap-3">
                                    <button 
                                        onClick={() => setViewProfileMember(member)} 
                                        className="font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1 rounded transition-colors"
                                    >
                                        View Profile
                                    </button>
                                    <button 
                                        onClick={() => { setSelectedMember(member); setIsModalOpen(true); }} 
                                        className="font-medium text-slate-500 hover:text-indigo-600 px-3 py-1"
                                    >
                                        Edit
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(member.id)} 
                                        className="font-medium text-slate-400 hover:text-red-600 px-3 py-1"
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && <MemberModal member={selectedMember} onSave={handleSave} onClose={() => setIsModalOpen(false)} />}
            
            {viewProfileMember && (
                <MemberProfileModal 
                    member={viewProfileMember} 
                    entries={entries}
                    developmentEntries={developmentEntries}
                    settings={settings}
                    onClose={() => setViewProfileMember(null)} 
                />
            )}

            <ConfirmationModal
                isOpen={isConfirmDeleteOpen}
                onClose={() => {
                    setIsConfirmDeleteOpen(false);
                    setMemberToDeleteId(null);
                }}
                onConfirm={confirmDeleteMember}
                title="Confirm Member Deletion"
                message="Are you sure you want to delete this member? This action cannot be undone."
            />
        </div>
    );
};

export default Members;
