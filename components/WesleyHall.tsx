import React, { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import jsPDF from 'jspdf';
import type { Settings, User, SyncStatus, WesleyHallReceipt } from '../types';
import { formatCurrency, getTodayEST, getNowEST } from '../utils';
import { v4 as uuidv4 } from 'uuid';
import { loadWesleyHallReceipts, saveWesleyHallReceipt, updateWesleyHallReceipt, deleteWesleyHallReceipt, saveSettingsToSupabase } from '../services/supabase';

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
    const [selectedYear, setSelectedYear] = useState<string>('all');
    const [monthlyTarget, setMonthlyTarget] = useState<number>(settings.wesleyHallMonthlyTarget ?? 2500);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingReceiptId, setEditingReceiptId] = useState<string | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedReceiptForEdit, setSelectedReceiptForEdit] = useState<WesleyHallReceipt | null>(null);
    const [receiptToDelete, setReceiptToDelete] = useState<WesleyHallReceipt | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSummaryCompact, setIsSummaryCompact] = useState(false);
    const [isControlsCompact, setIsControlsCompact] = useState(false);
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
        addReceipt: false,
        targetVsActual: false,
        monthlyTrend: false,
        forecast: false,
        yearMonth: false,
        receiptsList: false,
    });

    const toggleSection = (key: string) => {
        setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const isConnected = !!settings.supabaseUrl && !!settings.supabaseKey && syncStatus?.state === 'synced';

    useEffect(() => {
        if (typeof settings.wesleyHallMonthlyTarget === 'number') {
            setMonthlyTarget(settings.wesleyHallMonthlyTarget);
        }
    }, [settings.wesleyHallMonthlyTarget]);

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

    const availableYears = useMemo(() => {
        const years = new Set(
            receipts
                .filter(r => !r.deleted)
                .map(r => new Date(r.date + 'T00:00:00').getFullYear().toString())
        );
        return Array.from(years).sort((a, b) => Number(b) - Number(a));
    }, [receipts]);

    const filteredReceipts = useMemo(() => {
        const clean = receipts.filter(r => !r.deleted);
        if (selectedYear === 'all') return clean;
        return clean.filter(r => new Date(r.date + 'T00:00:00').getFullYear().toString() === selectedYear);
    }, [receipts, selectedYear]);

    const monthlyTotals = useMemo(() => {
        const map = new Map<string, number>();
        filteredReceipts.forEach(r => {
            const key = r.date.substring(0, 7); // YYYY-MM
            map.set(key, (map.get(key) || 0) + r.amount);
        });
        return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [filteredReceipts]);

    const trendData = useMemo(() =>
        monthlyTotals.map(([month, total]) => ({
            month: new Date(`${month}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
            total,
        })),
        [monthlyTotals]
    );

    const yearMonthGroups = useMemo(() => {
        const groups: Record<string, Record<string, WesleyHallReceipt[]>> = {};

        receipts.filter(r => !r.deleted).forEach(receipt => {
            const dateObj = new Date(receipt.date + 'T00:00:00');
            const year = dateObj.getFullYear().toString();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const monthKey = `${year}-${month}`;

            if (!groups[year]) groups[year] = {};
            if (!groups[year][monthKey]) groups[year][monthKey] = [];

            groups[year][monthKey].push(receipt);
        });

        return Object.fromEntries(
            Object.entries(groups)
                .sort(([a], [b]) => Number(b) - Number(a))
                .map(([year, months]) => [
                    year,
                    Object.fromEntries(
                        Object.entries(months)
                            .sort(([a], [b]) => b.localeCompare(a))
                            .map(([monthKey, items]) => [monthKey, [...items].sort((x, y) => y.date.localeCompare(x.date))])
                    )
                ])
        );
    }, [receipts]);

    const projectionStats = useMemo(() => {
        const monthMap = new Map<string, number>();

        filteredReceipts.forEach(receipt => {
            const key = receipt.date.substring(0, 7);
            monthMap.set(key, (monthMap.get(key) || 0) + receipt.amount);
        });

        const sortedMonths = Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const currentMonthTotal = monthMap.get(currentMonthKey) || 0;
        const currentDay = now.getDate();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const projectedMonthEnd = currentDay > 0 ? currentMonthTotal * (daysInMonth / currentDay) : currentMonthTotal;
        const avgMonthly = sortedMonths.length > 0
            ? sortedMonths.reduce((sum, [, total]) => sum + total, 0) / sortedMonths.length
            : 0;
        const projectedQuarter = avgMonthly * 3;
        const projectedYear = avgMonthly * 12;
        const previousThreeMonths = sortedMonths.slice(-3);
        const rollingAverage = previousThreeMonths.length > 0
            ? previousThreeMonths.reduce((sum, [, total]) => sum + total, 0) / previousThreeMonths.length
            : avgMonthly;

        return {
            totalReceived: filteredReceipts.reduce((sum, r) => sum + r.amount, 0),
            currentMonthTotal,
            projectedMonthEnd,
            averageMonthly: avgMonthly,
            projectedQuarter,
            projectedYear,
            rollingAverage,
            monthsTracked: sortedMonths.length,
        };
    }, [filteredReceipts]);

    const targetComparison = useMemo(() => {
        const rows = monthlyTotals.map(([monthKey, total]) => {
            const monthLabel = new Date(`${monthKey}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short' });
            const target = monthlyTarget;
            const variance = total - target;
            return {
                monthKey,
                monthLabel,
                actual: total,
                target,
                variance,
            };
        });

        const totalActual = rows.reduce((sum, row) => sum + row.actual, 0);
        const totalTarget = rows.length * monthlyTarget;

        return {
            rows,
            totalActual,
            totalTarget,
            totalVariance: totalActual - totalTarget,
        };
    }, [monthlyTotals, monthlyTarget]);

    const exportWesleyHallReport = () => {
        const doc = new jsPDF({ unit: 'pt', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        doc.setFillColor(79, 70, 229);
        doc.rect(0, 0, pageWidth, 52, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('Wesley Hall Rentals Report', 40, 30);

        doc.setTextColor(15, 23, 42);
        doc.setFontSize(11);
        let y = 80;
        doc.setFont('helvetica', 'normal');
        doc.text(`Year filter: ${selectedYear === 'all' ? 'All years' : selectedYear}`, 40, y);
        y += 20;
        doc.text(`Monthly target: ${formatCurrency(monthlyTarget, settings.currency)}`, 40, y);
        y += 20;
        doc.text(`Actual total: ${formatCurrency(targetComparison.totalActual, settings.currency)}`, 40, y);
        y += 20;
        doc.text(`Target total: ${formatCurrency(targetComparison.totalTarget, settings.currency)}`, 40, y);
        y += 20;
        doc.text(`Variance: ${formatCurrency(targetComparison.totalVariance, settings.currency)}`, 40, y);
        y += 30;

        doc.setFont('helvetica', 'bold');
        doc.text('Month-by-month comparison', 40, y);
        y += 18;
        doc.setFont('helvetica', 'normal');

        targetComparison.rows.forEach(row => {
            if (y > pageHeight - 60) {
                doc.addPage();
                y = 40;
            }
            doc.text(`${row.monthLabel}: actual ${formatCurrency(row.actual, settings.currency)} | target ${formatCurrency(row.target, settings.currency)} | variance ${formatCurrency(row.variance, settings.currency)}`, 40, y);
            y += 18;
        });

        const fileName = `wesley-hall-${selectedYear === 'all' ? 'all-years' : selectedYear}.pdf`;
        doc.save(fileName);
    };

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
                if (!existing) {
                    throw new Error('Receipt not found for update.');
                }
                const updated: WesleyHallReceipt = {
                    ...existing,
                    date,
                    amount: amt,
                    notes,
                    updatedBy: currentUser.username || 'unknown-user',
                    lastUpdated: getNowEST(),
                    deleted: false,
                };
                await updateWesleyHallReceipt(settings.supabaseUrl, settings.supabaseKey, updated);
                setReceipts(prev => prev.map(r => r.id === editingReceiptId ? updated : r));
                setIsEditModalOpen(false);
            } else {
                const rec: WesleyHallReceipt = {
                    id: uuidv4(),
                    date,
                    amount: amt,
                    notes,
                    createdBy: currentUser.username || 'unknown-user',
                    createdAt: getNowEST(),
                    deleted: false,
                };
                await saveWesleyHallReceipt(settings.supabaseUrl, settings.supabaseKey, rec);
                setReceipts(prev => [rec, ...prev]);
            }
            resetReceiptForm();
        } catch (e: any) {
            alert(`Failed to save record: ${e.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (receipt: WesleyHallReceipt) => {
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
                wesleyHallMonthlyTarget: normalized,
            });
        } catch (error: any) {
            console.warn('Failed to sync Wesley Hall target:', error?.message || error);
        }
    };

    const handleDeleteRequest = (receipt: WesleyHallReceipt) => {
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
            await deleteWesleyHallReceipt(settings.supabaseUrl, settings.supabaseKey, receiptToDelete.id);
            setReceipts(prev => prev.filter(r => r.id !== receiptToDelete.id));
            setIsDeleteModalOpen(false);
            setReceiptToDelete(null);
        } catch (e: any) {
            alert(`Failed to delete: ${e.message}`);
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
            <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-50 via-indigo-50 to-blue-100 p-6 shadow-[0_18px_45px_rgba(79,70,229,0.08)] md:p-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-500 shadow-lg shadow-indigo-500/20 md:h-16 md:w-16">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-white md:h-8 md:w-8" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10 2a1 1 0 00-.894.553L7.382 5H5a2 2 0 00-2 2v8a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2.382l-1.724-2.447A1 1 0 0010 2z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black tracking-tight text-slate-800 md:text-3xl">Wesley Hall Rentals</h2>
                            <p className="mt-2 text-sm font-medium text-slate-600 md:text-base">Track hall income, spot trends, and forecast revenue with confidence.</p>
                        </div>
                    </div>

                    <div className="min-w-[220px] rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 p-5 text-white shadow-xl shadow-indigo-600/20 md:min-w-[240px] md:p-6">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-100 md:text-xs">Total received</div>
                        <div className="mt-2 text-3xl font-black tracking-tight md:text-4xl">{formatCurrency(totalAmount, settings.currency)}</div>
                        <div className="mt-2 text-xs text-blue-100 md:text-sm">{receipts.length} record{receipts.length !== 1 ? 's' : ''}</div>
                    </div>
                </div>
            </div>

            <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_10px_30px_rgba(148,163,184,0.12)]">
                <button
                    type="button"
                    onClick={() => setIsSummaryCompact(prev => !prev)}
                    className="flex w-full items-center justify-between bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-3 text-left text-white md:py-4"
                >
                    <span className="text-xs font-black uppercase tracking-[0.18em] md:text-sm">Summary</span>
                    <span className="text-base font-bold md:text-lg">{isSummaryCompact ? 'Expand' : 'Compact'}</span>
                </button>

                {!isSummaryCompact ? (
                    <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
                        {[
                            { label: 'This month', value: projectionStats.currentMonthTotal, tone: 'from-indigo-500 to-blue-600' },
                            { label: 'Avg / month', value: projectionStats.averageMonthly, tone: 'from-violet-500 to-indigo-600' },
                            { label: 'Projected month-end', value: projectionStats.projectedMonthEnd, tone: 'from-cyan-500 to-blue-600' },
                            { label: 'Projected year', value: projectionStats.projectedYear, tone: 'from-emerald-500 to-teal-600' },
                        ].map(metric => (
                            <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(148,163,184,0.12)]">
                                <div className={`mb-3 inline-flex rounded-full bg-gradient-to-r ${metric.tone} px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white`}>
                                    {metric.label}
                                </div>
                                <div className="text-2xl font-black text-slate-800">{formatCurrency(metric.value, settings.currency)}</div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
                        {[
                            { label: 'This month', value: projectionStats.currentMonthTotal },
                            { label: 'Avg / month', value: projectionStats.averageMonthly },
                            { label: 'Month-end', value: projectionStats.projectedMonthEnd },
                            { label: 'Projected year', value: projectionStats.projectedYear },
                        ].map(metric => (
                            <div key={metric.label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{metric.label}</div>
                                <div className="mt-1 text-sm font-black text-slate-800">{formatCurrency(metric.value, settings.currency)}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                <button
                    type="button"
                    onClick={() => setIsControlsCompact(prev => !prev)}
                    className="flex w-full items-center justify-between bg-gradient-to-r from-indigo-600 to-blue-600 px-5 py-3 text-left text-white md:py-4"
                >
                    <span className="text-xs font-black uppercase tracking-[0.18em] md:text-sm">Controls</span>
                    <span className="text-base font-bold md:text-lg">{isControlsCompact ? 'Show' : 'Hide'}</span>
                </button>

                {!isControlsCompact && (
                    <div className="p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Filter year</label>
                                <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-700 focus:border-indigo-400 focus:bg-white">
                                    <option value="all">All years</option>
                                    {availableYears.map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Monthly target</label>
                                <input type="number" min="0" step="0.01" value={monthlyTarget} onChange={e => handleMonthlyTargetChange(Number(e.target.value) || 0)} className="rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-700 focus:border-indigo-400 focus:bg-white" />
                            </div>

                            <button type="button" onClick={exportWesleyHallReport} className="rounded-xl bg-slate-800 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-slate-700">
                                Export PDF
                            </button>
                        </div>
                    </div>
                )}
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

                {!collapsedSections.targetVsActual && (
                    <>
                        <div className="grid gap-4 p-6 md:grid-cols-3">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Actual</div>
                                <div className="mt-3 text-3xl font-black text-slate-800">{formatCurrency(targetComparison.totalActual, settings.currency)}</div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Target</div>
                                <div className="mt-3 text-3xl font-black text-slate-800">{formatCurrency(targetComparison.totalTarget, settings.currency)}</div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Variance</div>
                                <div className={`mt-3 text-3xl font-black ${targetComparison.totalVariance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {formatCurrency(targetComparison.totalVariance, settings.currency)}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3 px-6 pb-6">
                            {targetComparison.rows.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-400">No month data available for this filter.</div>
                            ) : (
                                targetComparison.rows.map(row => (
                                    <div key={row.monthKey} className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
                                        <div className="font-bold text-slate-700">{row.monthLabel}</div>
                                        <div className="flex flex-wrap items-center gap-3 text-sm">
                                            <span className="rounded-full bg-indigo-100 px-2.5 py-1 font-bold text-indigo-700">Actual: {formatCurrency(row.actual, settings.currency)}</span>
                                            <span className="rounded-full bg-slate-200 px-2.5 py-1 font-bold text-slate-700">Target: {formatCurrency(row.target, settings.currency)}</span>
                                            <span className={`rounded-full px-2.5 py-1 font-bold ${row.variance >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                {row.variance >= 0 ? 'Above' : 'Below'} target: {formatCurrency(Math.abs(row.variance), settings.currency)}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                )}
            </div>

            <div className="bg-white rounded-[26px] shadow-[0_18px_40px_rgba(15,23,42,0.08)] border border-slate-200 overflow-hidden">
                <button
                    type="button"
                    onClick={() => toggleSection('addReceipt')}
                    className="flex w-full items-center justify-between bg-gradient-to-r from-indigo-600 to-blue-600 p-4 text-left text-white font-black text-lg tracking-tight md:p-5 md:text-xl"
                >
                    <span>Record New Rental Receipt</span>
                    <span className="text-lg md:text-xl">{collapsedSections.addReceipt ? '+' : '−'}</span>
                </button>

                {!collapsedSections.addReceipt && (
                    <form onSubmit={handleSubmit} className="grid gap-6 bg-gradient-to-br from-slate-50 to-indigo-50 p-6 md:grid-cols-3">
                        <div className="rounded-2xl border-2 border-indigo-200 bg-white p-5 shadow-sm">
                            <label className="mb-2 block text-sm font-bold text-slate-700">Date</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-lg font-semibold text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white" />
                        </div>
                        <div className="rounded-2xl border-2 border-indigo-200 bg-white p-5 shadow-sm">
                            <label className="mb-2 block text-sm font-bold text-slate-700">Amount</label>
                            <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-lg font-bold text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white" />
                        </div>
                        <div className="rounded-2xl border-2 border-indigo-200 bg-white p-5 shadow-sm">
                            <label className="mb-2 block text-sm font-bold text-slate-700">Notes (optional)</label>
                            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g., Wedding, Community Event" className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white" />
                        </div>
                        <div className="md:col-span-3 flex flex-col gap-3 sm:flex-row">
                            <button type="submit" disabled={!isConnected || isSubmitting} title={!isConnected ? 'Requires cloud connection' : undefined} className={`flex-1 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 px-8 py-4 text-lg font-black text-white shadow-lg shadow-indigo-600/25 transition-all ${!isConnected ? 'cursor-not-allowed opacity-60' : 'hover:-translate-y-0.5 hover:shadow-xl'}`}>
                                {isSubmitting ? 'Saving...' : editingReceiptId ? 'Update Receipt' : 'Add Receipt'}
                            </button>
                            {editingReceiptId && (
                                <button type="button" onClick={resetReceiptForm} className="rounded-2xl border-2 border-slate-200 bg-white px-6 py-4 text-base font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                                    Cancel Edit
                                </button>
                            )}
                        </div>
                    </form>
                )}
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

                {!collapsedSections.monthlyTrend && (
                    <div className="p-6">
                        {monthlyTotals.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center text-lg text-slate-400">No data yet.</div>
                        ) : (
                            <div className="space-y-6">
                                <div className="h-80 w-full rounded-2xl border border-slate-200 bg-slate-50 p-2">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={trendData} margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                                            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                            <YAxis tickFormatter={(value) => `${formatCurrency(value, settings.currency).replace(/\$|GHS|USD|GBP|EUR|NGN|KES|ZAR|CAD|AUD/gi, '').trim()}`} />
                                            <Tooltip
                                                formatter={(value: number) => [formatCurrency(value, settings.currency), 'Amount']}
                                                labelFormatter={(label) => `Month: ${label}`}
                                            />
                                            <Line type="monotone" dataKey="total" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                    {monthlyTotals.map(([month, total]) => (
                                        <div key={month} className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50 p-5 shadow-sm">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-700">{month}</div>
                                                    <div className="mt-2 text-2xl font-black text-slate-800">{formatCurrency(total, settings.currency)}</div>
                                                </div>
                                                <div className="h-10 w-16 rounded-lg bg-gradient-to-r from-indigo-500 to-blue-500 opacity-35" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="bg-white rounded-[26px] shadow-[0_18px_40px_rgba(15,23,42,0.08)] border border-slate-200 overflow-hidden">
                <button
                    type="button"
                    onClick={() => toggleSection('forecast')}
                    className="flex w-full items-center justify-between bg-gradient-to-r from-slate-700 to-slate-600 p-4 text-left text-white font-black text-lg tracking-tight md:p-5 md:text-xl"
                >
                    <span>Revenue Forecast</span>
                    <span className="text-lg md:text-xl">{collapsedSections.forecast ? '+' : '−'}</span>
                </button>

                {!collapsedSections.forecast && (
                    <div className="grid gap-4 p-6 md:grid-cols-3">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Rolling 3-month avg</div>
                            <div className="mt-3 text-3xl font-black text-slate-800">{formatCurrency(projectionStats.rollingAverage, settings.currency)}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Projected quarter</div>
                            <div className="mt-3 text-3xl font-black text-slate-800">{formatCurrency(projectionStats.projectedQuarter, settings.currency)}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Projected year</div>
                            <div className="mt-3 text-3xl font-black text-slate-800">{formatCurrency(projectionStats.projectedYear, settings.currency)}</div>
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-[26px] shadow-[0_18px_40px_rgba(15,23,42,0.08)] border border-slate-200 overflow-hidden">
                <button
                    type="button"
                    onClick={() => toggleSection('yearMonth')}
                    className="flex w-full items-center justify-between bg-gradient-to-r from-slate-700 to-slate-600 p-4 text-left text-white font-black text-lg tracking-tight md:p-5 md:text-xl"
                >
                    <span>Receipts by Year &amp; Month</span>
                    <span className="text-lg md:text-xl">{collapsedSections.yearMonth ? '+' : '−'}</span>
                </button>

                {!collapsedSections.yearMonth && (
                    <div className="space-y-6 p-6">
                        {Object.keys(yearMonthGroups).length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center text-lg text-slate-400">No receipts recorded yet.</div>
                        ) : (
                            Object.entries(yearMonthGroups).map(([year, months]) => (
                                <div key={year} className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5 shadow-sm">
                                    <div className="mb-4 flex items-center justify-between border-b border-indigo-200 pb-3">
                                        <h3 className="text-2xl font-black text-indigo-900">{year}</h3>
                                        <span className="text-sm font-bold uppercase tracking-[0.18em] text-indigo-700">
                                            {Object.values(months).flat().reduce((sum, item) => sum + item.amount, 0).toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="space-y-4">
                                        {Object.entries(months).map(([monthKey, monthReceipts]) => {
                                            const monthLabel = new Date(`${monthKey}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long' });
                                            const monthTotal = monthReceipts.reduce((sum, item) => sum + item.amount, 0);

                                            return (
                                                <div key={monthKey} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                                    <div className="mb-3 flex items-center justify-between gap-3">
                                                        <div>
                                                            <p className="text-lg font-black text-slate-800">{monthLabel}</p>
                                                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{monthReceipts.length} record{monthReceipts.length !== 1 ? 's' : ''}</p>
                                                        </div>
                                                        <span className="text-base font-black text-indigo-700">{formatCurrency(monthTotal, settings.currency)}</span>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {monthReceipts.map(receipt => (
                                                            <div key={receipt.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                                                <div>
                                                                    <p className="font-bold text-slate-700">{receipt.date}</p>
                                                                    <p className="text-sm text-slate-500">{receipt.notes || 'No notes'}</p>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="font-black text-indigo-700">{formatCurrency(receipt.amount, settings.currency)}</p>
                                                                    <p className="text-xs text-slate-500">{receipt.createdBy || 'Unknown'}</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
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
                                    <h3 className="mt-1 text-2xl font-black">Remove Wesley Hall entry</h3>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-5 p-6">
                            <p className="text-lg font-medium text-slate-700">
                                Are you sure you want to delete this rental receipt?
                            </p>

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
                        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-4 text-white">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-100">Edit Receipt</p>
                                <h3 className="mt-1 text-2xl font-black">Update Wesley Hall entry</h3>
                            </div>
                            <button type="button" onClick={resetReceiptForm} className="rounded-full bg-white/10 px-3 py-1 text-2xl font-bold text-white transition hover:bg-white/20">×</button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5 p-6">
                            <div className="grid gap-5 md:grid-cols-2">
                                <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4">
                                    <label className="mb-2 block text-sm font-bold text-slate-700">Date</label>
                                    <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-700 outline-none focus:border-indigo-400" />
                                </div>
                                <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4">
                                    <label className="mb-2 block text-sm font-bold text-slate-700">Amount</label>
                                    <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-base font-bold text-slate-800 outline-none focus:border-indigo-400" />
                                </div>
                            </div>

                            <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4">
                                <label className="mb-2 block text-sm font-bold text-slate-700">Notes (optional)</label>
                                <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g., Wedding, Community Event" className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-base text-slate-700 outline-none focus:border-indigo-400" />
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                                <button type="button" onClick={resetReceiptForm} className="rounded-xl border-2 border-slate-200 bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">Cancel</button>
                                <button type="submit" disabled={!isConnected || isSubmitting} className={`rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white transition ${!isConnected || isSubmitting ? 'cursor-not-allowed opacity-60' : 'hover:-translate-y-0.5 hover:shadow-lg'}`}>
                                    {isSubmitting ? 'Saving...' : 'Update Receipt'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-[26px] shadow-[0_18px_40px_rgba(15,23,42,0.08)] border border-slate-200 overflow-hidden">
                <button
                    type="button"
                    onClick={() => toggleSection('receiptsList')}
                    className="flex w-full items-center justify-between bg-gradient-to-r from-slate-700 to-slate-600 p-4 text-left text-white font-black text-lg tracking-tight md:p-5 md:text-xl"
                >
                    <span>Receipts List</span>
                    <span className="text-lg md:text-xl">{collapsedSections.receiptsList ? '+' : '−'}</span>
                </button>

                {!collapsedSections.receiptsList && (
                    <>
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
                                            <td className="px-6 py-4 text-right font-black text-indigo-700">{formatCurrency(r.amount, settings.currency)}</td>
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
                                    <tr className="bg-gradient-to-r from-indigo-50 to-blue-50">
                                        <td className="px-6 py-4 font-black">Visible total</td>
                                        <td className="px-6 py-4 text-right font-black text-indigo-700">{formatCurrency(sortedReceipts.reduce((s, r) => s + r.amount, 0), settings.currency)}</td>
                                        <td className="px-6 py-4" colSpan={3}></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        {sortedReceipts.length === 0 && (
                            <div className="p-16 text-center text-lg italic text-slate-400">No receipts recorded yet.</div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default WesleyHall;
