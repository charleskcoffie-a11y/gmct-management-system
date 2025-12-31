// components/DayBorn.tsx
import React, { useState, useMemo } from 'react';
import type { Member, Entry, Settings, User, SyncStatus, MonthLock } from '../types';
import { saveEntryToSupabase } from '../services/supabase';
import EntryModal from './EntryModal';
import BulkDayBornModal from './BulkDayBornModal';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from './ToastProvider';

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

    // Filter members by selected day of the week
    const filteredMembers = useMemo(() => {
        return members.filter(m => m.dayBorn === selectedDay && m.active);
    }, [members, selectedDay]);

    // Get entries for filtered members for the day-born type
    const dayBornEntries = useMemo(() => {
        return entries.filter(e => 
            e.type === 'day-born' && 
            filteredMembers.some(m => m.id === e.memberID) &&
            !e.deleted
        ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [entries, filteredMembers]);

    const dateFilteredEntries = useMemo(() => {
        if (!filterDate) return dayBornEntries;
        const target = new Date(filterDate).toISOString().split('T')[0];
        return dayBornEntries.filter(entry => entry.date === target);
    }, [dayBornEntries, filterDate]);

    const isDateFiltered = Boolean(filterDate);

    const handleAddEntry = () => {
        const newEntry: Entry = {
            id: uuidv4(),
            date: new Date().toISOString().split('T')[0],
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
                date: new Date().toISOString().split('T')[0],
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

    const handleDeleteEntry = async (id: string) => {
        if (!requireCloud()) return;
        const updatedEntries = entries.map(e => 
            e.id === id ? { ...e, deleted: true, updatedBy: currentUser?.username } : e
        );
        const deletedEntry = updatedEntries.find(e => e.id === id);
        try {
            if (deletedEntry) await persistEntry(deletedEntry);
            setEntries(updatedEntries);
            showToast(`✅ Entry deleted`, 'success', 2000);
        } catch (err: any) {
            showToast(`❌ Failed to delete entry in cloud: ${err.message || err}`, 'error', 5000);
        }
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
                            <button
                                onClick={() => setIsBulkModalOpen(true)}
                                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all"
                            >
                                📊 Bulk Entry
                            </button>
                            <button
                                onClick={handleAddEntry}
                                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all"
                            >
                                ➕ Add Entry
                            </button>
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
        </div>
    );
};

export default DayBorn;
