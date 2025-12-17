import React, { useState, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { NoNameEntry, Settings, User } from '../types';
import { formatCurrency } from '../utils';

interface NoNameProps {
    entries: NoNameEntry[];
    setEntries: React.Dispatch<React.SetStateAction<NoNameEntry[]>>;
    settings: Settings;
    currentUser: User;
}

const NoName: React.FC<NoNameProps> = ({ entries, setEntries, settings, currentUser }) => {
    const [newAmount, setNewAmount] = useState('');
    const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
    const [newNotes, setNewNotes] = useState('');
    const [showToast, setShowToast] = useState(false);
    const [toastMsg, setToastMsg] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editAmount, setEditAmount] = useState('');
    const [editDate, setEditDate] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [lastDeleted, setLastDeleted] = useState<NoNameEntry | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: 'date' | 'amount'; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });

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
        const entry = entries.find(e => e.id === id);
        if (window.confirm('Delete this entry?')) {
            setEntries(prev => prev.filter(e => e.id !== id));
            setLastDeleted(entry || null);
        }
    };

    const undoDelete = () => {
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
        <div className="space-y-6 pb-32">
            {showToast && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-2 rounded-full shadow-lg font-bold z-50">
                    {toastMsg}
                </div>
            )}

            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-slate-800">No Name</h2>
                <div className="bg-white px-6 py-3 rounded-xl border border-indigo-100 shadow-sm">
                    <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Total</span>
                    <p className="text-2xl font-extrabold text-indigo-600">{formatCurrency(totalAmount, settings.currency)}</p>
                </div>
            </div>

            {/* Add Entry Form */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 space-y-6">
                <h3 className="text-xl font-bold text-slate-800">Add Entry</h3>
                <form onSubmit={handleAddEntry} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Date</label>
                            <input
                                type="date"
                                value={newDate}
                                onChange={e => setNewDate(e.target.value)}
                                required
                                className="w-full border-slate-300 rounded-lg shadow-sm py-3 px-4 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Amount</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="text-slate-500 font-bold">$</span>
                                </div>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={newAmount}
                                    onChange={e => setNewAmount(e.target.value)}
                                    placeholder="0.00"
                                    required
                                    className="w-full pl-8 border-slate-300 rounded-lg shadow-sm py-3 px-4 font-bold text-xl focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                        </div>
                        <div className="flex items-end">
                            <button
                                type="submit"
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-lg transition-all hover:scale-105 active:scale-95"
                            >
                                Add
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Notes (Optional)</label>
                        <textarea
                            rows={3}
                            value={newNotes}
                            onChange={e => setNewNotes(e.target.value)}
                            placeholder="Any notes..."
                            className="w-full border-slate-300 rounded-lg shadow-sm py-3 px-4 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                </form>
            </div>

            {/* History */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <h3 className="text-xl font-bold text-slate-800 mb-4">Entry History</h3>
                <div className="overflow-y-auto max-h-[60vh]">
                    <table className="w-full text-left text-slate-600">
                        <thead className="bg-slate-100 text-slate-700 text-xs uppercase font-bold sticky top-0 z-10">
                            <tr>
                                <th
                                    className="px-4 py-3 cursor-pointer hover:bg-slate-200"
                                    onClick={() => setSortConfig(s => ({ key: 'date', direction: s.key === 'date' && s.direction === 'asc' ? 'desc' : 'asc' }))}
                                >
                                    Date {sortConfig.key === 'date' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                                </th>
                                <th
                                    className="px-4 py-3 text-right cursor-pointer hover:bg-slate-200"
                                    onClick={() => setSortConfig(s => ({ key: 'amount', direction: s.key === 'amount' && s.direction === 'asc' ? 'desc' : 'asc' }))}
                                >
                                    Amount {sortConfig.key === 'amount' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                                </th>
                                <th className="px-4 py-3">Notes</th>
                                <th className="px-4 py-3">By</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {sortedEntries.map(entry => (
                                <tr key={entry.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        {editingId === entry.id ? (
                                            <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="border-slate-300 rounded-md p-1" />
                                        ) : (
                                            entry.date
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold">
                                        {editingId === entry.id ? (
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={editAmount}
                                                onChange={e => setEditAmount(e.target.value)}
                                                className="border-slate-300 rounded-md p-1 w-24 text-right"
                                            />
                                        ) : (
                                            formatCurrency(entry.amount, settings.currency)
                                        )}
                                    </td>
                                    <td className="px-4 py-3 max-w-xs truncate">
                                        {editingId === entry.id ? (
                                            <input
                                                type="text"
                                                value={editNotes}
                                                onChange={e => setEditNotes(e.target.value)}
                                                className="border-slate-300 rounded-md p-1 w-full"
                                            />
                                        ) : (
                                            entry.notes || '-'
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-500">{entry.createdBy || '-'}</td>
                                    <td className="px-4 py-3 text-right flex gap-2 justify-end">
                                        {editingId === entry.id ? (
                                            <>
                                                <button onClick={saveEdit} className="text-green-600 hover:text-green-800 font-bold px-2 py-1 rounded hover:bg-green-50">
                                                    Save
                                                </button>
                                                <button onClick={cancelEdit} className="text-slate-600 hover:text-slate-800 font-bold px-2 py-1 rounded hover:bg-slate-100">
                                                    Cancel
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => startEdit(entry)}
                                                    className="text-indigo-600 hover:text-indigo-800 font-bold px-2 py-1 rounded hover:bg-indigo-50"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(entry.id)}
                                                    className="text-red-400 hover:text-red-600 font-bold px-2 py-1 rounded hover:bg-red-50"
                                                >
                                                    ×
                                                </button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-slate-50 border-t">
                                <td colSpan={2} className="px-4 py-3 text-sm font-bold text-slate-600">
                                    Visible Total:
                                </td>
                                <td className="px-4 py-3 text-right font-bold">{formatCurrency(sortedEntries.reduce((s, e) => s + e.amount, 0), settings.currency)}</td>
                                <td colSpan={2} className="px-4 py-3 text-right text-slate-500">{sortedEntries.length} entries</td>
                            </tr>
                        </tfoot>
                    </table>
                    {sortedEntries.length === 0 && (
                        <div className="text-center text-slate-400 p-12 italic">No entries yet. Add one above.</div>
                    )}
                </div>
            </div>

            {/* Undo Delete Toast */}
            {lastDeleted && (
                <div className="fixed bottom-6 right-6 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50">
                    <span className="font-bold">Entry deleted.</span>
                    <button onClick={undoDelete} className="bg-white text-red-700 font-bold px-3 py-1 rounded-md">
                        Undo
                    </button>
                    <button onClick={() => setLastDeleted(null)} className="text-red-200 hover:text-white">
                        Dismiss
                    </button>
                </div>
            )}
        </div>
    );
};

export default NoName;
