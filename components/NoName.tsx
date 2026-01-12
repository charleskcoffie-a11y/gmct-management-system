import React, { useState, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { NoNameEntry, Settings, User, SyncStatus } from '../types';
import { formatCurrency, getTodayEST } from '../utils';

interface NoNameProps {
    entries: NoNameEntry[];
    setEntries: React.Dispatch<React.SetStateAction<NoNameEntry[]>>;
    settings: Settings;
    currentUser: User;
    syncStatus?: SyncStatus;
}

const NoName: React.FC<NoNameProps> = ({ entries, setEntries, settings, currentUser, syncStatus }) => {
    const [newAmount, setNewAmount] = useState('');
    const [newDate, setNewDate] = useState(getTodayEST());
    const [newNotes, setNewNotes] = useState('');
    const [showToast, setShowToast] = useState(false);
    const [toastMsg, setToastMsg] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editAmount, setEditAmount] = useState('');
    const [editDate, setEditDate] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [lastDeleted, setLastDeleted] = useState<NoNameEntry | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: 'date' | 'amount'; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
    const isConnected = !!settings.supabaseUrl && !!settings.supabaseKey && syncStatus?.state === 'synced';

    // Sorted entries
    const sortedEntries = useMemo(() => {
        const sorted = [...entries];
        sorted.sort((a, b) => {
            let cmp = 0;
            if (sortConfig.key === 'date') {
                cmp = a.date.localeCompare(b.date);
            } else if (sortConfig.key === 'amount') {
                cmp = a.amount - b.amount;
            }
            return sortConfig.direction === 'asc' ? cmp : -cmp;
        });
        return sorted;
    }, [entries, sortConfig]);

    const totalAmount = useMemo(() => entries.reduce((sum, e) => sum + e.amount, 0), [entries]);

    // Persist sort config
    useEffect(() => {
        try { localStorage.setItem('noname-sort', JSON.stringify(sortConfig)); } catch {}
    }, [sortConfig]);

    useEffect(() => {
        try {
            const saved = localStorage.getItem('noname-sort');
            if (saved) setSortConfig(JSON.parse(saved));
        } catch {}
    }, []);

    const handleAddEntry = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isConnected) {
            alert('Writes are disabled until connected to the cloud. Please ensure Supabase is configured and the app shows Connected.');
            return;
        }
        const amountVal = parseFloat(newAmount);
        if (isNaN(amountVal) || amountVal <= 0) {
            setToastMsg('Enter a valid positive amount.');
            setShowToast(true);
            setTimeout(() => setShowToast(false), 3000);
            return;
        }
        if (new Date(newDate) > new Date()) {
            if (!window.confirm('Date is in the future. Continue?')) return;
        }

        const entry: NoNameEntry = {
            id: uuidv4(),
            date: newDate,
            amount: amountVal,
            notes: newNotes,
            createdBy: currentUser.username,
            updatedAt: new Date().toISOString(),
        };

        setEntries(prev => [...prev, entry]);
        setNewAmount('');
        setNewNotes('');
        setNewDate(new Date().toISOString().slice(0, 10));

        setToastMsg('✓ Entry added');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    };

    const handleDelete = (id: string) => {
        if (!isConnected) {
            alert('Deletes are disabled until connected to the cloud. Please ensure Supabase is configured and the app shows Connected.');
            return;
        }
        const entry = entries.find(e => e.id === id);
        if (window.confirm('Delete this entry?')) {
            setEntries(prev => prev.filter(e => e.id !== id));
            setLastDeleted(entry || null);
        }
    };

    const undoDelete = () => {
        if (!isConnected) {
            alert('Undo is disabled until connected to the cloud.');
            return;
        }
        if (!lastDeleted) return;
        setEntries(prev => [...prev, lastDeleted]);
        setLastDeleted(null);
    };

    const startEdit = (entry: NoNameEntry) => {
        setEditingId(entry.id);
        setEditDate(entry.date);
        setEditAmount(String(entry.amount));
        setEditNotes(entry.notes || '');
    };

    const saveEdit = () => {
        if (!isConnected) {
            alert('Writes are disabled until connected to the cloud. Please ensure Supabase is configured and the app shows Connected.');
            return;
        }
        if (!editingId) return;
        const amountVal = parseFloat(editAmount);
        if (isNaN(amountVal) || amountVal <= 0) {
            alert('Enter a valid positive amount.');
            return;
        }
        if (new Date(editDate) > new Date()) {
            if (!window.confirm('Date is in the future. Continue?')) return;
        }
        setEntries(prev =>
            prev.map(e =>
                e.id === editingId
                    ? { ...e, date: editDate, amount: amountVal, notes: editNotes, updatedAt: new Date().toISOString() }
                    : e
            )
        );
        setEditingId(null);
    };

    const cancelEdit = () => {
        setEditingId(null);
    };

    return (
        <div className="space-y-8 pb-32">
            {showToast && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-8 py-3 rounded-full shadow-2xl font-bold z-50 text-base flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    {toastMsg}
                </div>
            )}

            {/* Header */}
            <div className="bg-gradient-to-br from-slate-50 to-purple-50 p-8 rounded-2xl shadow-lg border-2 border-slate-200">
                <div className="flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-4 mb-3">
                            <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-4 rounded-xl shadow-md">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-3xl font-bold text-slate-800">Anonymous Donations</h2>
                                <p className="text-base text-slate-500 mt-1 font-medium">Track contributions without member attribution</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-400 to-pink-500 p-6 rounded-xl shadow-lg border-2 border-purple-300 flex flex-col justify-center min-w-[200px]">
                        <h3 className="text-white font-bold text-sm uppercase tracking-wider">💰 Total Donations</h3>
                        <p className="text-4xl font-bold text-white mt-2 drop-shadow">{formatCurrency(totalAmount, settings.currency)}</p>
                        <p className="text-purple-100 text-sm mt-1 font-semibold">{entries.length} contribution{entries.length !== 1 ? 's' : ''}</p>
                    </div>
                </div>
            </div>

            {/* Add Entry Form */}
            <div className="bg-white rounded-2xl shadow-lg border-2 border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        Record New Donation
                    </h3>
                </div>
                <form onSubmit={handleAddEntry} className="p-8 space-y-6 bg-gradient-to-br from-slate-50 to-purple-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white p-5 rounded-xl border-2 border-purple-200 shadow-sm">
                            <label className="flex items-center gap-3 text-base font-bold text-slate-700 mb-3">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                                </svg>
                                Date
                            </label>
                            <input
                                type="date"
                                value={newDate}
                                onChange={e => setNewDate(e.target.value)}
                                required
                                className="w-full border-2 border-slate-300 rounded-lg shadow-sm py-3 px-4 text-lg font-semibold focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            />
                        </div>
                        <div className="bg-white p-5 rounded-xl border-2 border-purple-200 shadow-sm">
                            <label className="flex items-center gap-3 text-base font-bold text-slate-700 mb-3">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                                </svg>
                                Amount
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <span className="text-slate-500 font-bold text-lg">$</span>
                                </div>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={newAmount}
                                    onChange={e => setNewAmount(e.target.value)}
                                    placeholder="0.00"
                                    required
                                    className="w-full pl-8 border-2 border-slate-300 rounded-lg shadow-sm py-3 px-4 font-bold text-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-5 rounded-xl border-2 border-purple-200 shadow-sm">
                        <label className="flex items-center gap-3 text-base font-bold text-slate-700 mb-3">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            Notes (Optional)
                        </label>
                        <textarea
                            value={newNotes}
                            onChange={e => setNewNotes(e.target.value)}
                            placeholder="Add any additional information..."
                            rows={3}
                            className="w-full border-2 border-slate-300 rounded-lg shadow-sm py-3 px-4 text-base focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={!isConnected}
                        title={!isConnected ? 'Requires cloud connection to add records' : undefined}
                        className={`w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg transition-all duration-200 flex items-center justify-center gap-3 ${!isConnected ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-xl hover:scale-105'}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        Add Donation Record
                    </button>
                </form>
            </div>

            {/* History */}
            <div className="bg-white rounded-2xl shadow-lg border-2 border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-r from-slate-700 to-slate-600 p-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Donation History
                    </h3>
                </div>
                <div className="overflow-y-auto max-h-[60vh]">
                    <table className="w-full text-left text-slate-600">
                        <thead className="bg-gradient-to-r from-purple-100 to-pink-100 text-slate-700 text-sm uppercase font-bold sticky top-0 z-10">
                            <tr>
                                <th
                                    className="px-6 py-4 cursor-pointer hover:bg-purple-200 transition-colors"
                                    onClick={() => setSortConfig(s => ({ key: 'date', direction: s.key === 'date' && s.direction === 'asc' ? 'desc' : 'asc' }))}
                                >
                                    <div className="flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                                        </svg>
                                        Date {sortConfig.key === 'date' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-4 text-right cursor-pointer hover:bg-purple-200 transition-colors"
                                    onClick={() => setSortConfig(s => ({ key: 'amount', direction: s.key === 'amount' && s.direction === 'asc' ? 'desc' : 'asc' }))}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                                        </svg>
                                        Amount {sortConfig.key === 'amount' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                                    </div>
                                </th>
                                <th className="px-6 py-4">Notes</th>
                                <th className="px-6 py-4">Recorded By</th>
                                <th className="px-6 py-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-base">
                            {sortedEntries.map(entry => {
                                const tooltip = `Created by: ${entry.createdBy || 'Unknown'}${entry.updatedAt ? `\nLast edited: ${new Date(entry.updatedAt).toLocaleString()}` : ''}`;
                                return (
                                    <tr
                                        key={entry.id}
                                        className="hover:bg-purple-50 transition-colors group"
                                        title={tooltip}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap font-semibold">
                                            {editingId === entry.id ? (
                                                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="border-2 border-slate-300 rounded-lg p-2 text-base" />
                                            ) : (
                                                entry.date
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-lg">
                                            {editingId === entry.id ? (
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={editAmount}
                                                    onChange={e => setEditAmount(e.target.value)}
                                                    className="border-2 border-slate-300 rounded-lg p-2 w-32 text-right text-base"
                                                />
                                            ) : (
                                                <span className="text-purple-600">{formatCurrency(entry.amount, settings.currency)}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 max-w-xs">
                                            {editingId === entry.id ? (
                                                <input
                                                    type="text"
                                                    value={editNotes}
                                                    onChange={e => setEditNotes(e.target.value)}
                                                    className="border-2 border-slate-300 rounded-lg p-2 w-full text-base"
                                                />
                                            ) : (
                                                <span className="text-slate-600">{entry.notes || '-'}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500 font-medium">{entry.createdBy || '-'}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex gap-2 justify-end">
                                                {editingId === entry.id ? (
                                                    <>
                                                        <button onClick={saveEdit} disabled={!isConnected} title={!isConnected ? 'Requires cloud connection' : undefined} className={`bg-green-500 text-white font-bold px-4 py-2 rounded-lg text-sm transition-all ${!isConnected ? 'opacity-60 cursor-not-allowed' : 'hover:bg-green-600 hover:scale-105'}` }>
                                                            Save
                                                        </button>
                                                        <button onClick={cancelEdit} className="bg-slate-400 hover:bg-slate-500 text-white font-bold px-4 py-2 rounded-lg text-sm transition-all hover:scale-105">
                                                            Cancel
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => startEdit(entry)}
                                                            disabled={!isConnected}
                                                            title={!isConnected ? 'Requires cloud connection' : undefined}
                                                            className={`bg-purple-500 text-white font-bold px-4 py-2 rounded-lg text-sm transition-all ${!isConnected ? 'opacity-60 cursor-not-allowed' : 'hover:bg-purple-600 hover:scale-105'}`}
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(entry.id)}
                                                            disabled={!isConnected}
                                                            title={!isConnected ? 'Requires cloud connection' : undefined}
                                                            className={`bg-red-500 text-white font-bold px-3 py-2 rounded-lg text-sm transition-all ${!isConnected ? 'opacity-60 cursor-not-allowed' : 'hover:bg-red-600 hover:scale-105'}`}
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                            </svg>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="bg-gradient-to-r from-purple-50 to-pink-50 border-t-2 border-purple-300">
                                <td colSpan={2} className="px-6 py-4 text-base font-bold text-slate-700">
                                    📊 Visible Total:
                                </td>
                                <td className="px-6 py-4 text-right font-bold text-xl text-purple-600">{formatCurrency(sortedEntries.reduce((s, e) => s + e.amount, 0), settings.currency)}</td>
                                <td colSpan={2} className="px-6 py-4 text-right text-slate-500 font-semibold text-sm">{sortedEntries.length} entr{sortedEntries.length !== 1 ? 'ies' : 'y'}</td>
                            </tr>
                        </tfoot>
                    </table>
                    {sortedEntries.length === 0 && (
                        <div className="text-center text-slate-400 p-16 italic text-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            No donations recorded yet. Add one above to get started.
                        </div>
                    )}
                </div>
            </div>

            {/* Undo Delete Toast */}
            {lastDeleted && (
                <div className="fixed bottom-6 right-6 bg-gradient-to-r from-red-600 to-red-500 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 z-50 border-2 border-red-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="font-bold text-base">Donation deleted.</span>
                    <button onClick={undoDelete} disabled={!isConnected} title={!isConnected ? 'Requires cloud connection' : undefined} className={`bg-white text-red-700 font-bold px-4 py-2 rounded-lg shadow-md text-sm ${!isConnected ? 'opacity-60 cursor-not-allowed' : 'hover:scale-105 transition-all'}`}>
                        Undo
                    </button>
                    <button onClick={() => setLastDeleted(null)} className="text-red-200 hover:text-white transition-colors">
                        Dismiss
                    </button>
                </div>
            )}
        </div>
    );
};

export default NoName;
