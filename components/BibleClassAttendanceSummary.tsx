import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { Settings, SyncStatus } from '../types';
import { loadAttendanceReport } from '../services/supabase';

interface BibleClassAttendanceSummaryProps {
    settings: Settings;
    syncStatus?: SyncStatus;
}

const BibleClassAttendanceSummary: React.FC<BibleClassAttendanceSummaryProps> = ({ settings, syncStatus }) => {
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [attendanceData, setAttendanceData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const isConnected = !!settings.supabaseUrl && !!settings.supabaseKey && syncStatus?.state === 'synced';

    // Initialize dates on mount
    useEffect(() => {
        const today = new Date();
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        setStartDate(monthStart.toISOString().slice(0, 10));
        setEndDate(today.toISOString().slice(0, 10));
    }, []);

    // Load data when dates change
    useEffect(() => {
        if (!isConnected || !startDate || !endDate) return;
        loadData();
    }, [isConnected, startDate, endDate, settings.supabaseUrl, settings.supabaseKey]);

    const loadData = async () => {
        setLoading(true);
        try {
            const rows = await loadAttendanceReport(settings.supabaseUrl, settings.supabaseKey, startDate, endDate);
            // Filter for Bible study only
            const bibleStudyData = (rows || []).filter(r => r.service_type === 'bible-study');
            setAttendanceData(bibleStudyData);
        } catch (err) {
            console.error('Failed to load Bible class attendance:', err);
        } finally {
            setLoading(false);
        }
    };

    // Process data for chart
    const chartData = useMemo(() => {
        const byWeek: Record<string, { week: string; date: string; [key: string]: any }> = {};

        attendanceData.forEach(record => {
            const date = record.attendance_date;
            // Group by week (use date as week identifier)
            if (!byWeek[date]) {
                byWeek[date] = { week: date, date };
            }
            const classNum = `Class${record.class_number}`;
            if (!byWeek[date][classNum]) {
                byWeek[date][classNum] = 0;
            }
            byWeek[date][classNum] += (record.status === 'present' ? 1 : 0);
        });

        return Object.values(byWeek)
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(item => ({
                ...item,
                week: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            }));
    }, [attendanceData]);

    // Calculate stats by class
    const statsByClass = useMemo(() => {
        const stats: Record<string, { present: number; absent: number; total: number }> = {};

        attendanceData.forEach(record => {
            const classNum = record.class_number;
            if (!stats[classNum]) {
                stats[classNum] = { present: 0, absent: 0, total: 0 };
            }
            if (record.status === 'present') stats[classNum].present++;
            if (record.status === 'absent') stats[classNum].absent++;
            stats[classNum].total++;
        });

        return Object.keys(stats)
            .sort()
            .map(classNum => ({
                classNumber: classNum,
                ...stats[classNum],
                rate: stats[classNum].total > 0 ? ((stats[classNum].present / stats[classNum].total) * 100).toFixed(1) : '0'
            }));
    }, [attendanceData]);

    // Overall stats
    const overallStats = useMemo(() => {
        let totalPresent = 0;
        let totalAbsent = 0;

        attendanceData.forEach(record => {
            if (record.status === 'present') totalPresent++;
            if (record.status === 'absent') totalAbsent++;
        });

        const total = totalPresent + totalAbsent;
        return {
            totalPresent,
            totalAbsent,
            total,
            rate: total > 0 ? ((totalPresent / total) * 100).toFixed(1) : '0'
        };
    }, [attendanceData]);

    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#eab308', '#84cc16', '#6366f1', '#d946ef', '#0ea5e9', '#f43f5e'];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-br from-slate-50 to-purple-50 p-8 rounded-2xl shadow-lg border-2 border-slate-200">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="bg-gradient-to-br from-purple-500 to-pink-600 p-4 rounded-xl shadow-md">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold text-slate-800">Bible Class Attendance Summary</h2>
                            <p className="text-base text-slate-500 mt-1 font-medium">All Classes • Tuesday Services</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Date Filters */}
            <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-slate-200">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Start Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border-2 border-slate-200 focus:outline-none focus:border-purple-400"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">End Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border-2 border-slate-200 focus:outline-none focus:border-purple-400"
                        />
                    </div>
                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="bg-gradient-to-r from-purple-500 to-pink-600 text-white px-6 py-2 rounded-lg font-bold hover:scale-105 transition disabled:opacity-50"
                    >
                        {loading ? 'Loading...' : 'Refresh'}
                    </button>
                </div>
            </div>

            {/* Overall Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-emerald-400 to-green-500 p-6 rounded-xl shadow-lg text-white">
                    <div className="text-sm font-bold uppercase opacity-90">Overall Rate</div>
                    <div className="text-4xl font-bold mt-2">{overallStats.rate}%</div>
                </div>
                <div className="bg-gradient-to-br from-blue-400 to-indigo-500 p-6 rounded-xl shadow-lg text-white">
                    <div className="text-sm font-bold uppercase opacity-90">Total Present</div>
                    <div className="text-4xl font-bold mt-2">{overallStats.totalPresent}</div>
                </div>
                <div className="bg-gradient-to-br from-orange-400 to-red-500 p-6 rounded-xl shadow-lg text-white">
                    <div className="text-sm font-bold uppercase opacity-90">Total Absent</div>
                    <div className="text-4xl font-bold mt-2">{overallStats.totalAbsent}</div>
                </div>
                <div className="bg-gradient-to-br from-purple-400 to-pink-500 p-6 rounded-xl shadow-lg text-white">
                    <div className="text-sm font-bold uppercase opacity-90">Total Records</div>
                    <div className="text-4xl font-bold mt-2">{overallStats.total}</div>
                </div>
            </div>

            {/* Class Performance Table */}
            <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-slate-200">
                <h3 className="text-xl font-bold text-slate-800 mb-4">Attendance by Class</h3>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-100 border-b-2 border-slate-300">
                                <th className="text-left px-4 py-3 font-bold text-slate-700">Class</th>
                                <th className="text-center px-4 py-3 font-bold text-slate-700">Present</th>
                                <th className="text-center px-4 py-3 font-bold text-slate-700">Absent</th>
                                <th className="text-center px-4 py-3 font-bold text-slate-700">Total</th>
                                <th className="text-center px-4 py-3 font-bold text-slate-700">Rate</th>
                            </tr>
                        </thead>
                        <tbody>
                            {statsByClass.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-8 text-slate-400">No Bible class attendance data</td>
                                </tr>
                            ) : (
                                statsByClass.map(classStats => (
                                    <tr key={classStats.classNumber} className="border-b border-slate-200 hover:bg-slate-50">
                                        <td className="px-4 py-3 font-bold text-slate-800">Class {classStats.classNumber}</td>
                                        <td className="text-center px-4 py-3 text-green-600 font-semibold">{classStats.present}</td>
                                        <td className="text-center px-4 py-3 text-red-600 font-semibold">{classStats.absent}</td>
                                        <td className="text-center px-4 py-3 text-slate-700 font-semibold">{classStats.total}</td>
                                        <td className="text-center px-4 py-3">
                                            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold">{classStats.rate}%</span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Weekly Trend Chart */}
            <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-slate-200">
                <h3 className="text-xl font-bold text-slate-800 mb-4">Weekly Attendance Trend</h3>
                {loading ? (
                    <div className="h-80 flex items-center justify-center text-slate-400">Loading...</div>
                ) : chartData.length === 0 ? (
                    <div className="h-80 flex items-center justify-center text-slate-400">No data available for selected dates</div>
                ) : (
                    <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip labelFormatter={(value) => `Date: ${value}`} />
                            <Legend />
                            {Array.from(new Set(chartData.flatMap(d => Object.keys(d).filter(k => k.startsWith('Class'))))).map((key, idx) => (
                                <Bar key={key} dataKey={key} fill={colors[idx % colors.length]} />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
};

export default BibleClassAttendanceSummary;
