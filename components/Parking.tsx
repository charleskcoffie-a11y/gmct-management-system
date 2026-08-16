import React, { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import type { Settings, User, SyncStatus, ParkingReceipt } from '../types';
import { formatCurrency, getTodayEST, getNowEST } from '../utils';
import { v4 as uuidv4 } from 'uuid';
import { loadParkingReceipts, saveParkingReceipt, updateParkingReceipt, deleteParkingReceipt, saveSettingsToSupabase } from '../services/supabase';

interface ParkingProps {
    settings: Settings;
    currentUser: User;
    syncStatus?: SyncStatus;
}

const Parking: React.FC<ParkingProps> = ({ settings, currentUser, syncStatus }) => {
    const [receipts, setReceipts] = useState<ParkingReceipt[]>([]);
    const [date, setDate] = useState<string>(getTodayEST());
    const [amount, setAmount] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [sortConfig, setSortConfig] = useState<{ key: 'date' | 'amount'; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
    const [selectedYear, setSelectedYear] = useState<string>('all');
    const [monthlyTarget, setMonthlyTarget] = useState<number>(settings.parkingMonthlyTarget ?? 2500);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingReceiptId, setEditingReceiptId] = useState<string | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedReceiptForEdit, setSelectedReceiptForEdit] = useState<ParkingReceipt | null>(null);
    const [receiptToDelete, setReceiptToDelete] = useState<ParkingReceipt | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
        controls: false,
        addReceipt: false,
        targetVsActual: false,
        monthlyTrend: false,
        receiptsList: false,
    });

    const toggleSection = (key: string) => {
        setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const isConnected = !!settings.supabaseUrl && !!settings.supabaseKey && syncStatus?.state === 'synced';

    useEffect(() => {
        if (typeof settings.parkingMonthlyTarget === 'number') {
            setMonthlyTarget(settings.parkingMonthlyTarget);
        }
    }, [settings.parkingMonthlyTarget]);

    useEffect(() => {
        if (!isConnected) return;
        loadParkingReceipts(settings.supabaseUrl, settings.supabaseKey)
            .then(setReceipts)
            .catch(err => console.warn('Failed to load parking receipts:', err));
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

    const filteredReceipts = useMemo(() => {
        const clean = receipts.filter(r => !r.deleted);
        if (selectedYear === 'all') return clean;
        return clean.filter(r => new Date(r.date + 'T00:00:00').getFullYear().toString() === selectedYear);
    }, [receipts, selectedYear]);

    const totalAmount = useMemo(() => filteredReceipts.reduce((sum, r) => sum + r.amount, 0), [filteredReceipts]);

    const availableYears = useMemo(() => {
        const years = new Set(filteredReceipts.map(r => new Date(r.date + 'T00:00:00').getFullYear().toString()));
        return Array.from(years).sort((a, b) => Number(b) - Number(a));
    }, [filteredReceipts]);

    const monthlyTotals = useMemo(() => {
        const map = new Map<string, number>();
        filteredReceipts.forEach(r => {
            const key = r.date.substring(0, 7);
            map.set(key, (map.get(key) || 0) + r.amount);
        });
        return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [filteredReceipts]);

    const trendData = useMemo(
        () => monthlyTotals.map(([month, total]) => ({
            month: new Date(`${month}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
            total,
        })),
        [monthlyTotals]
    );

    const projection = useMemo(() => {
        const total = filteredReceipts.reduce((sum, r) => sum + r.amount, 0);
        const avg = monthlyTotals.length > 0 ? monthlyTotals.reduce((sum, [, amount]) => sum + amount, 0) / monthlyTotals.length : 0;
        return {
            total,
            avgMonthly: avg,
            projectedYear: avg * 12,
        };
    }, [filteredReceipts, monthlyTotals]);

    const resetReceiptForm = () => {
        setDate(getTodayEST());
        setAmount('');
        setNotes('');
        setEditingReceiptId(null);
        setSelectedReceiptForEdit(null);
        setIsEditModalOpen(false);
    };

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

        try {
            if (editingReceiptId) {
                const existing = receipts.find(r => r.id === editingReceiptId);
                if (!existing) throw new Error('Parking receipt not found for update.');

                const updated: ParkingReceipt = {
                    ...existing,
                    date,
                    amount: amt,
                    notes,
                    updatedBy: currentUser.username || 'unknown-user',
                    lastUpdated: getNowEST(),
                    deleted: false,
                };

                await updateParkingReceipt(settings.supabaseUrl, settings.supabaseKey, updated);
                setReceipts(prev => prev.map(r => r.id === editingReceiptId ? updated : r));
                setIsEditModalOpen(false);
            } else {
                const rec: ParkingReceipt = {
                    id: uuidv4(),
                    date,
                    amount: amt,
                    notes,
                    createdBy: currentUser.username || 'unknown-user',
                    createdAt: getNowEST(),
                    deleted: false,
                };
                await saveParkingReceipt(settings.supabaseUrl, settings.supabaseKey, rec);
                setReceipts(prev => [rec, ...prev]);
            }
            resetReceiptForm();
        } catch (err: any) {
            alert(`Failed to save record: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (receipt: ParkingReceipt) => {
        setSelectedReceiptForEdit(receipt);
        setEditingReceiptId(receipt.id);
        setDate(receipt.date);
        setAmount(String(receipt.amount));
        setNotes(receipt.notes ?? '');
        setIsEditModalOpen(true);
    };

    const handleMonthlyTargetChange = async (nextValue: number) => {
        const normalized = Number.isFinite(nextValue) ? Math.max(0, nextValue) : 0;
        setMonthlyTarget(normalized);

        if (!isConnected || !settings.supabaseUrl || !settings.supabaseKey) return;

        try {
            await saveSettingsToSupabase(settings.supabaseUrl, settings.supabaseKey, {
                ...settings,
                parkingMonthlyTarget: normalized,
            });
        } catch (error: any) {
            console.warn('Failed to sync parking target:', error?.message || error);
        }
    };

    const handleDeleteRequest = (receipt: ParkingReceipt) => {
        if (!isConnected) {
            alert('Deletes are disabled until connected to the cloud.');
            return;
        }
        setReceiptToDelete(receipt);
        setIsDeleteModalOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!receiptToDelete) return;
        setIsDeleting(true);
        try {
            await deleteParkingReceipt(settings.supabaseUrl, settings.supabaseKey, receiptToDelete.id);
            setReceipts(prev => prev.filter(r => r.id !== receiptToDelete.id));
            setIsDeleteModalOpen(false);
            setReceiptToDelete(null);
        } catch (err: any) {
            alert(`Failed to delete: ${err.message}`);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeleteClose = () => {
        setIsDeleteModalOpen(false);
        setReceiptToDelete(null);
    };

    return (
        <div className="space-y-8 pb-20">
            <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-50 via-amber-50 to-orange-100 p-6 shadow-[0_18px_45px_rgba(251,146,60,0.08)] md:p-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-orange-500/20 md:h-16 md:w-16">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-white md:h-8 md:w-8" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v1h.5A1.5 1.5 0 0117 6.5v7A1.5 1.5 0 0115.5 15H4.5A1.5 1.5 0 013 13.5v-7A1.5 1.5 0 014.5 5H5V4zm2 1h6V4H7v1zM5 7h10v6H5V7z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black tracking-tight text-slate-800 md:text-3xl">Parking Receipts</h2>
                            <p className="mt-2 text-sm font-medium text-slate-600 md:text-base">Track weekly parking income and monitor the monthly target.</p>
                        </div>
                    </div>

                    <div className="min-w-[220px] rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 p-5 text-white shadow-xl shadow-orange-500/20 md:min-w-[240px] md:p-6">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-100 md:text-xs">Total received</div>
                        <div className="mt-2 text-3xl font-black tracking-tight md:text-4xl">{formatCurrency(totalAmount, settings.currency)}</div>
                        <div className="mt-2 text-xs text-orange-100 md:text-sm">{filteredReceipts.length} record{filteredReceipts.length !== 1 ? 's' : ''}</div>
                    </div>
                </div>
            </div>

            <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_10px_30px_rgba(148,163,184,0.12)]">
                <button
                    type="button"
                    onClick={() => toggleSection('controls')}
                    className="flex w-full items-center justify-between bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4 text-left text-white"
                >
                    <span className="text-xs font-black uppercase tracking-[0.18em] md:text-sm">Controls</span>
                    <span className="text-base font-bold md:text-lg">{collapsedSections.controls ? '+' : '−'}</span>
                </button>

                {!collapsedSections.controls && <div className="p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Filter year</label>
                            <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-700 focus:border-amber-400 focus:bg-white">
                                <option value="all">All years</option>
                                {availableYears.map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Monthly target</label>
                            <input type="number" min="0" step="0.01" value={monthlyTarget} onChange={e => handleMonthlyTargetChange(Number(e.target.value) || 0)} className="rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-700 focus:border-amber-400 focus:bg-white" />
                        </div>

                        <div className="rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3 text-white font-black text-sm uppercase tracking-[0.18em]">
                            Target {formatCurrency(monthlyTarget, settings.currency)}
                        </div>
                    </div>
                </div>}
            </div>

            <div className="bg-white rounded-[26px] shadow-[0_18px_40px_rgba(15,23,42,0.08)] border border-slate-200 overflow-hidden">
                <button
                    type="button"
                    onClick={() => toggleSection('addReceipt')}
                    className="flex w-full items-center justify-between bg-gradient-to-r from-amber-600 to-orange-500 p-4 text-left text-white font-black text-lg tracking-tight md:p-5 md:text-xl"
                >
                    <span>Record New Parking Receipt</span>
                    <span className="text-lg md:text-xl">{collapsedSections.addReceipt ? '+' : '−'}</span>
                </button>
                {!collapsedSections.addReceipt && <form onSubmit={handleSubmit} className="grid gap-6 bg-gradient-to-br from-slate-50 to-amber-50 p-6 md:grid-cols-3">
                    <div className="rounded-2xl border-2 border-amber-200 bg-white p-5 shadow-sm">
                        <label className="mb-2 block text-sm font-bold text-slate-700">Date</label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-lg font-semibold text-slate-700 outline-none transition focus:border-amber-400 focus:bg-white" />
                    </div>
                    <div className="rounded-2xl border-2 border-amber-200 bg-white p-5 shadow-sm">
                        <label className="mb-2 block text-sm font-bold text-slate-700">Amount</label>
                        <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-lg font-bold text-slate-800 outline-none transition focus:border-amber-400 focus:bg-white" />
                    </div>
                    <div className="rounded-2xl border-2 border-amber-200 bg-white p-5 shadow-sm">
                        <label className="mb-2 block text-sm font-bold text-slate-700">Notes (optional)</label>
                        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g., Weekday parking, long-term parking" className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-700 outline-none transition focus:border-amber-400 focus:bg-white" />
                    </div>
                    <div className="md:col-span-3 flex flex-col gap-3 sm:flex-row">
                        <button type="submit" disabled={!isConnected || isSubmitting} title={!isConnected ? 'Requires cloud connection' : undefined} className={`flex-1 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-4 text-lg font-black text-white shadow-lg shadow-orange-500/25 transition-all ${!isConnected ? 'cursor-not-allowed opacity-60' : 'hover:-translate-y-0.5 hover:shadow-xl'}`}>
                            {isSubmitting ? 'Saving...' : editingReceiptId ? 'Update Receipt' : 'Add Receipt'}
                        </button>
                        {editingReceiptId && (
                            <button type="button" onClick={resetReceiptForm} className="rounded-2xl border-2 border-slate-200 bg-white px-6 py-4 text-base font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                                Cancel Edit
                            </button>
                        )}
                    </div>
                </form>}
            </div>

            <div className="bg-white rounded-[26px] shadow-[0_18px_40px_rgba(15,23,42,0.08)] border border-slate-200 overflow-hidden">
                <button
                    type="button"
                    onClick={() => toggleSection('targetVsActual')}
                    className="flex w-full items-center justify-between bg-gradient-to-r from-slate-700 to-slate-600 p-4 text-left text-white font-black text-lg tracking-tight md:p-5 md:text-xl"
                >
                    <span>Target vs Actual</span>
                    <span className="text-lg md:text-xl">{collapsedSections.targetVsActual ? '+' : '−'}</span>
                </button>

                {!collapsedSections.targetVsActual && <div className="grid gap-4 p-6 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Actual</div>
                        <div className="mt-3 text-3xl font-black text-slate-800">{formatCurrency(projection.total, settings.currency)}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Target</div>
                        <div className="mt-3 text-3xl font-black text-slate-800">{formatCurrency(monthlyTarget, settings.currency)}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Variance</div>
                        <div className={`mt-3 text-3xl font-black ${projection.total - monthlyTarget >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatCurrency(projection.total - monthlyTarget, settings.currency)}
                        </div>
                    </div>
                </div>}
            </div>

            <div className="bg-white rounded-[26px] shadow-[0_18px_40px_rgba(15,23,42,0.08)] border border-slate-200 overflow-hidden">
                <button
                    type="button"
                    onClick={() => toggleSection('monthlyTrend')}
                    className="flex w-full items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-left text-white font-black text-lg tracking-tight md:p-5 md:text-xl"
                >
                    <span>Monthly Trend</span>
                    <span className="text-lg md:text-xl">{collapsedSections.monthlyTrend ? '+' : '−'}</span>
                </button>

                {!collapsedSections.monthlyTrend && <div className="p-6">
                    {monthlyTotals.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center text-lg text-slate-400">No data yet.</div>
                    ) : (
                        <div className="h-80 w-full rounded-2xl border border-slate-200 bg-slate-50 p-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={trendData} margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                    <YAxis tickFormatter={(value) => `${formatCurrency(value, settings.currency).replace(/[^0-9.,-]/g, '')}`} />
                                    <Tooltip formatter={(value: number) => [formatCurrency(value, settings.currency), 'Amount']} labelFormatter={(label) => `Month: ${label}`} />
                                    <Line type="monotone" dataKey="total" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>}
            </div>

            <div className="bg-white rounded-[26px] shadow-[0_18px_40px_rgba(15,23,42,0.08)] border border-slate-200 overflow-hidden">
                <button
                    type="button"
                    onClick={() => toggleSection('receiptsList')}
                    className="flex w-full items-center justify-between bg-gradient-to-r from-slate-700 to-slate-600 p-4 text-left text-white font-black text-lg tracking-tight md:p-5 md:text-xl"
                >
                    <span>Receipts List</span>
                    <span className="text-lg md:text-xl">{collapsedSections.receiptsList ? '+' : '−'}</span>
                </button>

                {!collapsedSections.receiptsList && <div className="overflow-x-auto">
                    <table className="w-full text-left text-slate-700">
                        <thead className="bg-gradient-to-r from-amber-100 to-orange-100 text-slate-700 text-sm uppercase font-bold">
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
                                <tr key={r.id} className="hover:bg-amber-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap font-semibold">{r.date}</td>
                                    <td className="px-6 py-4 text-right font-black text-orange-700">{formatCurrency(r.amount, settings.currency)}</td>
                                    <td className="px-6 py-4">{r.notes || '-'}</td>
                                    <td className="px-6 py-4 text-sm text-slate-500 font-medium">{r.createdBy || '-'}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => handleEdit(r)} disabled={!isConnected} title={!isConnected ? 'Requires cloud connection' : undefined} className={`rounded-xl bg-amber-500 px-3 py-2 text-sm font-bold text-white transition-all ${!isConnected ? 'cursor-not-allowed opacity-60' : 'hover:bg-amber-600 hover:scale-105'}`}>Edit</button>
                                            <button onClick={() => handleDeleteRequest(r)} disabled={!isConnected} title={!isConnected ? 'Requires cloud connection' : undefined} className={`rounded-xl bg-red-500 px-3 py-2 text-sm font-bold text-white transition-all ${!isConnected ? 'cursor-not-allowed opacity-60' : 'hover:bg-red-600 hover:scale-105'}`}>Delete</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-gradient-to-r from-amber-50 to-orange-50">
                                <td className="px-6 py-4 font-black">Visible total</td>
                                <td className="px-6 py-4 text-right font-black text-orange-700">{formatCurrency(sortedReceipts.reduce((s, r) => s + r.amount, 0), settings.currency)}</td>
                                <td colSpan={3} className="px-6 py-4"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>}
                {!collapsedSections.receiptsList && sortedReceipts.length === 0 && (
                    <div className="p-16 text-center text-lg italic text-slate-400">No parking receipts recorded yet.</div>
                )}
            </div>

            {isDeleteModalOpen && receiptToDelete && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm" onClick={handleDeleteClose}>
                    <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.35)]" onClick={e => e.stopPropagation()}>
                        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-900 to-slate-700 px-6 py-5 text-white">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-500/20 text-2xl">⚠️</div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Delete receipt</p>
                                    <h3 className="mt-1 text-2xl font-black">Remove parking entry</h3>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-5 p-6">
                            <p className="text-lg font-medium text-slate-700">Are you sure you want to delete this parking receipt?</p>
                            <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                                <div className="flex items-center justify-between gap-4 text-sm text-slate-600">
                                    <span className="font-bold uppercase tracking-[0.12em] text-slate-500">Date</span>
                                    <span className="font-semibold text-slate-800">{receiptToDelete.date}</span>
                                </div>
                                <div className="mt-3 flex items-center justify-between gap-4 text-sm text-slate-600">
                                    <span className="font-bold uppercase tracking-[0.12em] text-slate-500">Amount</span>
                                    <span className="text-xl font-black text-red-700">{formatCurrency(receiptToDelete.amount, settings.currency)}</span>
                                </div>
                                <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Notes</p>
                                    <p className="mt-2 text-sm text-slate-700">{receiptToDelete.notes || 'No notes recorded.'}</p>
                                </div>
                            </div>

                            <p className="text-sm text-slate-500">This action cannot be undone.</p>

                            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                <button type="button" onClick={handleDeleteClose} className="rounded-xl border-2 border-slate-200 bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">Cancel</button>
                                <button type="button" onClick={handleDeleteConfirm} disabled={isDeleting} className={`rounded-xl bg-gradient-to-r from-red-600 to-red-500 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white transition ${isDeleting ? 'cursor-not-allowed opacity-60' : 'hover:-translate-y-0.5 hover:shadow-lg'}`}>
                                    {isDeleting ? 'Deleting...' : 'Delete receipt'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isEditModalOpen && selectedReceiptForEdit && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onClick={() => resetReceiptForm()}>
                    <div className="w-full max-w-xl rounded-[28px] border border-slate-200 bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 text-white">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-100">Edit Receipt</p>
                                <h3 className="mt-1 text-2xl font-black">Update Parking entry</h3>
                            </div>
                            <button type="button" onClick={resetReceiptForm} className="rounded-full bg-white/10 px-3 py-1 text-2xl font-bold text-white transition hover:bg-white/20">×</button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5 p-6">
                            <div className="grid gap-5 md:grid-cols-2">
                                <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4">
                                    <label className="mb-2 block text-sm font-bold text-slate-700">Date</label>
                                    <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-700 outline-none focus:border-amber-400" />
                                </div>
                                <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4">
                                    <label className="mb-2 block text-sm font-bold text-slate-700">Amount</label>
                                    <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-base font-bold text-slate-800 outline-none focus:border-amber-400" />
                                </div>
                            </div>

                            <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4">
                                <label className="mb-2 block text-sm font-bold text-slate-700">Notes (optional)</label>
                                <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g., Weekday parking, long-term parking" className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-base text-slate-700 outline-none focus:border-amber-400" />
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                                <button type="button" onClick={resetReceiptForm} className="rounded-xl border-2 border-slate-200 bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">Cancel</button>
                                <button type="submit" disabled={!isConnected || isSubmitting} className={`rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white transition ${!isConnected || isSubmitting ? 'cursor-not-allowed opacity-60' : 'hover:-translate-y-0.5 hover:shadow-lg'}`}>
                                    {isSubmitting ? 'Saving...' : 'Update Receipt'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Parking;
