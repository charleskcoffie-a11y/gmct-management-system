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

const colorGradients = [
    'from-blue-200 to-blue-400',
    'from-purple-200 to-purple-400',
    'from-pink-200 to-pink-400',
    'from-green-200 to-green-400',
    'from-amber-200 to-amber-400',
    'from-rose-200 to-rose-400',
    'from-indigo-200 to-indigo-400',
    'from-teal-200 to-teal-400',
];

const badgeColors = [
    'bg-blue-50 text-blue-600',
    'bg-purple-50 text-purple-600',
    'bg-pink-50 text-pink-600',
    'bg-green-50 text-green-600',
    'bg-amber-50 text-amber-600',
    'bg-rose-50 text-rose-600',
    'bg-indigo-50 text-indigo-600',
    'bg-teal-50 text-teal-600',
];

const getColorForClass = (classNumber: string | undefined) => {
    if (!classNumber) return { gradient: 'from-slate-200 to-slate-400', badge: 'bg-slate-50 text-slate-600' };
    const classNum = parseInt(classNumber) || 0;
    const index = (classNum - 1) % colorGradients.length;
    return { gradient: colorGradients[index], badge: badgeColors[index] };
};

const Members: React.FC<MembersProps> = ({ members, setMembers, settings, entries = [], developmentEntries = [] }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [classFilter, setClassFilter] = useState<string>('all');
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [memberToDeleteId, setMemberToDeleteId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    
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
        <div className="pb-12 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-4xl font-bold bg-gradient-to-r from-slate-700 to-slate-800 bg-clip-text text-transparent">👥 Member Directory</h2>
                    <p className="text-sm text-slate-600 mt-2">
                        Manage membership, assign classes, and view giving history.
                    </p>
                </div>
                <div className="flex gap-3 flex-wrap">
                    <button 
                        onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                        className="bg-slate-400 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded-lg transition-all shadow-md hover:shadow-lg"
                    >
                        {viewMode === 'grid' ? '📋 List' : '🎴 Grid'}
                    </button>
                    <label className="bg-amber-400 hover:bg-amber-500 text-white font-bold py-2 px-4 rounded-lg cursor-pointer inline-flex items-center gap-2 transition-all shadow-md hover:shadow-lg">
                        <UploadIcon />
                        <span className="hidden sm:inline">Import</span>
                        <input type="file" accept=".csv" className="hidden" onChange={handleImportMembers} />
                    </label>
                    <button onClick={() => { setSelectedMember(null); setIsModalOpen(true); }} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all hover:scale-105">
                        ➕ Add Member
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-slate-100 p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-grow">
                        <span className="absolute left-3 top-3 text-slate-400">🔍</span>
                        <input 
                            type="text"
                            placeholder="Search Name, Member #, or Class..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="block w-full border-2 border-slate-300 rounded-lg py-3 px-4 pl-10 focus:ring-2 focus:ring-slate-400 focus:border-transparent text-base"
                        />
                    </div>
                    <div className="w-full md:w-64">
                        <select
                            value={classFilter}
                            onChange={e => setClassFilter(e.target.value)}
                            className="block w-full border-2 border-slate-300 rounded-lg py-3 px-4 focus:ring-2 focus:ring-slate-400 focus:border-transparent text-base font-semibold"
                        >
                             <option value="all">📚 All Classes</option>
                            {classOptions.slice(1).map(cls => (
                                <option key={cls} value={cls}>📚 Class {cls}</option>
                            ))}
                        </select>
                    </div>
                    {(searchTerm || classFilter !== 'all') && (
                        <button 
                            onClick={clearFilters}
                            className="bg-red-200 hover:bg-red-300 text-red-700 font-bold py-2 px-4 rounded-lg transition-colors"
                        >
                            ✕ Clear
                        </button>
                    )}
                </div>
                
                <div className="text-sm text-slate-600 pl-1">
                    <span className="font-bold text-slate-900 text-lg">{filteredMembers.length}</span> member{filteredMembers.length !== 1 ? 's' : ''} found
                </div>
            </div>

            {/* Grid View */}
            {viewMode === 'grid' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredMembers.map(member => {
                        const colors = getColorForClass(member.classNumber);
                        return (
                            <div 
                                key={member.id} 
                                className={`bg-gradient-to-br ${colors.gradient} rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 p-6 text-white group`}
                            >
                                {/* Avatar Circle */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-3xl font-bold">
                                        {sanitizeString(member.name).charAt(0).toUpperCase()}
                                    </div>
                                    <div className={`${colors.badge} font-bold text-xs px-3 py-1 rounded-full`}>
                                        Class {member.classNumber || '-'}
                                    </div>
                                </div>

                                {/* Member Info */}
                                <div className="mb-4">
                                    <h3 className="text-xl font-bold mb-1 truncate">{sanitizeString(member.name)}</h3>
                                    {member.memberNumber && (
                                        <p className="text-sm text-white/80">Member #: {sanitizeString(member.memberNumber)}</p>
                                    )}
                                    <p className="text-xs text-white/70 font-mono mt-1">ID: {member.id.substring(0, 8)}</p>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 pt-4 border-t border-white/20">
                                    <button 
                                        onClick={() => setViewProfileMember(member)} 
                                        className="flex-1 bg-white/20 hover:bg-white/30 text-white font-bold py-2 rounded-lg transition-all text-sm"
                                    >
                                        👤 Profile
                                    </button>
                                    <button 
                                        onClick={() => { setSelectedMember(member); setIsModalOpen(true); }} 
                                        className="flex-1 bg-white/20 hover:bg-white/30 text-white font-bold py-2 rounded-lg transition-all text-sm"
                                    >
                                        ✏️ Edit
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(member.id)} 
                                        className="flex-1 bg-red-400/30 hover:bg-red-500/50 text-white font-bold py-2 rounded-lg transition-all text-sm"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
                <div className="bg-white rounded-xl shadow-lg border border-slate-200/80 overflow-hidden">
                    <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                        <table className="w-full text-left">
                            <thead className="text-base font-bold text-white sticky top-0 z-10">
                                <tr className="bg-slate-600">
                                    <th className="px-6 py-4">Member</th>
                                    <th className="px-6 py-4">Class</th>
                                    <th className="px-6 py-4">Member #</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredMembers.map((member, idx) => (
                                    <tr 
                                        key={member.id} 
                                        className={`${idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'} border-b hover:bg-blue-50 transition-colors`}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getColorForClass(member.classNumber).gradient} flex items-center justify-center text-white font-bold`}>
                                                    {sanitizeString(member.name).charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900">{sanitizeString(member.name)}</p>
                                                    <p className="text-xs text-slate-500 font-mono">{member.id.substring(0, 8)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`${getColorForClass(member.classNumber).badge} font-bold px-3 py-1 rounded-full text-sm`}>
                                                Class {member.classNumber || '-'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-800 font-medium">{sanitizeString(member.memberNumber) || '-'}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    onClick={() => setViewProfileMember(member)} 
                                                    className="font-bold text-blue-600 hover:bg-blue-100 px-3 py-1 rounded transition-colors"
                                                >
                                                    👤
                                                </button>
                                                <button 
                                                    onClick={() => { setSelectedMember(member); setIsModalOpen(true); }} 
                                                    className="font-bold text-purple-600 hover:bg-purple-100 px-3 py-1 rounded transition-colors"
                                                >
                                                    ✏️
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(member.id)} 
                                                    className="font-bold text-red-600 hover:bg-red-100 px-3 py-1 rounded transition-colors"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {filteredMembers.length === 0 && (
                <div className="text-center py-16">
                    <div className="text-6xl mb-4">🔍</div>
                    <p className="text-2xl font-bold text-slate-900 mb-2">No members found</p>
                    <p className="text-slate-600">Try adjusting your search or filters</p>
                </div>
            )}

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
