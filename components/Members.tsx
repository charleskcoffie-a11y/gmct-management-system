// components/Members.tsx
import React, { useState, useMemo } from 'react';
import type { Member, Settings, Entry, DevelopmentFundEntry, SyncStatus, User } from '../types';
import { sanitizeString, sanitizeMember, fromCsv } from '../utils';
import MemberModal from './MemberModal';
import MemberProfileModal from './MemberProfileModal';
import { UploadIcon } from './icons';
import { saveMemberToSupabase as saveMemberToSupabaseFn, deleteMemberFromSupabase } from '../services/supabase';
import { useToast } from './ToastProvider';

interface MembersProps {
    members: Member[];
    setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
    settings: Settings;
    // Props needed for profile calculation
    entries?: Entry[];
    developmentEntries?: DevelopmentFundEntry[];
    syncStatus?: SyncStatus;
    currentUser?: User;
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

const Members: React.FC<MembersProps> = ({ members, setMembers, settings, entries = [], developmentEntries = [], syncStatus, currentUser }) => {
    const { showToast, showConfirm } = useToast();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [classFilter, setClassFilter] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [memberStatusFilter, setMemberStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
    const [syncConfirmation, setSyncConfirmation] = useState<{ memberName: string; mode: 'added' | 'updated'; ts: number } | null>(null);
    const [isDuplicatePanelCollapsed, setIsDuplicatePanelCollapsed] = useState(false);
    
    // New State for Profile Modal
    const [viewProfileMember, setViewProfileMember] = useState<Member | null>(null);

    const classOptions = useMemo(() => {
        return ['all', ...Array.from({ length: settings.maxClasses }, (_, i) => String(i + 1))];
    }, [settings.maxClasses]);

    const canManageDuplicateActions = currentUser?.role === 'admin' || currentUser?.role === 'finance-chair' || currentUser?.role === 'finance-team';

    const duplicateGroups = useMemo(() => {
        const byName = new Map<string, Member[]>();
        members
            .filter(member => member.active !== false)
            .forEach(member => {
            const key = sanitizeString(member.name).trim().toLowerCase();
            if (!key) return;
            const group = byName.get(key) || [];
            group.push(member);
            byName.set(key, group);
        });

        return Array.from(byName.entries())
            .filter(([, group]) => group.length > 1)
            .map(([nameKey, group]) => ({
                key: nameKey,
                displayName: group[0]?.name || nameKey,
                members: [...group].sort((a, b) => {
                    const aActive = a.active !== false ? 1 : 0;
                    const bActive = b.active !== false ? 1 : 0;
                    if (aActive !== bActive) return bActive - aActive;
                    return (a.classNumber || '').localeCompare(b.classNumber || '');
                })
            }))
            .sort((a, b) => a.displayName.localeCompare(b.displayName));
    }, [members]);

    const setMemberInactiveFromDuplicate = async (member: Member) => {
        if (!canManageDuplicateActions) {
            showToast('Only Admin or Finance users can set duplicates inactive.', 'warning', 3200);
            return;
        }
        if (member.active === false) {
            showToast('Member is already inactive.', 'info', 2200);
            return;
        }
        if (!settings.supabaseUrl || !settings.supabaseKey || (syncStatus && syncStatus.state !== 'synced')) {
            showToast('Cloud connection is required to update member status.', 'error', 3500);
            return;
        }

        try {
            const result = await saveMemberToSupabaseFn(settings.supabaseUrl, settings.supabaseKey, { ...member, active: false });
            setMembers(prev => prev.map(m => m.id === result.member.id ? result.member : m).sort((a, b) => a.name.localeCompare(b.name)));
            showToast(`Set ${sanitizeString(member.name)} to inactive.`, 'success', 2600);
        } catch (error: any) {
            showToast(`Failed to set inactive: ${error.message || error}`, 'error', 4000);
        }
    };

    const handleImportMembers = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!settings.supabaseUrl || !settings.supabaseKey || (syncStatus && syncStatus.state !== 'synced')) {
            alert('Imports are disabled until connected to the cloud. Please ensure Supabase is configured and the app shows Connected.');
            event.target.value = "";
            return;
        }
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

    const handleSave = async (member: Member) => {
        if (!settings.supabaseUrl || !settings.supabaseKey || (syncStatus && syncStatus.state !== 'synced')) {
            showToast('Writes are disabled until connected to the cloud. Please ensure Supabase is configured and the app shows Connected.', 'error', 4000);
            return;
        }
        
        const isEdit = members.some(m => m.id === member.id);

        try {
            // Save to database and get the updated member back
            const result = await saveMemberToSupabaseFn(settings.supabaseUrl, settings.supabaseKey, member);
            
            // Update local state with the member from database
            if (isEdit) {
                setMembers(prev => prev.map(m => m.id === result.member.id ? result.member : m).sort((a,b) => a.name.localeCompare(b.name)));
            } else {
                setMembers(prev => [...prev, result.member].sort((a,b) => a.name.localeCompare(b.name)));
            }
            
            setSyncConfirmation({ memberName: member.name, mode: isEdit ? 'updated' : 'added', ts: Date.now() });
            showToast(
                `✅ ${member.name} ${isEdit ? 'updated' : 'added'} successfully!`,
                'success',
                3000
            );
        } catch (e: any) {
            showToast(`❌ Save failed: ${e.message || e}`, 'error', 5000);
        }
        
        setIsModalOpen(false);
    };

    // Auto-hide the sync confirmation after a short duration
    React.useEffect(() => {
        if (!syncConfirmation) return;
        const timer = setTimeout(() => setSyncConfirmation(null), 4200);
        return () => clearTimeout(timer);
    }, [syncConfirmation]);
    
    const handleDelete = (id: string) => {
        showConfirm(
            'Are you sure you want to delete this member? This action cannot be undone.',
            () => { void confirmDeleteMember(id); }
        );
    };

    const confirmDeleteMember = async (memberId: string) => {
        if (!settings.supabaseUrl || !settings.supabaseKey || (syncStatus && syncStatus.state !== 'synced')) {
            alert('Deletes are disabled until connected to the cloud. Please ensure Supabase is configured and the app shows Connected.');
            return;
        }
        if (settings.supabaseUrl && settings.supabaseKey) {
            try {
                const result = await deleteMemberFromSupabase(settings.supabaseUrl, settings.supabaseKey, memberId);
                if (result.mode === 'deleted') {
                    setMembers(members.filter(m => m.id !== memberId));
                    showToast('Member deleted successfully.', 'success', 2500);
                } else {
                    setMembers(prev => prev.map(m => (m.id === memberId ? { ...m, active: false } : m)));
                    showToast('Member has linked records and was set to Inactive to preserve history.', 'info', 4200);
                }
            } catch (e: any) {
                alert(`Cloud delete failed. Member was not removed. Details: ${e.message || e}`);
            }
        }
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

            const activeMatch = memberStatusFilter === 'all'
                ? true
                : memberStatusFilter === 'inactive'
                    ? m.active === false
                    : m.active !== false;

            return searchTermMatch && classFilterMatch && activeMatch;
        });
    }, [members, searchTerm, classFilter, memberStatusFilter]);

    const clearFilters = () => {
        setSearchTerm('');
        setClassFilter('all');
        setMemberStatusFilter('active');
    };

    return (
        <div className="pb-12 space-y-8">
            {syncConfirmation && (
                <div className="fixed bottom-6 right-6 z-50 animate-[fadeInUp_0.25s_ease]">
                    <div className="bg-white border border-emerald-200 shadow-2xl rounded-2xl px-4 py-3 flex items-center gap-3 min-w-[280px]">
                        <div className="h-11 w-11 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl font-bold">✓</div>
                        <div className="flex-1">
                            <div className="text-sm font-bold text-emerald-800">Saved & Synced</div>
                            <div className="text-xs text-slate-500">{syncConfirmation.memberName} {syncConfirmation.mode} • {new Date(syncConfirmation.ts).toLocaleTimeString()}</div>
                        </div>
                        <button
                            onClick={() => setSyncConfirmation(null)}
                            className="text-slate-400 hover:text-slate-600 text-lg leading-none px-2"
                            aria-label="Dismiss confirmation"
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-2xl shadow-lg border-2 border-blue-200">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-4 rounded-xl shadow-md">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-4xl font-bold text-slate-800">Member Directory</h2>
                            <p className="text-base text-slate-600 mt-1 font-medium">
                                Manage membership, assign classes, and view giving history
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                        <button 
                            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                            className="bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl hover:scale-105 flex items-center gap-2 text-base"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                {viewMode === 'grid' ? (
                                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                                ) : (
                                    <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                )}
                            </svg>
                            {viewMode === 'grid' ? 'List View' : 'Grid View'}
                        </button>
                        <label className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-3 px-6 rounded-xl cursor-pointer inline-flex items-center gap-2 transition-all shadow-lg hover:shadow-xl hover:scale-105 text-base">
                            <UploadIcon />
                            <span>Import CSV</span>
                            <input type="file" accept=".csv" className="hidden" onChange={handleImportMembers} />
                        </label>
                        <button 
                            onClick={() => { if (syncStatus?.state === 'synced' && settings.supabaseUrl && settings.supabaseKey) { setSelectedMember(null); setIsModalOpen(true); } }} 
                            disabled={!(syncStatus?.state === 'synced' && settings.supabaseUrl && settings.supabaseKey)}
                            title={!(syncStatus?.state === 'synced' && settings.supabaseUrl && settings.supabaseKey) ? 'Connect to Supabase to add members' : ''}
                            className={`bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all flex items-center gap-2 text-base ${!(syncStatus?.state === 'synced' && settings.supabaseUrl && settings.supabaseKey) ? 'opacity-60 cursor-not-allowed' : 'hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl hover:scale-105'}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                            </svg>
                            Add Member
                        </button>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-6 rounded-2xl shadow-lg border-2 border-slate-200">
                <div className="flex items-center gap-3 mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                    </svg>
                    <h3 className="text-xl font-bold text-slate-800">Filter Members</h3>
                </div>
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-grow">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <input 
                            type="text"
                            placeholder="Search by name, member number, or class..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="block w-full border-2 border-slate-300 rounded-xl py-3 px-4 pl-12 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                        />
                    </div>
                    <div className="w-full md:w-72">
                        <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
                                </svg>
                            </div>
                            <select
                                value={classFilter}
                                onChange={e => setClassFilter(e.target.value)}
                                className="block w-full border-2 border-slate-300 rounded-xl py-3 px-4 pl-12 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base font-semibold appearance-none bg-white"
                            >
                                <option value="all">All Classes</option>
                                {classOptions.slice(1).map(cls => (
                                    <option key={cls} value={cls}>Class {cls}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    {(searchTerm || classFilter !== 'all' || memberStatusFilter !== 'active') && (
                        <button 
                            onClick={clearFilters}
                            className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-3 px-6 rounded-xl transition-all hover:scale-105 shadow-lg flex items-center gap-2 text-base"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            Clear
                        </button>
                    )}
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                        </svg>
                        <span className="text-base text-slate-600">
                            Showing <span className="font-bold text-blue-600 text-lg">{filteredMembers.length}</span> of <span className="font-bold text-slate-900">{members.length}</span> member{members.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <div className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                        <span className="font-bold text-slate-800">Status</span>
                        <select
                            value={memberStatusFilter}
                            onChange={e => setMemberStatusFilter(e.target.value as 'active' | 'inactive' | 'all')}
                            className="border border-slate-300 rounded-lg py-1.5 px-2.5 text-sm font-semibold bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="active">Active only</option>
                            <option value="inactive">Inactive only</option>
                            <option value="all">Active + Inactive</option>
                        </select>
                    </div>
                </div>
            </div>

            {duplicateGroups.length > 0 && (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 shadow-lg">
                    <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                        <h3 className="text-xl font-bold text-amber-900">Potential Duplicates ({duplicateGroups.length} groups)</h3>
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-amber-800">Review and keep only one active member per person</span>
                            <button
                                onClick={() => setIsDuplicatePanelCollapsed(prev => !prev)}
                                className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg"
                            >
                                {isDuplicatePanelCollapsed ? 'Expand' : 'Collapse'}
                            </button>
                        </div>
                    </div>
                    {!isDuplicatePanelCollapsed && (
                    <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                        {duplicateGroups.map(group => (
                            <div key={group.key} className="bg-white border border-amber-200 rounded-xl p-4">
                                <div className="font-bold text-slate-900 mb-2">{sanitizeString(group.displayName)} ({group.members.length})</div>
                                <div className="space-y-2">
                                    {group.members.map(member => (
                                        <div key={member.id} className="flex items-center justify-between gap-3 border border-slate-200 rounded-lg px-3 py-2">
                                            <div className="text-sm text-slate-700">
                                                <span className="font-semibold">Class {member.classNumber || '-'}</span>
                                                <span className="mx-2">•</span>
                                                <span>ID {member.id.substring(0, 8)}</span>
                                                <span className={`ml-3 px-2 py-0.5 rounded-full text-xs font-bold ${member.active === false ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                    {member.active === false ? 'Inactive' : 'Active'}
                                                </span>
                                            </div>
                                            {canManageDuplicateActions && member.active !== false && (
                                                <button
                                                    onClick={() => setMemberInactiveFromDuplicate(member)}
                                                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg"
                                                >
                                                    Set Inactive
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    )}
                </div>
            )}

            {/* Grid View */}
            {viewMode === 'grid' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                    {filteredMembers.map(member => {
                        const colors = getColorForClass(member.classNumber);
                        return (
                            <div 
                                key={member.id} 
                                className={`bg-gradient-to-br ${colors.gradient} rounded-lg shadow-md hover:shadow-lg transition-all hover:scale-105 p-3 text-white group border border-white/20`}
                            >
                                {/* Avatar Circle */}
                                <div className="flex items-start justify-between mb-2">
                                    <div className="w-10 h-10 rounded-full bg-white/30 backdrop-blur flex items-center justify-center text-lg font-bold shadow-sm">
                                        {sanitizeString(member.name).charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <div className={`${colors.badge} font-bold text-[10px] px-2 py-0.5 rounded-full shadow-sm`}>
                                            C{member.classNumber || '-'}
                                        </div>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full shadow-sm font-bold ${member.active === false ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                            {member.active === false ? 'Inactive' : 'Active'}
                                        </span>
                                    </div>
                                </div>

                                {/* Member Info */}
                                <div className="mb-2">
                                    <h3 className="text-sm font-bold mb-0.5 truncate drop-shadow">{sanitizeString(member.name)}</h3>
                                    {member.memberNumber && (
                                        <p className="text-xs text-white/90 font-medium">#{sanitizeString(member.memberNumber)}</p>
                                    )}
                                    {member.email && (
                                        <p className="text-[10px] text-white/90 truncate">📧 {sanitizeString(member.email)}</p>
                                    )}
                                    {member.profession && (
                                        <p className="text-[10px] text-white/90 truncate">💼 {sanitizeString(member.profession)}</p>
                                    )}
                                    {member.dayBorn && (
                                        <p className="text-[10px] text-white/90">📅 {sanitizeString(member.dayBorn)}</p>
                                    )}
                                    <p className="text-[10px] text-white/70 font-mono">ID: {member.id.substring(0, 6)}</p>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-1 pt-2 border-t border-white/30">
                                    <button 
                                        onClick={() => setViewProfileMember(member)} 
                                        className="flex-1 bg-white/25 hover:bg-white/40 text-white font-semibold py-1.5 rounded transition-all text-xs shadow-sm hover:shadow hover:scale-105 flex items-center justify-center"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                    <button 
                                        onClick={() => { setSelectedMember(member); setIsModalOpen(true); }} 
                                        className="flex-1 bg-white/25 hover:bg-white/40 text-white font-semibold py-1.5 rounded transition-all text-xs shadow-sm hover:shadow hover:scale-105 flex items-center justify-center"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                        </svg>
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(member.id)} 
                                        className="bg-red-500/40 hover:bg-red-600/60 text-white font-semibold py-1.5 px-1.5 rounded transition-all text-xs shadow-sm hover:shadow hover:scale-105 flex items-center justify-center"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
                <div className="bg-white rounded-2xl shadow-xl border-2 border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                        <table className="w-full text-left">
                            <thead className="text-lg font-bold text-white sticky top-0 z-10">
                                <tr className="bg-gradient-to-r from-blue-600 to-indigo-600">
                                    <th className="px-8 py-5">
                                        <div className="flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                            </svg>
                                            Member
                                        </div>
                                    </th>
                                    <th className="px-8 py-5">
                                        <div className="flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
                                            </svg>
                                            Class
                                        </div>
                                    </th>
                                    <th className="px-8 py-5">
                                        <div className="flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                                            </svg>
                                            Member #
                                        </div>
                                    </th>
                                    <th className="px-8 py-5">
                                        <div className="flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M2.94 6.94a2.5 2.5 0 013.54 0L10 10.46l3.52-3.52a2.5 2.5 0 113.54 3.54l-5.26 5.26a3 3 0 01-4.24 0L2.94 10.48a2.5 2.5 0 010-3.54z" />
                                            </svg>
                                            Email
                                        </div>
                                    </th>
                                    <th className="px-8 py-5">
                                        <div className="flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M2 3a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-.293.707L4.414 7.414a13.97 13.97 0 006.172 6.172l1.707-1.293A1 1 0 0113 12h2a1 1 0 011 1v2a1 1 0 01-1 1h-2C5.477 16 0 10.523 0 4V3a1 1 0 011-1z" clipRule="evenodd" />
                                            </svg>
                                            Phone
                                        </div>
                                    </th>
                                    <th className="px-8 py-5">
                                        <div className="flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 00-1-1H6zm8 3H6V3h8v2z" />
                                            </svg>
                                            Profession
                                        </div>
                                    </th>
                                    <th className="px-8 py-5">
                                        <div className="flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M6 2a1 1 0 011-1h6a1 1 0 011 1v3h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1h3V2zm1 4V3h6v3H7z" clipRule="evenodd" />
                                            </svg>
                                            Birthday
                                        </div>
                                    </th>
                                    <th className="px-8 py-5">Status</th>
                                    <th className="px-8 py-5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredMembers.map((member, idx) => (
                                    <tr 
                                        key={member.id} 
                                        className={`${idx % 2 === 0 ? 'bg-blue-50/50' : 'bg-white'} border-b border-slate-200 hover:bg-blue-100/50 transition-colors`}
                                    >
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getColorForClass(member.classNumber).gradient} flex items-center justify-center text-white font-bold text-lg shadow-md`}>
                                                    {sanitizeString(member.name).charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 text-base">{sanitizeString(member.name)}</p>
                                                    <p className="text-sm text-slate-500 font-mono">ID: {member.id.substring(0, 8)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className={`${getColorForClass(member.classNumber).badge} font-bold px-4 py-2 rounded-full text-base shadow-sm`}>
                                                Class {member.classNumber || '-'}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-slate-800 font-semibold text-base">{sanitizeString(member.memberNumber) || '-'}</td>
                                        <td className="px-8 py-5 text-slate-800 text-base">{sanitizeString(member.email) || '-'}</td>
                                        <td className="px-8 py-5 text-slate-800 text-base">{sanitizeString(member.phone) || '-'}</td>
                                        <td className="px-8 py-5 text-slate-800 text-base">{sanitizeString(member.profession) || '-'}</td>
                                        <td className="px-8 py-5 text-slate-800 text-base">
                                            <div>
                                                <div className="font-semibold">
                                                    {(() => {
                                                        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                                                        const m = member.dobMonth;
                                                        const d = member.dobDay;
                                                        return m && d ? `${months[m-1]} ${d}` : '-';
                                                    })()}
                                                </div>
                                                {member.dayBorn && (
                                                    <div className="text-xs text-slate-500">({sanitizeString(member.dayBorn)})</div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className={`px-3 py-1 rounded-full text-sm font-bold ${member.active === false ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                {member.active === false ? 'Inactive' : 'Active'}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    onClick={() => setViewProfileMember(member)} 
                                                    className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-4 py-2 rounded-lg transition-all hover:scale-105 shadow-md flex items-center gap-2 text-sm"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                                    </svg>
                                                    Profile
                                                </button>
                                                <button 
                                                    onClick={() => { setSelectedMember(member); setIsModalOpen(true); }} 
                                                    className="bg-purple-500 hover:bg-purple-600 text-white font-bold px-4 py-2 rounded-lg transition-all hover:scale-105 shadow-md flex items-center gap-2 text-sm"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                                    </svg>
                                                    Edit
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(member.id)} 
                                                    className="bg-red-500 hover:bg-red-600 text-white font-bold px-3 py-2 rounded-lg transition-all hover:scale-105 shadow-md"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                    </svg>
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
                <div className="text-center py-20 bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl border-2 border-slate-200">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 mx-auto mb-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-3xl font-bold text-slate-800 mb-3">No Members Found</p>
                    <p className="text-lg text-slate-600 mb-6">Try adjusting your search or filters</p>
                    {(searchTerm || classFilter !== 'all' || memberStatusFilter !== 'active') && (
                        <button 
                            onClick={clearFilters}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 inline-flex items-center gap-2 text-base"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            Clear Filters
                        </button>
                    )}
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
        </div>
    );
};

export default Members;
