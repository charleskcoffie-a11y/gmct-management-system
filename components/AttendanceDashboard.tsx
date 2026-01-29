import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { Settings, User, SyncStatus } from '../types';
import { loadAttendanceReport } from '../services/supabase';

interface AttendanceDashboardProps {
    settings: Settings;
    currentUser: User;
    syncStatus?: SyncStatus;
}

const AttendanceDashboard: React.FC<AttendanceDashboardProps> = ({ settings, currentUser, syncStatus }) => {
    const [timeRange, setTimeRange] = useState<'month' | 'quarter' | 'year'>('month');
    const [attendanceData, setAttendanceData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [serviceTypeFilter, setServiceTypeFilter] = useState<'all' | 'sunday' | 'bible-study'>('all');

    const isConnected = !!settings.supabaseUrl && !!settings.supabaseKey && syncStatus?.state === 'synced';

    useEffect(() => {
        if (!isConnected) return;
        loadData();
    }, [isConnected, timeRange, settings.supabaseUrl, settings.supabaseKey]);

    const loadData = async () => {
        setLoading(true);
        try {
            const today = new Date();
            let startDate: Date;

            if (timeRange === 'month') {
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            } else if (timeRange === 'quarter') {
                const quarter = Math.floor(today.getMonth() / 3);
                startDate = new Date(today.getFullYear(), quarter * 3, 1);
            } else {
                startDate = new Date(today.getFullYear(), 0, 1);
            }

            const start = startDate.toISOString().slice(0, 10);
            const end = today.toISOString().slice(0, 10);

            const rows = await loadAttendanceReport(settings.supabaseUrl, settings.supabaseKey, start, end);
            setAttendanceData(rows || []);
        } catch (err) {
            console.error('Failed to load attendance data:', err);
        } finally {
            setLoading(false);
        }
    };

    // Filter by class if class leader
    const filteredData = useMemo(() => {
        const classNumber = currentUser.assignedClass || currentUser.classLed;
        return attendanceData.filter(record => !classNumber || record.class_number === classNumber);
    }, [attendanceData, currentUser]);

    // Process data for trend chart
    const trendData = useMemo(() => {
        const byDate: Record<string, { date: string; present: number; absent: number; total: number }> = {};
        
        filteredData.forEach(record => {
            if (serviceTypeFilter !== 'all' && record.service_type !== serviceTypeFilter) return;
            
            const date = record.attendance_date;
            if (!byDate[date]) {
                byDate[date] = { date, present: 0, absent: 0, total: 0 };
            }
            if (record.status === 'present') byDate[date].present++;
            if (record.status === 'absent') byDate[date].absent++;
            byDate[date].total++;
        });

        return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
    }, [filteredData, serviceTypeFilter]);

    // Calculate stats
    const stats = useMemo(() => {
        let totalPresent = 0;
        let totalAbsent = 0;
        let sundays = 0;
        let bibleStudies = 0;

        filteredData.forEach(record => {
            if (record.status === 'present') totalPresent++;
            if (record.status === 'absent') totalAbsent++;
            if (record.service_type === 'sunday') sundays++;
            if (record.service_type === 'bible-study') bibleStudies++;
        });

        const total = totalPresent + totalAbsent;
        const attendanceRate = total > 0 ? ((totalPresent / total) * 100).toFixed(1) : '0';

        return {
            totalPresent,
            totalAbsent,
            total,
            attendanceRate,
            sundays: Math.ceil(sundays / (filteredData.length > 0 ? (filteredData.length / (sundays + bibleStudies)) : 1)),
            bibleStudies: Math.ceil(bibleStudies / (filteredData.length > 0 ? (filteredData.length / (sundays + bibleStudies)) : 1)),
        };
    }, [filteredData]);

    const pieData = [
        { name: 'Present', value: stats.totalPresent, color: '#10b981' },
        { name: 'Absent', value: stats.totalAbsent, color: '#ef4444' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-br from-slate-50 to-indigo-50 p-8 rounded-2xl shadow-lg border-2 border-slate-200">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-4 rounded-xl shadow-md">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold text-slate-800">Attendance Dashboard</h2>
                            <p className="text-base text-slate-500 mt-1 font-medium">
                                Class {currentUser.assignedClass || currentUser.classLed} • Trend Analysis
                            </p>
                        </div>
                    </div>
                    
                    {/* Time Range Selector */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setTimeRange('month')}
                            className={`px-4 py-2 rounded-lg font-semibold transition ${
                                timeRange === 'month'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-white text-slate-600 border-2 border-slate-200 hover:border-indigo-300'
                            }`}
                        >
                            Month
                        </button>
                        <button
                            onClick={() => setTimeRange('quarter')}
                            className={`px-4 py-2 rounded-lg font-semibold transition ${
                                timeRange === 'quarter'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-white text-slate-600 border-2 border-slate-200 hover:border-indigo-300'
                            }`}
                        >
                            Quarter
                        </button>
                        <button
                            onClick={() => setTimeRange('year')}
                            className={`px-4 py-2 rounded-lg font-semibold transition ${
                                timeRange === 'year'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-white text-slate-600 border-2 border-slate-200 hover:border-indigo-300'
                            }`}
                        >
                            Year
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-emerald-400 to-green-500 p-6 rounded-xl shadow-lg text-white">
                    <div className="text-sm font-bold uppercase opacity-90">Attendance Rate</div>
                    <div className="text-4xl font-bold mt-2">{stats.attendanceRate}%</div>
                </div>
                <div className="bg-gradient-to-br from-blue-400 to-indigo-500 p-6 rounded-xl shadow-lg text-white">
                    <div className="text-sm font-bold uppercase opacity-90">Total Present</div>
                    <div className="text-4xl font-bold mt-2">{stats.totalPresent}</div>
                </div>
                <div className="bg-gradient-to-br from-orange-400 to-red-500 p-6 rounded-xl shadow-lg text-white">
                    <div className="text-sm font-bold uppercase opacity-90">Total Absent</div>
                    <div className="text-4xl font-bold mt-2">{stats.totalAbsent}</div>
                </div>
                <div className="bg-gradient-to-br from-purple-400 to-pink-500 p-6 rounded-xl shadow-lg text-white">
                    <div className="text-sm font-bold uppercase opacity-90">Services Held</div>
                    <div className="text-4xl font-bold mt-2">{stats.sundays + stats.bibleStudies}</div>
                </div>
            </div>

            {/* Service Type Filter */}
            <div className="bg-white p-4 rounded-xl shadow border-2 border-slate-200">
                <div className="flex items-center gap-4">
                    <span className="font-semibold text-slate-700">Filter by Service:</span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setServiceTypeFilter('all')}
                            className={`px-4 py-2 rounded-lg font-medium transition ${
                                serviceTypeFilter === 'all'
                                    ? 'bg-slate-700 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            All Services
                        </button>
                        <button
                            onClick={() => setServiceTypeFilter('sunday')}
                            className={`px-4 py-2 rounded-lg font-medium transition ${
                                serviceTypeFilter === 'sunday'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            }`}
                        >
                            Sunday Only
                        </button>
                        <button
                            onClick={() => setServiceTypeFilter('bible-study')}
                            className={`px-4 py-2 rounded-lg font-medium transition ${
                                serviceTypeFilter === 'bible-study'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                            }`}
                        >
                            Bible Study Only
                        </button>
                    </div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Trend Line Chart */}
                <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-slate-200">
                    <h3 className="text-xl font-bold text-slate-800 mb-4">Attendance Trend</h3>
                    {loading ? (
                        <div className="h-80 flex items-center justify-center text-slate-400">Loading...</div>
                    ) : trendData.length === 0 ? (
                        <div className="h-80 flex items-center justify-center text-slate-400">No data available</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={320}>
                            <LineChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis 
                                    dataKey="date" 
                                    tick={{ fontSize: 12 }}
                                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip 
                                    labelFormatter={(value) => new Date(value).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                />
                                <Legend />
                                <Line type="monotone" dataKey="present" stroke="#10b981" strokeWidth={3} name="Present" />
                                <Line type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={3} name="Absent" />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Pie Chart */}
                <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-slate-200">
                    <h3 className="text-xl font-bold text-slate-800 mb-4">Overall Distribution</h3>
                    {loading ? (
                        <div className="h-80 flex items-center justify-center text-slate-400">Loading...</div>
                    ) : stats.total === 0 ? (
                        <div className="h-80 flex items-center justify-center text-slate-400">No data available</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={320}>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Bar Chart - Weekly Comparison */}
            <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-slate-200">
                <h3 className="text-xl font-bold text-slate-800 mb-4">Weekly Comparison</h3>
                {loading ? (
                    <div className="h-80 flex items-center justify-center text-slate-400">Loading...</div>
                ) : trendData.length === 0 ? (
                    <div className="h-80 flex items-center justify-center text-slate-400">No data available</div>
                ) : (
                    <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={trendData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis 
                                dataKey="date" 
                                tick={{ fontSize: 12 }}
                                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip 
                                labelFormatter={(value) => new Date(value).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                            />
                            <Legend />
                            <Bar dataKey="present" fill="#10b981" name="Present" />
                            <Bar dataKey="absent" fill="#ef4444" name="Absent" />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
};

export default AttendanceDashboard;
