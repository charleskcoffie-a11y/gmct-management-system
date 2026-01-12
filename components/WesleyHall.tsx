import React, { useEffect, useMemo, useState } from 'react';
import type { Settings, User, SyncStatus, WesleyHallReceipt } from '../types';
import { formatCurrency, getTodayEST, getNowEST } from '../utils';
import { v4 as uuidv4 } from 'uuid';
import { loadWesleyHallReceipts, saveWesleyHallReceipt, deleteWesleyHallReceipt } from '../services/supabase';

interface WesleyHallProps {
    settings: Settings;
    currentUser: User;
    syncStatus?: SyncStatus;
}

const WesleyHall: React.FC<WesleyHallProps> = ({ settings, currentUser, syncStatus }) => {
    const [receipts, setReceipts] = useState<WesleyHallReceipt[]>([]);

    const [date, setDate] = useState<string>(getTodayEST());
    const [amount, setAmount] = useState<string>('');
    const [notes, setNotes] = useState<string>('');

    const [sortConfig, setSortConfig] = useState<{ key: 'date' | 'amount'; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isConnected = !!settings.supabaseUrl && !!settings.supabaseKey && syncStatus?.state === 'synced';

    useEffect(() => {
        if (!isConnected) return;
        loadWesleyHallReceipts(settings.supabaseUrl, settings.supabaseKey)
            .then(setReceipts)
            .catch(err => console.warn('Failed to load Wesley Hall receipts:', err));
    }, [isConnected, settings.supabaseUrl, settings.supabaseKey]);

    const sortedReceipts = useMemo(() => {
        const data = [...receipts];
        data.sort((a, b) => {
            let cmp = 0;
            if (sortConfig.key === 'date') cmp = a.date.localeCompare(b.date);
            else cmp = a.amount - b.amount;
            return sortConfig.direction === 'asc' ? cmp : -cmp;
        });
        return data;
    }, [receipts, sortConfig]);

    const totalAmount = useMemo(() => receipts.reduce((sum, r) => sum + (r.deleted ? 0 : r.amount), 0), [receipts]);

    const monthlyTotals = useMemo(() => {
        const map = new Map<string, number>();
        receipts.filter(r => !r.deleted).forEach(r => {
            const key = r.date.substring(0, 7); // YYYY-MM
            map.set(key, (map.get(key) || 0) + r.amount);
        });
        return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [receipts]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isConnected) {
            alert('Writes are disabled until connected to the cloud. Please ensure Supabase is configured and the app shows Connected.');
            return;
        }
        const amt = parseFloat(amount);
        if (isNaN(amt) || amt <= 0) {
            alert('Enter a valid positive amount.');
            return;
        }
        setIsSubmitting(true);
        const rec: WesleyHallReceipt = {
            id: uuidv4(),
            date,
            amount: amt,
            notes,
            createdBy: currentUser.username,
            createdAt: getNowEST(),
        };
        try {
            await saveWesleyHallReceipt(settings.supabaseUrl, settings.supabaseKey, rec);
            setReceipts(prev => [rec, ...prev]);
            setDate(getTodayEST());
            setAmount('');
            setNotes('');
        } catch (e: any) {
            alert(`Failed to save record: ${e.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!isConnected) {
            alert('Deletes are disabled until connected to the cloud.');
            return;
        }
        if (!window.confirm('Delete this receipt?')) return;
        try {
            await deleteWesleyHallReceipt(settings.supabaseUrl, settings.supabaseKey, id);
            setReceipts(prev => prev.filter(r => r.id !== id));
        } catch (e: any) {
            alert(`Failed to delete: ${e.message}`);
        }
    };

    return (
        <div className="space-y-8 pb-20">
            {/* Header */}
            <div className="bg-gradient-to-br from-slate-50 to-indigo-50 p-8 rounded-2xl shadow-lg border-2 border-slate-200">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-4 rounded-xl shadow-md">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10 2a1 1 0 00-.894.553L7.382 5H5a2 2 0 00-2 2v8a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2.382l-1.724-2.447A1 1 0 0010 2z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold text-slate-800">Wesley Hall Rentals</h2>
                            <p className="text-base text-slate-500 mt-1 font-medium">Record amounts received from hall rentals and view trends</p>
                        </div>
                    </div>
                    <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-6 rounded-xl shadow-lg border-2 border-blue-300 min-w-[220px]">
                        <h3 className="text-white font-bold text-sm uppercase tracking-wider">Total Received</h3>
                        <p className="text-4xl font-bold text-white mt-2 drop-shadow">{formatCurrency(totalAmount, settings.currency)}</p>
                        <p className="text-blue-100 text-sm mt-1 font-semibold">{receipts.length} record{receipts.length !== 1 ? 's' : ''}</p>
                    </div>
                </div>
            </div>

            {/* Entry Form */}
            <div className="bg-white rounded-2xl shadow-lg border-2 border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-6 text-white font-bold text-xl">Record New Rental Receipt</div>
                <form onSubmit={handleSubmit} className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6 bg-gradient-to-br from-slate-50 to-blue-50">
                    <div className="bg-white p-5 rounded-xl border-2 border-indigo-200 shadow-sm">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Date</label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full border-2 border-slate-300 rounded-lg py-3 px-4 font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                    <div className="bg-white p-5 rounded-xl border-2 border-indigo-200 shadow-sm">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Amount</label>
                        <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required className="w-full border-2 border-slate-300 rounded-lg py-3 px-4 font-bold text-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                    <div className="bg-white p-5 rounded-xl border-2 border-indigo-200 shadow-sm md:col-span-1">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Notes (optional)</label>
                        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g., Wedding, Community Event" className="w-full border-2 border-slate-300 rounded-lg py-3 px-4 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                    <div className="md:col-span-3">
                        <button type="submit" disabled={!isConnected || isSubmitting} title={!isConnected ? 'Requires cloud connection' : undefined} className={`w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg transition-all ${!isConnected ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-xl hover:scale-105'}`}>Add Receipt</button>
                    </div>
                </form>
            </div>

            {/* Trend View */}
            <div className="bg-white rounded-2xl shadow-lg border-2 border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white font-bold text-xl">Monthly Trend</div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {monthlyTotals.length === 0 ? (
                        <div className="text-center text-slate-400 p-12">No data yet.</div>
                    ) : (
                        monthlyTotals.map(([month, total]) => (
                            <div key={month} className="bg-gradient-to-br from-indigo-50 to-blue-50 p-5 rounded-xl border-2 border-indigo-200">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-bold text-indigo-700 uppercase">{month}</div>
                                        <div className="text-2xl font-bold text-indigo-900 mt-1">{formatCurrency(total, settings.currency)}</div>
                                    </div>
                                    <div className="h-10 w-24 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-lg opacity-30"></div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-lg border-2 border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-r from-slate-700 to-slate-600 p-6 text-white font-bold text-xl">Receipts List</div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-slate-700">
                        <thead className="bg-gradient-to-r from-indigo-100 to-blue-100 text-slate-700 text-sm uppercase font-bold">
                            <tr>
                                <th className="px-6 py-4 cursor-pointer" onClick={() => setSortConfig(s => ({ key: 'date', direction: s.key === 'date' && s.direction === 'asc' ? 'desc' : 'asc' }))}>Date {sortConfig.key === 'date' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>
                                <th className="px-6 py-4 text-right cursor-pointer" onClick={() => setSortConfig(s => ({ key: 'amount', direction: s.key === 'amount' && s.direction === 'asc' ? 'desc' : 'asc' }))}>Amount {sortConfig.key === 'amount' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</th>
                                <th className="px-6 py-4">Notes</th>
                                <th className="px-6 py-4">Recorded By</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sortedReceipts.map(r => (
                                <tr key={r.id} className="hover:bg-indigo-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap font-semibold">{r.date}</td>
                                    <td className="px-6 py-4 text-right font-bold text-indigo-700">{formatCurrency(r.amount, settings.currency)}</td>
                                    <td className="px-6 py-4">{r.notes || '-'}</td>
                                    <td className="px-6 py-4 text-sm text-slate-500 font-medium">{r.createdBy || '-'}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button onClick={() => handleDelete(r.id)} disabled={!isConnected} title={!isConnected ? 'Requires cloud connection' : undefined} className={`bg-red-500 text-white font-bold px-3 py-2 rounded-lg text-sm transition-all ${!isConnected ? 'opacity-60 cursor-not-allowed' : 'hover:bg-red-600 hover:scale-105'}`}>Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-gradient-to-r from-indigo-50 to-blue-50 border-t-2 border-indigo-200">
                                <td className="px-6 py-4 font-bold">Visible Total</td>
                                <td className="px-6 py-4 text-right font-bold text-indigo-700">{formatCurrency(sortedReceipts.reduce((s, r) => s + r.amount, 0), settings.currency)}</td>
                                <td className="px-6 py-4" colSpan={3}></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                {sortedReceipts.length === 0 && (
                    <div className="text-center text-slate-400 p-16 italic text-lg">No receipts recorded yet.</div>
                )}
            </div>
        </div>
    );
};

export default WesleyHall;
