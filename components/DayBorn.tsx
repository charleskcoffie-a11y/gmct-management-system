// components/DayBorn.tsx
import React, { useState, useMemo } from 'react';
import type { Member, Entry, Settings, User, SyncStatus, MonthLock } from '../types';
import { saveEntryToSupabase, markEntryAsDeletedInSupabase, logEntryDeletionToSupabase } from '../services/supabase';
import EntryModal from './EntryModal';
import BulkDayBornModal from './BulkDayBornModal';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from './ToastProvider';
import { getTodayEST, getNowEST, isEntryWindowOpen } from '../utils';

interface DayBornProps {
    members: Member[];
    entries: Entry[];
    setEntries: React.Dispatch<React.SetStateAction<Entry[]>>;
    settings: Settings;
    currentUser?: User | null;
    monthLocks?: MonthLock[];
    syncStatus?: SyncStatus;
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DayBorn: React.FC<DayBornProps> = ({ members, entries, setEntries, settings, currentUser, monthLocks = [], syncStatus }) => {
    const { showToast } = useToast();
    const [selectedDay, setSelectedDay] = useState<string>('Sunday');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
    const [filterDate, setFilterDate] = useState<string>('');
    const [showDeleted, setShowDeleted] = useState(false);
    
    // Delete state
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleteReason, setDeleteReason] = useState('');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    // Filter members by selected day of the week
    const filteredMembers = useMemo(() => {
        return members.filter(m => m.dayBorn === selectedDay && m.active);
    }, [members, selectedDay]);

    // Get entries for filtered members for the day-born type
    const dayBornEntries = useMemo(() => {
        return entries.filter(e => {
            if (e.type !== 'day-born') return false;
            if (!filteredMembers.some(m => m.id === e.memberID)) return false;
            if (e.deleted && !showDeleted) return false;
            return true;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [entries, filteredMembers, showDeleted]);

    const dateFilteredEntries = useMemo(() => {
        if (!filterDate) return dayBornEntries;
        const target = new Date(filterDate).toISOString().split('T')[0];
        return dayBornEntries.filter(entry => entry.date === target);
    }, [dayBornEntries, filterDate]);

    const isDateFiltered = Boolean(filterDate);

    const handleAddEntry = () => {
        const newEntry: Entry = {
            id: uuidv4(),
            date: getTodayEST(),
            memberID: '',
            memberName: '',
            type: 'day-born',
            fund: 'General',
            method: 'cash',
            amount: 0,
            createdBy: currentUser?.username
        };
        setSelectedEntry(newEntry);
        setIsModalOpen(true);
    };

    const handleEditEntry = (entry: Entry) => {
        setSelectedEntry(entry);
        setIsModalOpen(true);
    };

    const canCloudSave = Boolean(settings.supabaseUrl && settings.supabaseKey);

    const requireCloud = () => {
        if (!canCloudSave) {
            showToast('❌ Supabase is not configured. Cannot save Day Born entries locally.', 'error', 4000);
            return false;
        }
        return true;
    };

    const persistEntry = async (entry: Entry) => {
        if (!canCloudSave) throw new Error('Supabase not configured');
        await saveEntryToSupabase(settings.supabaseUrl, settings.supabaseKey, entry);
    };

    const handleSaveEntry = async (entry: Entry) => {
        if (!requireCloud()) return;
        try {
            await persistEntry(entry);
            const newEntries = [...entries];
            const index = newEntries.findIndex(e => e.id === entry.id);
            if (index > -1) {
                newEntries[index] = entry;
            } else {
                newEntries.push(entry);
            }
            setEntries(newEntries);
            setIsModalOpen(false);
            showToast(`✅ Entry saved successfully!`, 'success', 3000);
        } catch (error: any) {
            showToast(`❌ Failed to save entry: ${error.message}`, 'error', 5000);
        }
    };

    const handleSaveAndNew = async (entry: Entry) => {
        if (!requireCloud()) return;
        try {
            await persistEntry(entry);
            const newEntries = [...entries, entry];
            setEntries(newEntries);
            showToast(`✅ Entry saved! Ready for next entry.`, 'success', 2000);
            // Reset for new entry
            const nextEntry: Entry = {
                id: uuidv4(),
                date: getTodayEST(),
                memberID: '',
                memberName: '',
                type: 'day-born',
                fund: 'General',
                method: 'cash',
                amount: 0,
                createdBy: currentUser?.username
            };
            setSelectedEntry(nextEntry);
        } catch (error: any) {
            showToast(`❌ Failed to save entry: ${error.message}`, 'error', 5000);
        }
    };

    const handleDeleteEntry = (id: string) => {
        if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'finance-chair')) {
            alert('Only admins or finance chairs can delete entries.');
            return;
        }
        setDeleteId(id);
        setDeleteReason('');
        setDeleteError('');
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!deleteId) return;
        if (!settings.supabaseUrl || !settings.supabaseKey || syncStatus?.state !== 'synced') {
            setDeleteError('Writes are disabled until connected to the cloud.');
            return;
        }

        const entry = entries.find(e => e.id === deleteId);
        if (!entry) {
            setDeleteError('Entry not found');
            return;
        }

        try {
            // Mark as deleted in Supabase
            await markEntryAsDeletedInSupabase(settings.supabaseUrl, settings.supabaseKey, deleteId);
            
            // Log the deletion
            await logEntryDeletionToSupabase(
                settings.supabaseUrl,
                settings.supabaseKey,
                {
                    id: deleteId,
                    reason: deleteReason,
                    deletedBy: (typeof currentUser === 'object' && currentUser?.username) ? currentUser.username : 'Unknown',
                    deletedAt: getNowEST(),
                }
            );

            // Update local state
            setEntries(prev => prev.map(e => e.id === deleteId ? {
                ...e,
                deleted: true,
                deletedReason: deleteReason,
                deletedBy: (typeof currentUser === 'object' && currentUser?.username) ? currentUser.username : 'Unknown',
            } : e));

            showToast('Entry deleted successfully', 'success');
            setShowDeleteModal(false);
            setDeleteId(null);
            setDeleteReason('');
        } catch (error: any) {
            setDeleteError(`Failed to delete: ${error.message}`);
        }
    };

    const cancelDelete = () => {
        setShowDeleteModal(false);
        setDeleteId(null);
        setDeleteReason('');
        setDeleteError('');
    };

    const handleBulkSave = async (newEntries: Entry[]) => {
        if (!requireCloud()) return;
        try {
            await Promise.all(newEntries.map(e => persistEntry(e)));
            const updatedEntries = [...entries, ...newEntries];
            setEntries(updatedEntries);
            setIsBulkModalOpen(false);
            showToast(`✅ ${newEntries.length} entries created successfully!`, 'success', 3000);
        } catch (err: any) {
            showToast(`❌ Bulk save failed in cloud: ${err.message || err}`, 'error', 5000);
        }
    };

    return (
        <div className="p-6 bg-gradient-to-br from-purple-50 to-indigo-50 min-h-screen">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
                        <span className="text-3xl">🗓️</span> Day Born Offerings
                    </h1>
                    <p className="text-gray-600 mt-2">Record offerings from members on their day of birth</p>
                </div>

                {/* Day of Week Filter */}
                <div className="bg-white rounded-xl shadow-md p-6 mb-8 border-2 border-purple-200">
                    <label className="block text-sm font-bold text-gray-700 mb-4">
                        📅 Select Day of Week:
                    </label>
                    <div className="grid grid-cols-7 gap-2">
                        {DAYS_OF_WEEK.map(day => (
                            <button
                                key={day}
                                onClick={() => setSelectedDay(day)}
                                className={`py-3 px-2 rounded-lg font-semibold transition-all text-sm ${
                                    selectedDay === day
                                        ? 'bg-purple-600 text-white shadow-lg scale-105'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                {day.slice(0, 3)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Members Count and Add Button */}
                <div className="bg-white rounded-xl shadow-md p-6 mb-8 border-2 border-purple-200">
                    <div className="flex justify-between items-center flex-wrap gap-4">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="bg-gradient-to-br from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-lg">
                                    {selectedDay}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900">
                                        {filteredMembers.length} Members
                                    </h2>
                                    <p className="text-gray-600 text-sm">
                                        Active members born on {selectedDay}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            {(() => {
                                const allowedRoles = ['admin','finance-chair','finance-team','data-entry'];
                                const canSee = currentUser && allowedRoles.includes(currentUser.role);
                                const windowStatus = isEntryWindowOpen(settings.entryWindow);
                                const canOverride = currentUser?.role === 'admin' || currentUser?.role === 'finance-chair';
                                const disabled = (!windowStatus.isOpen && !canOverride);
                                const title = (!windowStatus.isOpen && !canOverride) ? `${windowStatus.reason}. ${windowStatus.nextOpenTime}` : undefined;
                                return canSee ? (
                                    <>
                                        <button
                                            onClick={() => setIsBulkModalOpen(true)}
                                            disabled={disabled}
                                            title={title}
                                            className={`px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold rounded-lg shadow-lg transition-all ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:from-blue-700 hover:to-cyan-700 hover:shadow-xl'}`}
                                        >
                                            📊 Bulk Entry
                                        </button>
                                        <button
                                            onClick={handleAddEntry}
                                            disabled={disabled}
                                            title={title}
                                            className={`px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-lg shadow-lg transition-all ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:from-purple-700 hover:to-indigo-700 hover:shadow-xl'}`}
                                        >
                                            ➕ Add Entry
                                        </button>
                                    </>
                                ) : null;
                            })()}
                        </div>
                    </div>
                </div>

                {/* Members List and Recent Entries */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Members List */}
                    <div className="flex flex-col bg-white rounded-xl shadow-lg border-2 border-purple-200 overflow-hidden max-h-[70vh]">
                        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6">
                            <h3 className="text-xl font-bold text-white">👥 Members ({filteredMembers.length})</h3>
                        </div>
                        {filteredMembers.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center py-12">
                                <p className="text-gray-500 text-center">No members born on {selectedDay}</p>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                <div className="p-4 space-y-2">
                                    {filteredMembers.sort((a, b) => a.name.localeCompare(b.name)).map(member => (
                                        <div
                                            key={member.id}
                                            className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border-2 border-purple-100 hover:border-purple-400 hover:shadow-md transition-all"
                                        >
                                            <div className="font-semibold text-gray-900">{member.name}</div>
                                            <div className="text-sm text-gray-600 mt-1">📚 Class {member.classNumber || 'N/A'}</div>
                                            {member.memberNumber && (
                                                <div className="text-xs text-gray-500 mt-1">🆔 #{member.memberNumber}</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Recent Entries */}
                    <div className="flex flex-col bg-white rounded-xl shadow-lg border-2 border-green-200 overflow-hidden max-h-[70vh]">
                        <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <h3 className="text-xl font-bold text-white">💰 Recent Entries ({dateFilteredEntries.length})</h3>
                                {isDateFiltered && (
                                    <span className="text-xs bg-white/20 text-white px-2 py-1 rounded-full">
                                        Filtered{dateFilteredEntries.length !== dayBornEntries.length ? ` of ${dayBornEntries.length}` : ''}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="p-4 border-b border-green-100 bg-green-50/50">
                            <div className="flex flex-wrap items-end gap-3">
                                <div className="flex flex-col">
                                    <label className="text-xs font-semibold text-gray-700">Filter date</label>
                                    <input
                                        type="date"
                                        value={filterDate}
                                        onChange={e => setFilterDate(e.target.value)}
                                        className="border border-green-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                                    />
                                </div>
                                {isDateFiltered && (
                                    <button
                                        onClick={() => setFilterDate('')}
                                        className="ml-auto px-4 py-2 text-sm font-semibold text-green-700 bg-white border border-green-200 rounded-md hover:bg-green-50"
                                    >
                                        Clear
                                    </button>
                                )}
                                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                    <input type="checkbox" checked={showDeleted} onChange={e => setShowDeleted(e.target.checked)} className="rounded border-red-300 text-red-600 focus:ring-red-500"/>
                                    🗑️ Show Deleted
                                </label>
                            </div>
                        </div>
                        {dateFilteredEntries.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center py-12">
                                <p className="text-gray-500 text-center">
                                    {isDateFiltered ? 'No entries for the selected date' : `No entries yet for ${selectedDay}`}
                                </p>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                <div className="p-4 space-y-2">
                                    {dateFilteredEntries.map(entry => (
                                        <div
                                            key={entry.id}
                                            onClick={() => handleEditEntry(entry)}
                                            className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-100 hover:border-green-400 hover:shadow-md cursor-pointer transition-all"
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-semibold text-gray-900">{entry.memberName}</div>
                                                    <div className="text-sm text-gray-600 mt-1">📅 {entry.date}</div>
                                                    <div className="text-xs text-gray-500 mt-1">Created by: {entry.createdBy || 'Unknown'}{entry.updatedBy ? ` | Updated by: ${entry.updatedBy}` : ''}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-bold text-green-700 text-lg">
                                                        {entry.amount.toFixed(2)}
                                                    </div>
                                                    <div className="text-xs text-gray-500 capitalize mt-1">💳 {entry.method}</div>
                                                </div>
                                            </div>
                                            {entry.note && (
                                                <div className="text-xs text-gray-600 mt-2 pt-2 border-t border-green-200">📝 {entry.note}</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Entry Modal */}
            {isModalOpen && selectedEntry && (
                <EntryModal
                    entry={selectedEntry}
                    existingEntries={dayBornEntries}
                    members={filteredMembers}
                    settings={settings}
                    currentUser={currentUser}
                    monthLocks={monthLocks}
                    onSave={handleSaveEntry}
                    onSaveAndNew={handleSaveAndNew}
                    onClose={() => setIsModalOpen(false)}
                    onDelete={handleDeleteEntry}
                    lockedType={true}
                    selectedDay={selectedDay}
                />
            )}

            {/* Bulk Entry Modal */}
            {isBulkModalOpen && (
                <BulkDayBornModal
                    members={filteredMembers}
                    settings={settings}
                    selectedDay={selectedDay}
                    onSave={handleBulkSave}
                    onClose={() => setIsBulkModalOpen(false)}
                />
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                        <h2 className="text-xl font-bold text-red-700 mb-4">Delete Entry</h2>
                        
                        <p className="text-slate-600 mb-4">Are you sure you want to delete this day-born entry? This action is permanent.</p>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Reason for Deletion (Optional)</label>
                            <textarea
                                value={deleteReason}
                                onChange={e => setDeleteReason(e.target.value)}
                                rows={3}
                                placeholder="Enter reason for deletion..."
                                className="w-full border-2 border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-red-400 focus:border-red-400"
                            />
                        </div>

                        {deleteError && (
                            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3 mb-4">
                                <p className="text-red-700 text-sm font-semibold">{deleteError}</p>
                            </div>
                        )}

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={cancelDelete}
                                className="px-4 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-300 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DayBorn;
