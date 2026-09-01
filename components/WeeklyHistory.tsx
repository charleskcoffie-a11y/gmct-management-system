import React, { useState, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { WeeklyHistoryRecord, VisitorRecord, ServiceDonation, Settings } from '../types';
import { sanitizeWeeklyHistoryRecord, formatCurrency } from '../utils';
import { saveWeeklyHistoryToSupabase, deleteWeeklyHistoryFromSupabase, downloadDataFromSupabase } from '../services/supabase';
import HistoryArchiveModal from './HistoryArchiveModal';
import { ResponsiveContainer, BarChart, Bar, Line, ComposedChart, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';

interface WeeklyHistoryProps {
    history: WeeklyHistoryRecord[];
    setHistory: React.Dispatch<React.SetStateAction<WeeklyHistoryRecord[]>>;
    settings: Settings;
    selectedSocietyId: string;
}

const initialFormState = (): WeeklyHistoryRecord => ({
    id: uuidv4(),
    dateOfService: new Date().toISOString().slice(0, 10),
    societyName: 'Ghana Methodist Church Toronto (GMCT)',
    officiant: '',
    liturgist: '',
    serviceTypes: [],
    serviceTypeOther: '',
    sermonTopic: '',
    memoryVerse: '',
    worshipHighlights: '',
    announcementsBy: '',
    attendance: { men: 0, women: 0, junior: 0, children: 0, visitors: 0, catechumens: 0 },
    visitorsList: [],
    donationsList: [],
    noDonation: false,
    noVisitors: false,
    newMembersDetails: '',
    newMembersContact: '',
    events: '',
    observations: '',
    preparedBy: '',
});

const serviceTypeOptions = [
    'Divine Service',
    'Communion',
    'Youth Sunday',
    'Lay Movement',
    'Revival/Prayer Sunday',
    'Thanksgiving',
    'Outreach',
    'Other'
];

const WeeklyHistory: React.FC<WeeklyHistoryProps> = ({ history, setHistory, settings, selectedSocietyId }) => {
    const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
    const [formData, setFormData] = useState<WeeklyHistoryRecord>(initialFormState());
    const [showArchive, setShowArchive] = useState(false);
    const [activeModal, setActiveModal] = useState<'details' | 'attendance' | 'visitors' | 'donations' | 'events' | null>(null);
    const [editingArchiveId, setEditingArchiveId] = useState<string | null>(null);
    const [isFullEditorOpen, setIsFullEditorOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showSaveSuccess, setShowSaveSuccess] = useState(false);
    const [attendanceDateFilter, setAttendanceDateFilter] = useState<string>('');
    
    // Temporary state for new donor/visitor input
    const [newDonor, setNewDonor] = useState({ donor: '', amount: 0, description: '' });
    const [newVisitor, setNewVisitor] = useState({ name: '', from: '', position: '', reason: '' });

    // Always start with a clean slate on load
    useEffect(() => {
        setSelectedRecordId(null);
        setFormData(initialFormState());
    }, []);

    useEffect(() => {
        if (selectedRecordId) {
            const record = history.find(h => h.id === selectedRecordId);
            if (record) {
                // Merge to ensure newly added fields (e.g., preparedBy) are present when editing older records
                setFormData({ ...initialFormState(), ...record });
            }
        }
        // Note: We don't reset to initialFormState here when selectedRecordId is null
        // because that would clear the form while the user is typing.
        // The form is explicitly reset when the New button is clicked.
    }, [selectedRecordId]); // Only reload when selectedRecordId changes, not when history changes

    // Clear form when opening new entry
    useEffect(() => {
        if (isFullEditorOpen && !selectedRecordId) {
            setFormData(initialFormState());
        }
    }, [isFullEditorOpen, selectedRecordId]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAttendanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, attendance: { ...prev.attendance, [name as keyof typeof prev.attendance]: parseInt(value) || 0 }}));
    };

    const handleAddDonation = () => {
        if (newDonor.donor.trim() && newDonor.amount > 0) {
            setFormData(prev => ({
                ...prev,
                donationsList: [...prev.donationsList, { donor: newDonor.donor, amount: newDonor.amount, description: newDonor.description }]
            }));
            setNewDonor({ donor: '', amount: 0, description: '' });
        }
    };

    const handleRemoveDonation = (index: number) => {
        setFormData(prev => ({
            ...prev,
            donationsList: prev.donationsList.filter((_, i) => i !== index)
        }));
    };

    const handleAddVisitor = () => {
        if (newVisitor.name.trim()) {
            setFormData(prev => ({
                ...prev,
                visitorsList: [...prev.visitorsList, { name: newVisitor.name, from: newVisitor.from, position: newVisitor.position, reason: newVisitor.reason }]
            }));
            setNewVisitor({ name: '', from: '', position: '', reason: '' });
        }
    };

    const handleRemoveVisitor = (index: number) => {
        setFormData(prev => ({
            ...prev,
            visitorsList: prev.visitorsList.filter((_, i) => i !== index)
        }));
    };

    const handleServiceTypeToggle = (type: string) => {
        setFormData(prev => ({
            ...prev,
            serviceTypes: prev.serviceTypes.includes(type)
                ? prev.serviceTypes.filter(t => t !== type)
                : [...prev.serviceTypes, type]
        }));
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (isSaving) return;
        
        setIsSaving(true);
        try {
            const sanitized = { ...sanitizeWeeklyHistoryRecord(formData), societyId: selectedSocietyId };
            
            // Save to Supabase if configured
            if (settings.supabaseUrl && settings.supabaseKey) {
                await saveWeeklyHistoryToSupabase(settings.supabaseUrl, settings.supabaseKey, sanitized);
                
                // Fetch fresh data from Supabase to ensure we have the latest
                const cloudData = await downloadDataFromSupabase(settings.supabaseUrl, settings.supabaseKey, selectedSocietyId);
                setHistory(cloudData.history);
            } else {
                // Fallback to local state if Supabase not configured
                const newHistory = history.findIndex(h => h.id === sanitized.id) > -1 
                    ? history.map(h => h.id === sanitized.id ? sanitized : h)
                    : [...history, sanitized];
                setHistory(newHistory);
            }
            
            setShowSaveSuccess(true);
            // Auto-dismiss after 3 seconds
            setTimeout(() => setShowSaveSuccess(false), 3000);
            // Reset form for new entry
            setSelectedRecordId(null);
            setFormData(initialFormState());
            setEditingArchiveId(null);
            setActiveModal(null);
            setIsFullEditorOpen(false);
        } catch (error: any) {
            alert(`Failed to save: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveAndReset = () => {
        handleSubmit();
        setSelectedRecordId(null);
        setFormData(initialFormState());
        setActiveModal(null);
        setIsFullEditorOpen(false);
    };

    const handleEditArchiveRecord = (record: WeeklyHistoryRecord) => {
        setSelectedRecordId(record.id);
        // Merge to backfill new fields for legacy records
        setFormData({ ...initialFormState(), ...record });
        setEditingArchiveId(record.id);
        setIsFullEditorOpen(true);
        setShowArchive(false);
    };

    const handleDeleteArchiveRecord = async (id: string) => {
        try {
            // Delete from Supabase if configured
            if (settings.supabaseUrl && settings.supabaseKey) {
                await deleteWeeklyHistoryFromSupabase(settings.supabaseUrl, settings.supabaseKey, id, selectedSocietyId);
                
                // Fetch fresh data from Supabase to ensure we have the latest
                const cloudData = await downloadDataFromSupabase(settings.supabaseUrl, settings.supabaseKey, selectedSocietyId);
                setHistory(cloudData.history);
            } else {
                // Fallback to local state if Supabase not configured
                setHistory(history.filter(h => h.id !== id));
            }
            
            if (selectedRecordId === id) {
                setSelectedRecordId(null);
                setFormData(initialFormState());
            }
        } catch (error: any) {
            alert(`Failed to delete: ${error.message}`);
        }
    };

    const totalAttendance = useMemo(() => {
        const { men, women, junior, children, visitors, catechumens } = formData.attendance;
        return men + women + junior + children + visitors + catechumens;
    }, [formData.attendance]);

    // Calculate completion status - all required sections
    const completionStatus = useMemo(() => {
        const sections = [
            { name: 'Service Details', filled: !!formData.dateOfService && !!formData.officiant && !!formData.liturgist },
            { name: 'Attendance', filled: totalAttendance > 0 },
            { name: 'Visitors', filled: formData.visitorsList.length > 0 || formData.noVisitors },
            { name: 'Donations', filled: formData.donationsList.length > 0 || formData.noDonation },
            { name: 'Worship', filled: !!formData.sermonTopic || !!formData.events },
        ];
        const completed = sections.filter(s => s.filled).length;
        return { sections, completed, total: sections.length };
    }, [formData, totalAttendance]);

    const canSave = completionStatus.completed === completionStatus.total;

    const archiveCount = history.length;

    const historyDates = useMemo(() => {
        return Array.from(new Set(history.map(h => h.dateOfService))).filter(Boolean).sort((a, b) => b.localeCompare(a));
    }, [history]);

    const latestHistoryDate = useMemo(() => historyDates[0] || '', [historyDates]);

    useEffect(() => {
        if (!attendanceDateFilter && latestHistoryDate) {
            setAttendanceDateFilter(latestHistoryDate);
        }
    }, [attendanceDateFilter, latestHistoryDate]);

    const announcementRecord = useMemo(() => {
        if (history.length === 0) return null;
        const targetDate = attendanceDateFilter || latestHistoryDate;
        return history.find(h => h.dateOfService === targetDate) || null;
    }, [attendanceDateFilter, history, latestHistoryDate]);

    const announcementTotals = useMemo(() => {
        if (!announcementRecord) return null;
        const att = announcementRecord.attendance || { men: 0, women: 0, junior: 0, children: 0, visitors: 0, catechumens: 0 };
        const total = att.men + att.women + att.junior + att.children + att.visitors + att.catechumens;
        return { ...att, total };
    }, [announcementRecord]);

    const monthlyAttendance = useMemo(() => {
        const aggregates: Record<string, any> = {};
        history.forEach(h => {
            const monthKey = (h.dateOfService || '').slice(0, 7) || 'Unknown';
            if (!aggregates[monthKey]) {
                aggregates[monthKey] = {
                    month: monthKey,
                    men: 0,
                    women: 0,
                    junior: 0,
                    children: 0,
                    visitors: 0,
                    catechumens: 0,
                    total: 0,
                    count: 0,
                };
            }
            const att = h.attendance || {} as any;
            const men = att.men || 0;
            const women = att.women || 0;
            const junior = att.junior || 0;
            const children = att.children || 0;
            const visitors = att.visitors || 0;
            const catechumens = att.catechumens || 0;
            
            aggregates[monthKey].men += men;
            aggregates[monthKey].women += women;
            aggregates[monthKey].junior += junior;
            aggregates[monthKey].children += children;
            aggregates[monthKey].visitors += visitors;
            aggregates[monthKey].catechumens += catechumens;
            aggregates[monthKey].total += men + women + junior + children + visitors + catechumens;
            aggregates[monthKey].count += 1;
        });
        
        const sorted = Object.values(aggregates).sort((a: any, b: any) => (a.month > b.month ? 1 : -1));
        
        // Calculate trend line (linear regression)
        const totalsByMonth = sorted.map((m: any) => m.total);
        const n = totalsByMonth.length;
        if (n >= 2) {
            const xMean = (n - 1) / 2;
            const yMean = totalsByMonth.reduce((sum, val) => sum + val, 0) / n;
            let numerator = 0;
            let denominator = 0;
            
            totalsByMonth.forEach((y, x) => {
                numerator += (x - xMean) * (y - yMean);
                denominator += Math.pow(x - xMean, 2);
            });
            
            const slope = denominator !== 0 ? numerator / denominator : 0;
            const intercept = yMean - slope * xMean;
            
            // Add trend line value and moving average to each data point
            sorted.forEach((item: any, index: number) => {
                item.trendLine = Math.round(slope * index + intercept);
                
                // Calculate 3-month moving average
                if (index < 2) {
                    item.movingAvg = Math.round(totalsByMonth.slice(0, index + 1).reduce((sum, val) => sum + val, 0) / (index + 1));
                } else {
                    item.movingAvg = Math.round(totalsByMonth.slice(index - 2, index + 1).reduce((sum, val) => sum + val, 0) / 3);
                }
            });
        }
        
        return sorted;
    }, [history]);

    // Analytics & Predictions
    const analytics = useMemo(() => {
        if (monthlyAttendance.length === 0) return null;
        
        const totalsByMonth = monthlyAttendance.map((m: any) => m.total);
        const avgAttendance = totalsByMonth.reduce((sum, val) => sum + val, 0) / totalsByMonth.length;
        
        // Calculate trend (simple linear regression slope)
        const n = totalsByMonth.length;
        const xMean = (n - 1) / 2;
        const yMean = avgAttendance;
        let numerator = 0;
        let denominator = 0;
        
        totalsByMonth.forEach((y, x) => {
            numerator += (x - xMean) * (y - yMean);
            denominator += Math.pow(x - xMean, 2);
        });
        
        const slope = denominator !== 0 ? numerator / denominator : 0;
        const trend = slope > 1 ? 'Growing' : slope < -1 ? 'Declining' : 'Stable';
        const trendPercentage = ((slope / yMean) * 100).toFixed(1);
        
        // Predict next month
        const prediction = Math.round(totalsByMonth[n - 1] + slope);
        
        // Calculate volatility for confidence score
        const squaredDiffs = totalsByMonth.map(val => Math.pow(val - yMean, 2));
        const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / n;
        const stdDev = Math.sqrt(variance);
        const coefficientOfVariation = stdDev / yMean; // 0 = perfect confidence, 1+ = high volatility
        const confidenceScore = Math.max(0, Math.min(95, 95 - (coefficientOfVariation * 50))); // 0-95%
        
        // Category breakdown
        const categoryTotals = {
            men: monthlyAttendance.reduce((sum: number, m: any) => sum + m.men, 0),
            women: monthlyAttendance.reduce((sum: number, m: any) => sum + m.women, 0),
            junior: monthlyAttendance.reduce((sum: number, m: any) => sum + m.junior, 0),
            children: monthlyAttendance.reduce((sum: number, m: any) => sum + m.children, 0),
            visitors: monthlyAttendance.reduce((sum: number, m: any) => sum + m.visitors, 0),
            catechumens: monthlyAttendance.reduce((sum: number, m: any) => sum + m.catechumens, 0),
        };
        
        const total = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);
        const categoryPercentages = Object.entries(categoryTotals).map(([key, value]) => ({
            category: key.charAt(0).toUpperCase() + key.slice(1),
            percentage: ((value / total) * 100).toFixed(1),
            count: value,
        }));
        
        // Category-specific predictions using linear regression for each category
        const categoryPredictions: any = {};
        const categories = ['men', 'women', 'junior', 'children', 'visitors', 'catechumens'] as const;
        
        categories.forEach(category => {
            const categoryValues = monthlyAttendance.map((m: any) => m[category]);
            if (categoryValues.length >= 2) {
                const catYMean = categoryValues.reduce((sum, val) => sum + val, 0) / categoryValues.length;
                let catNumerator = 0;
                let catDenominator = 0;
                
                categoryValues.forEach((y: number, x: number) => {
                    catNumerator += (x - xMean) * (y - catYMean);
                    catDenominator += Math.pow(x - xMean, 2);
                });
                
                const catSlope = catDenominator !== 0 ? catNumerator / catDenominator : 0;
                const catTrend = catSlope > 0.5 ? 'Growing' : catSlope < -0.5 ? 'Declining' : 'Stable';
                const catPrediction = Math.round(categoryValues[categoryValues.length - 1] + catSlope);
                
                categoryPredictions[category] = {
                    current: categoryValues[categoryValues.length - 1],
                    prediction: catPrediction,
                    trend: catTrend,
                    change: catPrediction - categoryValues[categoryValues.length - 1],
                };
            }
        });
        
        // Year-over-Year comparison
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth();
        const historyByYearMonth: any = {};
        
        history.forEach(record => {
            const recordDate = new Date(record.dateOfService);
            const year = recordDate.getFullYear();
            const month = recordDate.getMonth();
            const key = `${year}-${month}`;
            
            if (!historyByYearMonth[key]) {
                historyByYearMonth[key] = { men: 0, women: 0, junior: 0, children: 0, visitors: 0, catechumens: 0, total: 0 };
            }
            
            historyByYearMonth[key].men += record.attendance.men;
            historyByYearMonth[key].women += record.attendance.women;
            historyByYearMonth[key].junior += record.attendance.junior;
            historyByYearMonth[key].children += record.attendance.children;
            historyByYearMonth[key].visitors += record.attendance.visitors;
            historyByYearMonth[key].catechumens += record.attendance.catechumens;
            historyByYearMonth[key].total += record.attendance.men + record.attendance.women + record.attendance.junior + record.attendance.children + record.attendance.visitors + record.attendance.catechumens;
        });
        
        const currentYearMonthKey = `${currentYear}-${currentMonth}`;
        const lastYearMonthKey = `${currentYear - 1}-${currentMonth}`;
        
        const currentYearTotal = historyByYearMonth[currentYearMonthKey]?.total || 0;
        const lastYearTotal = historyByYearMonth[lastYearMonthKey]?.total || 0;
        const yearOverYearChange = lastYearTotal > 0 ? (((currentYearTotal - lastYearTotal) / lastYearTotal) * 100).toFixed(1) : 'N/A';
        const yearOverYearDiff = currentYearTotal - lastYearTotal;
        
        // Growth rate comparison
        const recentMonths = totalsByMonth.slice(-3);
        const olderMonths = totalsByMonth.slice(0, Math.min(3, totalsByMonth.length - 3));
        const recentAvg = recentMonths.length > 0 ? recentMonths.reduce((sum, val) => sum + val, 0) / recentMonths.length : 0;
        const olderAvg = olderMonths.length > 0 ? olderMonths.reduce((sum, val) => sum + val, 0) / olderMonths.length : recentAvg;
        const growthRate = olderAvg > 0 ? (((recentAvg - olderAvg) / olderAvg) * 100).toFixed(1) : '0';
        
        return {
            avgAttendance: Math.round(avgAttendance),
            trend,
            trendPercentage,
            prediction,
            confidenceScore: Math.round(confidenceScore),
            categoryPercentages,
            categoryPredictions,
            growthRate,
            yearOverYearChange,
            yearOverYearDiff,
            currentYearTotal,
            lastYearTotal,
            highestMonth: monthlyAttendance.reduce((max: any, m: any) => m.total > max.total ? m : max, monthlyAttendance[0]),
            lowestMonth: monthlyAttendance.reduce((min: any, m: any) => m.total < min.total ? m : min, monthlyAttendance[0]),
        };
    }, [monthlyAttendance, history]);

    const filteredHistory = useMemo(() => {
        const now = new Date();
        return history.filter(rec => {
            const recDate = new Date(rec.dateOfService);
            return recDate.getMonth() === now.getMonth() && recDate.getFullYear() === now.getFullYear();
        });
    }, [history]);

    return (
        <div className="pb-12 max-w-6xl mx-auto p-4">
            <h2 className="text-3xl font-bold mb-6 text-white bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-3 rounded-lg inline-block">📅 Weekly History</h2>

            {/* Show empty state when no history and no active editing */}
            {history.length === 0 && !selectedRecordId && !isFullEditorOpen ? (
                <div className="text-center py-20 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border-2 border-amber-200">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 mx-auto mb-6 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-3xl font-bold text-slate-800 mb-3">No Weekly History Records Yet</p>
                    <p className="text-lg text-slate-600 mb-6">Start recording your weekly service history to track attendance, visitors, and events.</p>
                    <button 
                        onClick={() => {
                            setFormData(initialFormState());
                            setSelectedRecordId(null);
                            setIsFullEditorOpen(true);
                        }}
                        className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 text-base"
                    >
                        ✏️ Create First Record
                    </button>
                </div>
            ) : (
                <>

            <div className="bg-gradient-to-br from-amber-50 via-white to-lime-50 border-2 border-amber-200 rounded-xl p-5 mb-6 shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                    <div>
                        <h3 className="text-base font-bold text-amber-800 flex items-center gap-2">
                            📣 Attendance Snapshot for Announcements
                        </h3>
                        <p className="text-xs text-amber-600 mt-1">Shows the most recent attendance (or pick a date below).</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                        <div>
                            <label className="block text-xs font-bold text-amber-700 mb-1">Select Date</label>
                            <select
                                value={attendanceDateFilter}
                                onChange={e => setAttendanceDateFilter(e.target.value)}
                                className="border-2 border-amber-200 rounded-lg px-3 py-2 text-sm font-semibold text-amber-800 bg-white focus:ring-2 focus:ring-amber-300 focus:border-amber-300"
                            >
                                {historyDates.length === 0 && <option value="">No attendance recorded</option>}
                                {historyDates.map(date => (
                                    <option key={date} value={date}>{date}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            type="button"
                            onClick={() => setAttendanceDateFilter(latestHistoryDate || '')}
                            disabled={!latestHistoryDate}
                            className={`px-4 py-2 rounded-lg text-sm font-bold border-2 transition-all ${latestHistoryDate ? 'border-amber-300 text-amber-800 hover:bg-amber-100' : 'border-slate-200 text-slate-400 cursor-not-allowed bg-slate-50'}`}
                        >
                            Jump to Latest
                        </button>
                    </div>
                </div>

                {announcementTotals ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-white/80 border-2 border-amber-100 rounded-lg p-3">
                            <div className="text-xs uppercase font-bold text-amber-700">Total</div>
                            <div className="text-2xl font-extrabold text-amber-900">{announcementTotals.total.toLocaleString()}</div>
                            {announcementRecord?.officiant && <div className="text-[11px] text-amber-600">Officiant: {announcementRecord.officiant}</div>}
                        </div>
                        <div className="bg-white/80 border-2 border-amber-100 rounded-lg p-3">
                            <div className="text-xs uppercase font-bold text-amber-700">Men / Women</div>
                            <div className="text-xl font-bold text-amber-900">{announcementTotals.men} / {announcementTotals.women}</div>
                        </div>
                        <div className="bg-white/80 border-2 border-amber-100 rounded-lg p-3">
                            <div className="text-xs uppercase font-bold text-amber-700">Junior / Children</div>
                            <div className="text-xl font-bold text-amber-900">{announcementTotals.junior} / {announcementTotals.children}</div>
                        </div>
                        <div className="bg-white/80 border-2 border-amber-100 rounded-lg p-3">
                            <div className="text-xs uppercase font-bold text-amber-700">Visitors / Catechumens</div>
                            <div className="text-xl font-bold text-amber-900">{announcementTotals.visitors} / {announcementTotals.catechumens}</div>
                        </div>
                    </div>
                ) : (
                    <div className="text-sm text-amber-700 bg-white/70 border-2 border-amber-100 rounded-lg p-4 text-center">
                        No attendance recorded for the selected date yet.
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <button 
                    onClick={() => { setShowArchive(true); setEditingArchiveId(null); }} 
                    className="group bg-gradient-to-br from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white font-bold py-4 px-6 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 flex items-center justify-between gap-3"
                >
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">📚</span>
                        <span className="text-lg">Archives</span>
                    </div>
                    <span className="bg-white/30 group-hover:bg-white/40 rounded-full px-4 py-1 text-sm font-bold backdrop-blur-sm">{archiveCount}</span>
                </button>
                <button 
                    onClick={() => { const newForm = initialFormState(); setFormData(newForm); setSelectedRecordId(null); setIsFullEditorOpen(true); }} 
                    className="bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold py-4 px-6 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 flex items-center justify-center gap-3"
                >
                    <span className="text-3xl">✏️</span>
                    <span className="text-lg">New Entry</span>
                </button>
                <button 
                    onClick={() => { const newForm = initialFormState(); setFormData(newForm); setSelectedRecordId(null); setActiveModal(null); setIsFullEditorOpen(false); }} 
                    className="bg-gradient-to-br from-gray-200 to-gray-300 hover:from-gray-300 hover:to-gray-400 text-gray-800 font-bold py-4 px-6 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 flex items-center justify-center gap-3"
                >
                    <span className="text-3xl">🔄</span>
                    <span className="text-lg">Reset</span>
                </button>
            </div>

            <div className="bg-gradient-to-br from-blue-50 via-white to-purple-50 border-2 border-blue-200 rounded-xl p-5 mb-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                            📊 Monthly Attendance Overview
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">Stacked totals per category</p>
                    </div>
                    <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-3 py-1 rounded-full">
                        {monthlyAttendance.length} months
                    </span>
                </div>
                {monthlyAttendance.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-4xl mb-2">📈</div>
                        <div className="text-sm text-gray-500 font-medium">No attendance data yet</div>
                        <div className="text-xs text-gray-400 mt-1">Create a record to see monthly trends</div>
                    </div>
                ) : (
                    <div className="h-72 mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart 
                                data={monthlyAttendance} 
                                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                            >
                                <defs>
                                    <linearGradient id="menGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9}/>
                                        <stop offset="100%" stopColor="#1e40af" stopOpacity={0.8}/>
                                    </linearGradient>
                                    <linearGradient id="womenGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#ec4899" stopOpacity={0.9}/>
                                        <stop offset="100%" stopColor="#be185d" stopOpacity={0.8}/>
                                    </linearGradient>
                                    <linearGradient id="juniorGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.9}/>
                                        <stop offset="100%" stopColor="#d97706" stopOpacity={0.8}/>
                                    </linearGradient>
                                    <linearGradient id="childrenGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.9}/>
                                        <stop offset="100%" stopColor="#059669" stopOpacity={0.8}/>
                                    </linearGradient>
                                    <linearGradient id="visitorsGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.9}/>
                                        <stop offset="100%" stopColor="#6d28d9" stopOpacity={0.8}/>
                                    </linearGradient>
                                    <linearGradient id="catechumensGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0.9}/>
                                        <stop offset="100%" stopColor="#dc2626" stopOpacity={0.8}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                                <XAxis 
                                    dataKey="month" 
                                    tick={{ fontSize: 12, fill: '#4b5563', fontWeight: 600 }} 
                                    angle={-45} 
                                    textAnchor="end" 
                                    height={70}
                                    stroke="#9ca3af"
                                />
                                <YAxis 
                                    tick={{ fontSize: 12, fill: '#4b5563', fontWeight: 600 }} 
                                    allowDecimals={false}
                                    stroke="#9ca3af"
                                    label={{ value: 'Attendance', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6b7280', fontWeight: 600 } }}
                                />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: 'rgba(255, 255, 255, 0.98)', 
                                        border: '2px solid #e5e7eb', 
                                        borderRadius: '12px',
                                        boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                                        padding: '12px'
                                    }}
                                    labelStyle={{ fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}
                                    itemStyle={{ fontSize: '13px', padding: '4px 0' }}
                                    formatter={(value, name) => {
                                        if (name === 'trendLine') return [Math.round(value as number), '📉 Trend Line'];
                                        if (name === 'movingAvg') return [Math.round(value as number), '📊 3-Month Avg'];
                                        return [value, name];
                                    }}
                                />
                                <Legend 
                                    wrapperStyle={{ 
                                        fontSize: 13, 
                                        fontWeight: 600,
                                        paddingTop: '15px'
                                    }}
                                    iconType="circle"
                                />
                                <Bar dataKey="men" stackId="a" fill="url(#menGradient)" name="Men" radius={[0, 0, 0, 0]} barSize={45} />
                                <Bar dataKey="women" stackId="a" fill="url(#womenGradient)" name="Women" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="junior" stackId="a" fill="url(#juniorGradient)" name="Junior" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="children" stackId="a" fill="url(#childrenGradient)" name="Children" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="visitors" stackId="a" fill="url(#visitorsGradient)" name="Visitors" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="catechumens" stackId="a" fill="url(#catechumensGradient)" name="Catechumens" radius={[4, 4, 0, 0]} />
                                <Line type="monotone" dataKey="trendLine" stroke="#ef4444" strokeWidth={3} dot={false} strokeDasharray="5 5" name="📉 Trend Line" isAnimationActive={false} />
                                <Line type="monotone" dataKey="movingAvg" stroke="#3b82f6" strokeWidth={2.5} dot={false} name="📊 3-Month Avg" isAnimationActive={false} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Analytics & Predictions Section */}
            {analytics && (
                <div className="bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 border-2 border-emerald-300 rounded-2xl p-6 mb-6 shadow-2xl">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-3">
                                <span className="text-3xl">📈</span>
                                Analytics & Predictions
                            </h3>
                            <p className="text-sm text-gray-600 mt-2">AI-powered insights based on historical data</p>
                        </div>
                        <span className="text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold px-5 py-2 rounded-full shadow-lg">
                            {monthlyAttendance.length} months analyzed
                        </span>
                    </div>

                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-6">
                        <div className="group bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-2xl p-5 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 text-white">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-2xl">👥</span>
                                <div className="text-xs font-semibold opacity-90">Average Attendance</div>
                            </div>
                            <div className="text-4xl font-black mb-1">{analytics.avgAttendance}</div>
                            <div className="text-xs opacity-80">per month</div>
                        </div>
                        
                        <div className={`group rounded-2xl p-5 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 text-white ${
                            analytics.trend === 'Growing' ? 'bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700' : 
                            analytics.trend === 'Declining' ? 'bg-gradient-to-br from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700' : 
                            'bg-gradient-to-br from-gray-500 to-slate-600 hover:from-gray-600 hover:to-slate-700'
                        }`}>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-2xl">{analytics.trend === 'Growing' ? '📈' : analytics.trend === 'Declining' ? '📉' : '➡️'}</span>
                                <div className="text-xs font-semibold opacity-90">Trend</div>
                            </div>
                            <div className="text-4xl font-black mb-1">{analytics.trend}</div>
                            <div className="text-xs opacity-80">{analytics.trendPercentage}% rate</div>
                        </div>
                        
                        <div className="group bg-gradient-to-br from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 rounded-2xl p-5 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 text-white">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-2xl">🔮</span>
                                <div className="text-xs font-semibold opacity-90">Next Month</div>
                            </div>
                            <div className="text-4xl font-black mb-1">{analytics.prediction}</div>
                            <div className="text-xs opacity-80">{analytics.confidenceScore}% confidence</div>
                        </div>
                        
                        <div className={`group rounded-2xl p-5 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 text-white ${
                            parseFloat(analytics.growthRate) > 0 ? 'bg-gradient-to-br from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700' : 
                            parseFloat(analytics.growthRate) < 0 ? 'bg-gradient-to-br from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700' : 
                            'bg-gradient-to-br from-gray-500 to-slate-600 hover:from-gray-600 hover:to-slate-700'
                        }`}>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-2xl">{parseFloat(analytics.growthRate) > 0 ? '⬆️' : parseFloat(analytics.growthRate) < 0 ? '⬇️' : '➡️'}</span>
                                <div className="text-xs font-semibold opacity-90">Recent Growth</div>
                            </div>
                            <div className="text-4xl font-black mb-1">{analytics.growthRate > 0 ? '+' : ''}{analytics.growthRate}%</div>
                            <div className="text-xs opacity-80">last 3 months</div>
                        </div>
                    </div>

                    {/* Category Breakdown */}
                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border-2 border-white shadow-lg mb-5">
                        <h4 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <span className="text-xl">📊</span>
                            Category Distribution
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {analytics.categoryPercentages.map((cat: any) => (
                                <div key={cat.category} className="group bg-gradient-to-br from-gray-50 to-gray-100 hover:from-white hover:to-gray-50 rounded-xl p-4 border border-gray-200 hover:border-gray-300 transition-all duration-300 hover:scale-105 shadow-sm hover:shadow-md">
                                    <span className="text-sm font-bold text-gray-700 block mb-2">{cat.category}</span>
                                    <div className="flex items-baseline gap-2">
                                        <div className="text-2xl font-black text-indigo-600">{cat.percentage}%</div>
                                        <div className="text-xs text-gray-500">{cat.count} total</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Category-Specific Predictions */}
                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border-2 border-white shadow-lg mb-5">
                        <h4 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <span className="text-xl">🎯</span>
                            Category Predictions
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {Object.entries(analytics.categoryPredictions).map(([category, data]: any) => (
                                <div key={category} className={`rounded-xl p-4 border-2 transition-all duration-300 ${
                                    data.trend === 'Growing' ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-300 hover:shadow-lg' :
                                    data.trend === 'Declining' ? 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-300 hover:shadow-lg' :
                                    'bg-gradient-to-br from-slate-50 to-gray-50 border-gray-300 hover:shadow-lg'
                                }`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm font-bold text-gray-700">{category.charAt(0).toUpperCase() + category.slice(1)}</span>
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                                            data.trend === 'Growing' ? 'bg-green-200 text-green-800' :
                                            data.trend === 'Declining' ? 'bg-orange-200 text-orange-800' :
                                            'bg-gray-200 text-gray-800'
                                        }`}>
                                            {data.trend === 'Growing' ? '📈' : data.trend === 'Declining' ? '📉' : '➡️'} {data.trend}
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-gray-600">Current:</span>
                                            <span className="font-bold text-gray-800">{data.current}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-gray-600">Predicted:</span>
                                            <span className={`font-bold ${data.change > 0 ? 'text-green-700' : data.change < 0 ? 'text-orange-700' : 'text-gray-700'}`}>
                                                {data.prediction} {data.change > 0 ? `(+${data.change})` : data.change < 0 ? `(${data.change})` : ''}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Year-over-Year Comparison */}
                    <div className="bg-gradient-to-br from-cyan-100 to-blue-100 border-2 border-cyan-300 rounded-2xl p-5 shadow-lg mb-5">
                        <h4 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <span className="text-xl">📊</span>
                            Year-over-Year Comparison
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white/60 rounded-xl p-4 border border-white">
                                <div className="text-xs font-semibold text-gray-600 mb-2">This Year (Current Month)</div>
                                <div className="text-3xl font-black text-blue-700">{analytics.currentYearTotal}</div>
                                <div className="text-xs text-gray-500 mt-1">Total attendance</div>
                            </div>
                            <div className="bg-white/60 rounded-xl p-4 border border-white">
                                <div className="text-xs font-semibold text-gray-600 mb-2">Last Year (Same Month)</div>
                                <div className="text-3xl font-black text-gray-600">{analytics.lastYearTotal}</div>
                                <div className="text-xs text-gray-500 mt-1">Total attendance</div>
                            </div>
                            <div className={`rounded-xl p-4 border-2 ${
                                analytics.yearOverYearDiff > 0 ? 'bg-gradient-to-br from-green-100 to-emerald-100 border-green-400' :
                                analytics.yearOverYearDiff < 0 ? 'bg-gradient-to-br from-orange-100 to-amber-100 border-orange-400' :
                                'bg-gradient-to-br from-gray-100 to-slate-100 border-gray-400'
                            }`}>
                                <div className="text-xs font-semibold text-gray-700 mb-2">Year-over-Year Change</div>
                                <div className={`text-3xl font-black ${
                                    analytics.yearOverYearDiff > 0 ? 'text-green-700' :
                                    analytics.yearOverYearDiff < 0 ? 'text-orange-700' :
                                    'text-gray-700'
                                }`}>
                                    {analytics.yearOverYearChange}%
                                </div>
                                <div className={`text-xs font-bold mt-1 ${
                                    analytics.yearOverYearDiff > 0 ? 'text-green-700' :
                                    analytics.yearOverYearDiff < 0 ? 'text-orange-700' :
                                    'text-gray-700'
                                }`}>
                                    {analytics.yearOverYearDiff > 0 ? '+' : ''}{analytics.yearOverYearDiff} attendees
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* High/Low Months */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gradient-to-br from-green-100 to-emerald-100 rounded-lg p-4 border border-green-300">
                            <div className="text-xs text-green-700 font-semibold mb-1">🏆 Highest Month</div>
                            <div className="text-xl font-bold text-green-800">{analytics.highestMonth.month}</div>
                            <div className="text-sm text-green-700 mt-1">{analytics.highestMonth.total} attendees</div>
                        </div>
                        <div className="bg-gradient-to-br from-orange-100 to-amber-100 rounded-lg p-4 border border-orange-300">
                            <div className="text-xs text-orange-700 font-semibold mb-1">📉 Lowest Month</div>
                            <div className="text-xl font-bold text-orange-800">{analytics.lowestMonth.month}</div>
                            <div className="text-sm text-orange-700 mt-1">{analytics.lowestMonth.total} attendees</div>
                        </div>
                    </div>
                </div>
            )}



            {activeModal === 'details' && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4 text-gray-900">📋 Service Details</h2>
                        <div className="space-y-3 mb-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Date of Service *</label>
                                <input type="date" name="dateOfService" value={formData.dateOfService} onChange={handleChange} className="w-full border-2 border-blue-300 rounded p-2"/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Preacher *</label>
                                <input type="text" name="officiant" value={formData.officiant} onChange={handleChange} placeholder="e.g., Rev. John Doe" className="w-full border-2 border-blue-300 rounded p-2"/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Liturgist *</label>
                                <input type="text" name="liturgist" value={formData.liturgist} onChange={handleChange} placeholder="e.g., Bro. John Smith" className="w-full border-2 border-blue-300 rounded p-2"/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Prepared By</label>
                                <input type="text" name="preparedBy" value={formData.preparedBy} onChange={handleChange} placeholder="Person preparing this report" className="w-full border-2 rounded p-2" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-2">Service Types *</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {serviceTypeOptions.map(type => (
                                        <label key={type} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-blue-50 border border-blue-200">
                                            <input 
                                                type="checkbox" 
                                                checked={formData.serviceTypes.includes(type)}
                                                onChange={() => handleServiceTypeToggle(type)}
                                                className="w-4 h-4"
                                            />
                                            <span className="text-xs font-bold text-gray-700">{type}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            {formData.serviceTypes.includes('Other') && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Specify Other Service Type</label>
                                    <input type="text" name="serviceTypeOther" value={formData.serviceTypeOther} onChange={handleChange} placeholder="Please specify" className="w-full border-2 rounded p-2"/>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setActiveModal(null)} className="flex-1 bg-gray-300 text-gray-900 py-2 rounded font-bold hover:bg-gray-400">Cancel</button>
                            <button onClick={() => { setActiveModal(null); }} className="flex-1 bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700">Done</button>
                        </div>
                    </div>
                </div>
            )}

            {activeModal === 'attendance' && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-sm w-full p-6">
                        <h2 className="text-xl font-bold mb-4 text-gray-900">👥 Attendance Breakdown</h2>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div>
                                <label className="text-xs font-bold text-gray-700">Men</label>
                                <input type="number" name="men" value={formData.attendance.men} onChange={handleAttendanceChange} className="w-full border-2 border-emerald-300 rounded p-1"/>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-700">Women</label>
                                <input type="number" name="women" value={formData.attendance.women} onChange={handleAttendanceChange} className="w-full border-2 border-emerald-300 rounded p-1"/>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-700">Junior</label>
                                <input type="number" name="junior" value={formData.attendance.junior} onChange={handleAttendanceChange} className="w-full border-2 border-emerald-300 rounded p-1"/>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-700">Children</label>
                                <input type="number" name="children" value={formData.attendance.children} onChange={handleAttendanceChange} className="w-full border-2 border-emerald-300 rounded p-1"/>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-700">Visitors</label>
                                <input type="number" name="visitors" value={formData.attendance.visitors} onChange={handleAttendanceChange} className="w-full border-2 border-emerald-300 rounded p-1"/>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-700">Catechumens</label>
                                <input type="number" name="catechumens" value={formData.attendance.catechumens} onChange={handleAttendanceChange} className="w-full border-2 border-emerald-300 rounded p-1"/>
                            </div>
                        </div>
                        <div className={`text-lg font-bold p-3 rounded mb-4 ${totalAttendance > 0 ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-900'}`}>
                            Total Attendance: {totalAttendance}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setActiveModal(null)} className="flex-1 bg-gray-300 text-gray-900 py-2 rounded font-bold hover:bg-gray-400">Cancel</button>
                            <button onClick={() => setActiveModal(null)} className="flex-1 bg-emerald-600 text-white py-2 rounded font-bold hover:bg-emerald-700">Done</button>
                        </div>
                    </div>
                </div>
            )}

            {activeModal === 'visitors' && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4 text-gray-900">🤝 Visitors List ({formData.visitorsList.length})</h2>
                        
                        {/* Add New Visitor */}
                        <div className="bg-purple-50 border-2 border-purple-200 p-3 rounded-lg mb-4">
                            <h3 className="font-bold text-sm text-purple-900 mb-3">Add New Visitor</h3>
                            <div className="space-y-2">
                                <input 
                                    type="text" 
                                    value={newVisitor.name}
                                    onChange={(e) => setNewVisitor(prev => ({...prev, name: e.target.value}))}
                                    placeholder="Visitor Name *"
                                    className="w-full border-2 border-purple-300 rounded p-2 text-sm"
                                />
                                <input 
                                    type="text" 
                                    value={newVisitor.from}
                                    onChange={(e) => setNewVisitor(prev => ({...prev, from: e.target.value}))}
                                    placeholder="From (church/location)"
                                    className="w-full border-2 rounded p-2 text-sm"
                                />
                                <input 
                                    type="text" 
                                    value={newVisitor.position}
                                    onChange={(e) => setNewVisitor(prev => ({...prev, position: e.target.value}))}
                                    placeholder="Position/Role (optional)"
                                    className="w-full border-2 rounded p-2 text-sm"
                                />
                                <input 
                                    type="text" 
                                    value={newVisitor.reason}
                                    onChange={(e) => setNewVisitor(prev => ({...prev, reason: e.target.value}))}
                                    placeholder="Reason for visit (optional)"
                                    className="w-full border-2 rounded p-2 text-sm"
                                />
                                <button 
                                    onClick={handleAddVisitor}
                                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded text-sm"
                                >
                                    ➕ Add Visitor
                                </button>
                            </div>
                        </div>

                        {/* List of Visitors */}
                        <div className="mb-4 space-y-2 max-h-48 overflow-y-auto">
                            {formData.visitorsList.length > 0 ? (
                                formData.visitorsList.map((v, i) => (
                                    <div key={i} className="text-sm bg-purple-100 p-3 rounded border border-purple-300 flex justify-between items-start gap-2">
                                        <div className="flex-1">
                                            <div className="font-bold text-purple-900">{v.name}</div>
                                            {v.from && <div className="text-xs text-purple-700">From: {v.from}</div>}
                                            {v.position && <div className="text-xs text-purple-700">Position: {v.position}</div>}
                                            {v.reason && <div className="text-xs text-purple-700">Reason: {v.reason}</div>}
                                        </div>
                                        <button 
                                            onClick={() => handleRemoveVisitor(i)}
                                            className="text-red-600 hover:text-red-800 font-bold text-lg"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-4 text-gray-500">{formData.noVisitors ? '✓ No visitors recorded' : 'No visitors recorded yet'}</div>
                            )}
                        </div>
                        
                        <div className="flex gap-2">
                            <button onClick={() => setActiveModal(null)} className="flex-1 bg-gray-300 text-gray-900 py-2 rounded font-bold hover:bg-gray-400">Cancel</button>
                            <button onClick={() => setActiveModal(null)} className="flex-1 bg-purple-600 text-white py-2 rounded font-bold hover:bg-purple-700">Done</button>
                        </div>
                    </div>
                </div>
            )}

            {activeModal === 'donations' && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4 text-gray-900">💝 Donations ({formData.donationsList.length})</h2>
                        
                        {/* Add New Donation */}
                        <div className="bg-rose-50 border-2 border-rose-200 p-3 rounded-lg mb-4">
                            <h3 className="font-bold text-sm text-rose-900 mb-3">Add New Donation</h3>
                            <div className="space-y-2">
                                <input 
                                    type="text" 
                                    value={newDonor.donor}
                                    onChange={(e) => setNewDonor(prev => ({...prev, donor: e.target.value}))}
                                    placeholder="Donor Name *"
                                    className="w-full border-2 border-rose-300 rounded p-2 text-sm"
                                />
                                <input 
                                    type="number" 
                                    value={newDonor.amount || ''}
                                    onChange={(e) => setNewDonor(prev => ({...prev, amount: parseFloat(e.target.value) || 0}))}
                                    placeholder="Amount *"
                                    className="w-full border-2 border-rose-300 rounded p-2 text-sm"
                                    min="0"
                                    step="0.01"
                                />
                                <input 
                                    type="text" 
                                    value={newDonor.description}
                                    onChange={(e) => setNewDonor(prev => ({...prev, description: e.target.value}))}
                                    placeholder="Description/Purpose (optional)"
                                    className="w-full border-2 rounded p-2 text-sm"
                                />
                                <button 
                                    onClick={handleAddDonation}
                                    className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 rounded text-sm"
                                >
                                    ➕ Add Donation
                                </button>
                            </div>
                        </div>

                        {/* No Donation Checkbox */}
                        <div className="mb-4 p-3 bg-rose-50 border-2 border-rose-200 rounded-lg">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.noDonation || false}
                                    onChange={(e) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            noDonation: e.target.checked,
                                            donationsList: e.target.checked ? [] : prev.donationsList
                                        }));
                                    }}
                                    className="w-4 h-4 cursor-pointer"
                                />
                                <span className="text-sm font-bold text-rose-900">No donations received this week</span>
                            </label>
                        </div>

                        {/* List of Donations */}
                        <div className="mb-4 space-y-2 max-h-48 overflow-y-auto">
                            {formData.donationsList.length > 0 ? (
                                formData.donationsList.map((d, i) => (
                                    <div key={i} className="text-sm bg-rose-100 p-3 rounded border border-rose-300 flex justify-between items-start gap-2">
                                        <div className="flex-1">
                                            <div className="font-bold text-rose-900">{formatCurrency(d.amount)}</div>
                                            {d.donor && <div className="text-xs text-rose-700">From: {d.donor}</div>}
                                            {d.description && <div className="text-xs text-rose-700">{d.description}</div>}
                                        </div>
                                        <button 
                                            onClick={() => handleRemoveDonation(i)}
                                            className="text-red-600 hover:text-red-800 font-bold text-lg"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-4 text-gray-500">{formData.noDonation ? '✓ No donations recorded' : 'No donations recorded yet'}</div>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <button onClick={() => setActiveModal(null)} className="flex-1 bg-gray-300 text-gray-900 py-2 rounded font-bold hover:bg-gray-400">Cancel</button>
                            <button onClick={() => setActiveModal(null)} className="flex-1 bg-rose-600 text-white py-2 rounded font-bold hover:bg-rose-700">Done</button>
                        </div>
                    </div>
                </div>
            )}

            {activeModal === 'events' && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-sm w-full p-6">
                        <h2 className="text-xl font-bold mb-4 text-gray-900">🙏 Worship & Events</h2>
                        <div className="space-y-3 mb-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Sermon Topic *</label>
                                    <input 
                                        type="text" 
                                        name="sermonTopic" 
                                        value={formData.sermonTopic} 
                                        onChange={handleChange} 
                                        placeholder="Main sermon topic"
                                        className="w-full border-2 border-orange-300 rounded p-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Memory Verse</label>
                                    <input 
                                        type="text" 
                                        name="memoryVerse" 
                                        value={formData.memoryVerse} 
                                        onChange={handleChange} 
                                        placeholder="e.g., John 3:16"
                                        className="w-full border-2 border-orange-300 rounded p-2"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Special Events / Announcements</label>
                                <textarea 
                                    name="events" 
                                    value={formData.events} 
                                    onChange={handleChange} 
                                    placeholder="Special events, announcements, highlights..." 
                                    className="w-full border-2 rounded p-2" 
                                    rows={3}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Worship Highlights</label>
                                <textarea 
                                    name="worshipHighlights" 
                                    value={formData.worshipHighlights} 
                                    onChange={handleChange} 
                                    placeholder="Special moments during worship..." 
                                    className="w-full border-2 rounded p-2" 
                                    rows={2}
                                />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setActiveModal(null)} className="flex-1 bg-gray-300 text-gray-900 py-2 rounded font-bold hover:bg-gray-400">Cancel</button>
                            <button onClick={() => setActiveModal(null)} className="flex-1 bg-orange-600 text-white py-2 rounded font-bold hover:bg-orange-700">Done</button>
                        </div>
                    </div>
                </div>
            )}

            {isFullEditorOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-gradient-to-r from-amber-600 to-orange-600 text-white p-4 rounded-t-2xl flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-extrabold">{selectedRecordId ? 'Edit Weekly History' : 'New Weekly History'}</h3>
                                <p className="text-sm opacity-90">{selectedRecordId ? 'Update the form below and save changes.' : 'Fill all sections below, then save.'}</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setIsFullEditorOpen(false)}
                                    className="bg-white/20 hover:bg-white/30 text-white font-bold py-2 px-4 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => { handleSubmit(); setIsFullEditorOpen(false); }}
                                    className={`font-extrabold py-2 px-4 rounded-lg shadow ${canSave ? 'bg-white text-amber-700' : 'bg-amber-300 text-amber-800 opacity-75 cursor-not-allowed'}`}
                                    disabled={!canSave}
                                >
                                    Save
                                </button>
                                <button
                                    onClick={handleSaveAndReset}
                                    className={`font-extrabold py-2 px-4 rounded-lg shadow ${canSave ? 'bg-amber-100 text-amber-900' : 'bg-amber-200 text-amber-700 opacity-75 cursor-not-allowed'}`}
                                    disabled={!canSave}
                                >
                                    Save & New
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Completion Status Bar - Sticky */}
                            <div className="sticky top-0 z-40 bg-gradient-to-r from-amber-50 to-orange-50 border-b-2 border-amber-200 p-4 -m-6 mb-6 px-6">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-bold text-sm text-amber-900">Completion Status: {completionStatus.completed}/{completionStatus.total}</h4>
                                    <span className={`text-sm font-bold ${canSave ? 'text-green-600' : 'text-red-600'}`}>
                                        {canSave ? '✓ Ready to Save' : '⚠️ Incomplete'}
                                    </span>
                                </div>
                                <div className="w-full bg-amber-200 rounded-full h-2 mb-3">
                                    <div 
                                        className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${(completionStatus.completed / completionStatus.total) * 100}%` }}
                                    ></div>
                                </div>
                                {completionStatus.sections.some(s => !s.filled) && (
                                    <div className="text-sm font-semibold text-red-700">
                                        Missing: {completionStatus.sections.filter(s => !s.filled).map(s => s.name).join(', ')}
                                    </div>
                                )}
                            </div>
                            {/* Service Details */}
                            <section className="border-2 border-blue-200 rounded-xl p-4 bg-blue-50">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-2xl">📋</span>
                                    <h4 className="text-blue-900 font-bold">Service Details</h4>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Date of Service *</label>
                                        <input type="date" name="dateOfService" value={formData.dateOfService} onChange={handleChange} className="w-full border-2 border-blue-300 rounded p-2" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Preacher *</label>
                                        <input type="text" name="officiant" value={formData.officiant} onChange={handleChange} placeholder="e.g., Rev. John Doe" className="w-full border-2 border-blue-300 rounded p-2" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Liturgist *</label>
                                        <input type="text" name="liturgist" value={formData.liturgist} onChange={handleChange} placeholder="e.g., Bro. John Smith" className="w-full border-2 border-blue-300 rounded p-2" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Prepared By</label>
                                        <input type="text" name="preparedBy" value={formData.preparedBy} onChange={handleChange} placeholder="Person preparing this report" className="w-full border-2 rounded p-2" />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-bold text-gray-700 mb-2">Service Types *</label>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {serviceTypeOptions.map(type => (
                                                <label key={type} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-blue-100 border border-blue-200">
                                                    <input type="checkbox" checked={formData.serviceTypes.includes(type)} onChange={() => handleServiceTypeToggle(type)} className="w-4 h-4" />
                                                    <span className="text-xs font-bold text-gray-700">{type}</span>
                                                </label>
                                            ))}
                                        </div>
                                        {formData.serviceTypes.includes('Other') && (
                                            <div className="mt-2">
                                                <label className="block text-xs font-bold text-gray-700 mb-1">Specify Other Service Type</label>
                                                <input type="text" name="serviceTypeOther" value={formData.serviceTypeOther} onChange={handleChange} placeholder="Please specify" className="w-full border-2 rounded p-2" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>

                            {/* Attendance */}
                            <section className="border-2 border-emerald-200 rounded-xl p-4 bg-emerald-50">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-2xl">👥</span>
                                    <h4 className="text-emerald-900 font-bold">Attendance</h4>
                                    <span className="ml-auto text-emerald-700 font-bold">Total: {totalAttendance}</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {(['men','women','junior','children','visitors','catechumens'] as const).map(key => (
                                        <div key={key}>
                                            <label className="text-xs font-bold text-gray-700 capitalize">{key}</label>
                                            <input type="number" name={key} value={(formData.attendance as any)[key]} onChange={handleAttendanceChange} className="w-full border-2 border-emerald-300 rounded p-1" />
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* Visitors */}
                            <section className="border-2 border-purple-200 rounded-xl p-4 bg-purple-50">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-2xl">🤝</span>
                                    <h4 className="text-purple-900 font-bold">Visitors ({formData.visitorsList.length})</h4>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                                    <input type="text" value={newVisitor.name} onChange={(e) => setNewVisitor(prev => ({ ...prev, name: e.target.value }))} placeholder="Visitor Name *" className="w-full border-2 border-purple-300 rounded p-2 text-sm" />
                                    <input type="text" value={newVisitor.from} onChange={(e) => setNewVisitor(prev => ({ ...prev, from: e.target.value }))} placeholder="From (church/location)" className="w-full border-2 rounded p-2 text-sm" />
                                    <input type="text" value={newVisitor.position} onChange={(e) => setNewVisitor(prev => ({ ...prev, position: e.target.value }))} placeholder="Position/Role (optional)" className="w-full border-2 rounded p-2 text-sm" />
                                    <input type="text" value={newVisitor.reason} onChange={(e) => setNewVisitor(prev => ({ ...prev, reason: e.target.value }))} placeholder="Reason for visit (optional)" className="w-full border-2 rounded p-2 text-sm" />
                                </div>
                                <button onClick={handleAddVisitor} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded text-sm">➕ Add Visitor</button>
                                <div className="mt-3 p-3 bg-white border-2 border-purple-200 rounded-lg">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.noVisitors || false}
                                            onChange={(e) => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    noVisitors: e.target.checked,
                                                    visitorsList: e.target.checked ? [] : prev.visitorsList
                                                }));
                                            }}
                                            className="w-4 h-4 cursor-pointer"
                                        />
                                        <span className="text-sm font-bold text-purple-900">No visitors this week</span>
                                    </label>
                                </div>
                                <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                                    {formData.visitorsList.length > 0 ? (
                                        formData.visitorsList.map((v, i) => (
                                            <div key={i} className="text-sm bg-purple-100 p-3 rounded border border-purple-300 flex justify-between items-start gap-2">
                                                <div className="flex-1">
                                                    <div className="font-bold text-purple-900">{v.name}</div>
                                                    {v.from && <div className="text-xs text-purple-700">From: {v.from}</div>}
                                                    {v.position && <div className="text-xs text-purple-700">Position: {v.position}</div>}
                                                    {v.reason && <div className="text-xs text-purple-700">Reason: {v.reason}</div>}
                                                </div>
                                                <button onClick={() => handleRemoveVisitor(i)} className="text-red-600 hover:text-red-800 font-bold text-lg">×</button>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-2 text-gray-500">{formData.noVisitors ? '✓ No visitors recorded' : 'No visitors recorded yet'}</div>
                                    )}
                                </div>
                            </section>

                            {/* Donations */}
                            <section className="border-2 border-rose-200 rounded-xl p-4 bg-rose-50">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-2xl">💝</span>
                                    <h4 className="text-rose-900 font-bold">Donations ({formData.donationsList.length})</h4>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                                    <input type="text" value={newDonor.donor} onChange={(e) => setNewDonor(prev => ({ ...prev, donor: e.target.value }))} placeholder="Donor Name *" className="w-full border-2 border-rose-300 rounded p-2 text-sm" />
                                    <input type="number" value={newDonor.amount || ''} onChange={(e) => setNewDonor(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))} placeholder="Amount *" className="w-full border-2 border-rose-300 rounded p-2 text-sm" min="0" step="0.01" />
                                    <input type="text" value={newDonor.description} onChange={(e) => setNewDonor(prev => ({ ...prev, description: e.target.value }))} placeholder="Description/Purpose (optional)" className="w-full border-2 rounded p-2 text-sm" />
                                </div>
                                <button onClick={handleAddDonation} className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded text-sm">➕ Add Donation</button>
                                <div className="mt-3 p-3 bg-white border-2 border-rose-200 rounded-lg">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.noDonation || false}
                                            onChange={(e) => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    noDonation: e.target.checked,
                                                    donationsList: e.target.checked ? [] : prev.donationsList
                                                }));
                                            }}
                                            className="w-4 h-4 cursor-pointer"
                                        />
                                        <span className="text-sm font-bold text-rose-900">No donations received this week</span>
                                    </label>
                                </div>
                                <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                                    {formData.donationsList.length > 0 ? (
                                        formData.donationsList.map((d, i) => (
                                            <div key={i} className="text-sm bg-rose-100 p-3 rounded border border-rose-300 flex justify-between items-start gap-2">
                                                <div className="flex-1">
                                                    <div className="font-bold text-rose-900">{formatCurrency(d.amount)}</div>
                                                    {d.donor && <div className="text-xs text-rose-700">From: {d.donor}</div>}
                                                    {d.description && <div className="text-xs text-rose-700">{d.description}</div>}
                                                </div>
                                                <button onClick={() => handleRemoveDonation(i)} className="text-red-600 hover:text-red-800 font-bold text-lg">×</button>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-2 text-gray-500">{formData.noDonation ? '✓ No donations recorded' : 'No donations recorded yet'}</div>
                                    )}
                                </div>
                            </section>

                            {/* Worship & Events */}
                            <section className="border-2 border-orange-200 rounded-xl p-4 bg-orange-50">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-2xl">🙏</span>
                                    <h4 className="text-orange-900 font-bold">Worship & Events</h4>
                                </div>
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Sermon Topic *</label>
                                            <input type="text" name="sermonTopic" value={formData.sermonTopic} onChange={handleChange} placeholder="Main sermon topic" className="w-full border-2 border-orange-300 rounded p-2" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Memory Verse</label>
                                            <input type="text" name="memoryVerse" value={formData.memoryVerse} onChange={handleChange} placeholder="e.g., John 3:16" className="w-full border-2 border-orange-300 rounded p-2" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Special Events / Announcements</label>
                                        <textarea name="events" value={formData.events} onChange={handleChange} placeholder="Special events, announcements, highlights..." className="w-full border-2 rounded p-2" rows={3} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Worship Highlights</label>
                                        <textarea name="worshipHighlights" value={formData.worshipHighlights} onChange={handleChange} placeholder="Special moments during worship..." className="w-full border-2 rounded p-2" rows={2} />
                                    </div>
                                </div>
                            </section>

                            {/* Save Button (bottom) */}
                            <div className="pt-2">
                                <button 
                                    type="button" 
                                    onClick={() => { handleSubmit(); setIsFullEditorOpen(false); }} 
                                    disabled={!canSave}
                                    className={`w-full mt-2 font-bold py-3 rounded-lg shadow-lg transition-all ${
                                        canSave ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer' : 'bg-gray-400 text-gray-700 cursor-not-allowed'
                                    }`}
                                >
                                    {canSave ? '💾 Save Record - Complete!' : `⚠️ Complete ${completionStatus.total - completionStatus.completed} more sections`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

                </>
            )}

            <HistoryArchiveModal 
                isOpen={showArchive} 
                onClose={() => setShowArchive(false)} 
                history={history}
                onEditRecord={handleEditArchiveRecord}
                onDeleteRecord={handleDeleteArchiveRecord}
            />

            {/* Save Success Dialog */}
            {showSaveSuccess && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50">
                    <div className="bg-gradient-to-br from-white via-green-50 to-emerald-50 rounded-3xl shadow-2xl p-8 max-w-sm mx-4 border-2 border-green-200 animate-in fade-in zoom-in-95 duration-300">
                        <div className="flex flex-col items-center text-center">
                            {/* Animated Checkmark Circle */}
                            <div className="mb-6 relative">
                                <div className="absolute inset-0 bg-gradient-to-r from-green-200 to-emerald-200 rounded-full animate-ping opacity-75"></div>
                                <div className="absolute inset-0 bg-gradient-to-r from-green-100 to-emerald-100 rounded-full animate-pulse"></div>
                                <div className="relative bg-gradient-to-br from-green-100 to-emerald-100 rounded-full p-5 border-4 border-green-300">
                                    <svg className="w-16 h-16 text-green-600 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            </div>
                            
                            {/* Success Message */}
                            <h2 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-2">Record Saved!</h2>
                            <p className="text-gray-700 font-medium mb-1">Weekly history successfully</p>
                            <p className="text-gray-700 font-medium mb-6">saved to database</p>
                            
                            {/* Progress Bar */}
                            <div className="w-full bg-gray-200 rounded-full h-2 mb-4 overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 animate-pulse rounded-full" style={{
                                    animation: 'slideProgress 3s ease-in-out'
                                }}></div>
                            </div>
                            
                            {/* Status Text */}
                            <p className="text-sm text-gray-500 font-medium">Closing in a moment...</p>
                            
                            {/* Decorative Elements */}
                            <div className="mt-4 flex gap-1 justify-center">
                                <div className="w-2 h-2 rounded-full bg-green-400 animate-bounce" style={{animationDelay: '0s'}}></div>
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{animationDelay: '0.2s'}}></div>
                                <div className="w-2 h-2 rounded-full bg-teal-400 animate-bounce" style={{animationDelay: '0.4s'}}></div>
                            </div>
                        </div>
                    </div>
                    
                    {/* CSS Animation for progress bar */}
                    <style>{`
                        @keyframes slideProgress {
                            0% { width: 0%; }
                            50% { width: 100%; }
                            100% { width: 100%; }
                        }
                    `}</style>
                </div>
            )}
        </div>
    );
};

export default WeeklyHistory;
