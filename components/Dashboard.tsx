
// components/Dashboard.tsx
import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import type { Entry, Settings, User, Member, MonthLock, SundayLock } from '../types';
import { formatCurrency, capitalize, isMonthLocked } from '../utils';
import ChartModal from './ChartModal';

interface DashboardProps {
    entries: Entry[];
    members: Member[];
    settings: Settings;
    currentUser: User;
    monthLocks?: MonthLock[];
    sundayLocks?: SundayLock[];
}

const Dashboard: React.FC<DashboardProps> = ({ entries, members, settings, currentUser, monthLocks = [], sundayLocks = [] }) => {
    const [expandedChart, setExpandedChart] = useState<'trend' | 'pie' | null>(null);
    
    // Get the current or most recent Sunday
    const getCurrentSunday = () => {
        const today = new Date();
        const day = today.getDay();
        const diff = day === 0 ? 0 : day; // If today is Sunday (0), diff is 0; otherwise, days since last Sunday
        const sunday = new Date(today);
        sunday.setDate(today.getDate() - diff);
        return sunday.toISOString().substring(0, 10);
    };
    
    const currentSundayDate = getCurrentSunday();
    
    // --- Data Processing ---
    const activeEntries = entries.filter(e => !e.deleted);
    const totalContribution = activeEntries.reduce((acc, entry) => acc + entry.amount, 0);
    const totalEntries = activeEntries.length;

    const contributionByType: Record<string, number> = {};
    for (const entry of activeEntries) {
        contributionByType[entry.type] = (contributionByType[entry.type] || 0) + entry.amount;
    }

    const pieData = useMemo(() => {
        return Object.entries(contributionByType)
            .map(([name, value]) => ({
                name: capitalize(name.replace('-', ' ')),
                value,
            }))
            .sort((a, b) => b.value - a.value);
    }, [contributionByType]);

    const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#f43f5e', '#0ea5e9', '#8b5cf6'];

    const monthlyData = useMemo(() => {
        const data: { [key: string]: number } = {};
        for (const entry of activeEntries) {
            const monthKey = entry.date.substring(0, 7);
            data[monthKey] = (data[monthKey] || 0) + entry.amount;
        }

        return Object.keys(data)
            .sort()
            .map(monthKey => ({
                name: new Date(`${monthKey}-02`).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
                Total: data[monthKey],
            }));
    }, [activeEntries]);

    const monthlyComparisonData = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const currentYearData: { [month: string]: number } = {};
        const previousYearData: { [month: string]: number } = {};

        // Aggregate current year
        for (const entry of activeEntries) {
            const entryYear = parseInt(entry.date.substring(0, 4));
            const month = entry.date.substring(5, 7);
            if (entryYear === currentYear) {
                currentYearData[month] = (currentYearData[month] || 0) + entry.amount;
            }
        }

        // Aggregate previous year
        for (const entry of activeEntries) {
            const entryYear = parseInt(entry.date.substring(0, 4));
            const month = entry.date.substring(5, 7);
            if (entryYear === currentYear - 1) {
                previousYearData[month] = (previousYearData[month] || 0) + entry.amount;
            }
        }

        // Create 12-month comparison
        const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        return months.map((month, idx) => ({
            name: monthNames[idx],
            'Current Year': currentYearData[month] || 0,
            'Previous Year': previousYearData[month] || 0,
        }));
    }, [activeEntries]);

    // --- Notification / Alerts Logic ---
    const notifications = useMemo(() => {
        const alerts = [];
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.toISOString().substring(0, 7);
        const dayOfMonth = today.getDate();
        
        // Finance team, admin, finance-chair, and pastor can see the alerts
        const shouldShowLockAlerts = currentUser.role === 'admin' || currentUser.role === 'finance-chair' || currentUser.role === 'finance-team' || currentUser.role === 'pastor';

        // 1. Check for unlocked past months in CURRENT YEAR ONLY
        if (shouldShowLockAlerts) {
            const checkDate = new Date(today);
            checkDate.setMonth(checkDate.getMonth() - 1); // Start from last month
            
            // Check all past months in current year only (stop at Jan if we go before current year)
            while (checkDate.getFullYear() === currentYear && checkDate < today) {
                const monthKey = checkDate.toISOString().substring(0, 7);
                const isLocked = isMonthLocked(monthKey + "-01", monthLocks);
                
                if (!isLocked) {
                    const monthName = checkDate.toLocaleDateString('en-US', { month: 'long' });
                    alerts.push({ type: 'warning', msg: `${monthName} is still UNLOCKED. Please lock in Financial Control.`});
                }
                
                checkDate.setMonth(checkDate.getMonth() - 1);
            }
        }

        // 2. Current month reminder (show after mid-month)
        if (shouldShowLockAlerts && dayOfMonth >= 15) {
            const isCurrentLocked = isMonthLocked(currentMonth + "-01", monthLocks);
            if (!isCurrentLocked) {
                const monthName = today.toLocaleDateString('en-US', { month: 'long' });
                alerts.push({ type: 'info', msg: `Remember to lock ${monthName} at the end of the month in Financial Control.`});
            }
        }

        // 3. Check for all Sundays in CURRENT MONTH that are unlocked (past + current week's Sunday)
        if (shouldShowLockAlerts) {
            const currentMonthNum = today.getMonth();
            const currentYearNum = today.getFullYear();
            
            // Get the first day of current month
            const firstDay = new Date(currentYearNum, currentMonthNum, 1);
            
            // Get the first Sunday of the month
            let firstSunday = new Date(firstDay);
            const dayOfWeek = firstDay.getDay();
            if (dayOfWeek === 0) {
                // First day is already Sunday
                firstSunday = new Date(firstDay);
            } else {
                // Calculate days until first Sunday
                firstSunday.setDate(firstDay.getDate() + (7 - dayOfWeek));
            }
            
            // Go through each Sunday in the current month
            const checkSunday = new Date(firstSunday);
            while (checkSunday.getMonth() === currentMonthNum && checkSunday.getFullYear() === currentYearNum) {
                const sundayDateStr = checkSunday.toISOString().substring(0, 10);
                
                // Only show alerts for Sundays that are <= today (past or current)
                if (checkSunday <= today) {
                    const sundayLock = sundayLocks.find(l => l.date === sundayDateStr);
                    const isSundayLocked = sundayLock?.isLocked || false;
                    
                    if (!isSundayLocked) {
                        const sundayDisplay = checkSunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        alerts.push({ type: 'warning', msg: `Sunday ${sundayDisplay} is UNLOCKED. Please lock in Financial Control.`});
                    }
                }
                
                checkSunday.setDate(checkSunday.getDate() + 7); // Move to next Sunday
            }
        }

        // 4. New Members (show to everyone)
        const recentMembers = members.filter(m => {
            if (!m.createdAt) return false;
            const created = new Date(m.createdAt);
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            return created > sevenDaysAgo;
        });

        if (recentMembers.length > 0) {
            alerts.push({ type: 'success', msg: `${recentMembers.length} new member(s) added this week.`});
        }

        return alerts;
    }, [monthLocks, sundayLocks, members, currentSundayDate, currentUser.role]);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 border border-slate-200 rounded shadow-lg">
                    <p className="font-bold text-slate-800">{label}</p>
                    {payload.map((entry: any, idx: number) => (
                        <p key={idx} style={{ color: entry.color }} className="font-medium">
                            {`${entry.name}: ${formatCurrency(entry.value, settings.currency)}`}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };


    return (
        <div className="space-y-6">
            <div>
                <h2 className="inline-block text-3xl font-extrabold text-white bg-gradient-to-r from-indigo-600 to-cyan-600 px-6 py-3 rounded-xl shadow-lg">📊 Dashboard</h2>
                <p className="text-base text-slate-600 mt-3 font-medium">A quick overview of giving, trends, and alerts.</p>
            </div>
            
            {/* Notification Panel (Admin/Chair/Finance Team/Pastor) */}
            {(currentUser.role === 'admin' || currentUser.role === 'finance-chair' || currentUser.role === 'finance-team' || currentUser.role === 'pastor') && (
                <div className="bg-gradient-to-br from-indigo-50 via-blue-50 to-cyan-50 rounded-xl shadow-lg border-2 border-indigo-200 p-6 mb-6">
                    <h3 className="text-lg font-bold text-indigo-800 border-b-2 border-indigo-100 pb-2 mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                        Administrative Alerts
                    </h3>
                    {notifications.length > 0 ? (
                        <div className="space-y-3">
                            {notifications.map((n, idx) => (
                                <div key={idx} className={`p-3 rounded-lg border-2 flex items-center gap-3 ${
                                    n.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                                    n.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                                    'bg-blue-50 border-blue-200 text-blue-800'
                                }`}>
                                    <span className="text-lg font-bold">•</span>
                                    <span className="font-medium">{n.msg}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-slate-400 italic">No pending alerts.</p>
                    )}
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-violet-600 p-5 rounded-xl shadow-lg border-2 border-indigo-300">
                    <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10"></div>
                    <h3 className="text-sm font-bold uppercase text-indigo-100">Total Contributions</h3>
                    <p className="text-3xl font-extrabold text-white mt-1">{formatCurrency(totalContribution, settings.currency)}</p>
                </div>
                <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 to-green-600 p-5 rounded-xl shadow-lg border-2 border-emerald-300">
                    <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10"></div>
                    <h3 className="text-sm font-bold uppercase text-emerald-100">Total Entries</h3>
                    <p className="text-3xl font-extrabold text-white mt-1">{totalEntries.toLocaleString()}</p>
                </div>
                <div className="relative overflow-hidden bg-gradient-to-br from-fuchsia-600 to-rose-600 p-5 rounded-xl shadow-lg border-2 border-fuchsia-300">
                    <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10"></div>
                    <h3 className="text-sm font-bold uppercase text-pink-100">Avg. per Entry</h3>
                    <p className="text-3xl font-extrabold text-white mt-1">{totalEntries > 0 ? formatCurrency(totalContribution / totalEntries, settings.currency) : '$0.00'}</p>
                </div>
            </div>
            
            {/* Monthly Trend Chart */}
            <div className="bg-gradient-to-br from-blue-50 via-cyan-50 to-indigo-50 p-6 rounded-xl shadow-lg border-2 border-blue-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-blue-800">Year-to-Date Comparison: {new Date().getFullYear()} vs {new Date().getFullYear() - 1}</h3>
                    <button 
                        onClick={() => setExpandedChart('trend')}
                        className="p-2 hover:bg-white/50 rounded-lg transition text-blue-600"
                        title="Expand to full screen"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6v4m12-4h4v4M6 18h4v-4m6 4h4v-4" />
                        </svg>
                    </button>
                </div>
                {monthlyComparisonData.some(d => d['Current Year'] > 0 || d['Previous Year'] > 0) ? (
                    <div style={{ width: '100%', height: 300 }}>
                        <ResponsiveContainer>
                            <LineChart data={monthlyComparisonData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" />
                                <YAxis tickFormatter={(tick) => formatCurrency(tick, settings.currency).replace('.00', '')} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend />
                                <Line type="monotone" dataKey="Current Year" stroke="#4f46e5" strokeWidth={2} dot={{ fill: '#4f46e5', r: 4 }} />
                                <Line type="monotone" dataKey="Previous Year" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} strokeDasharray="5 5" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <p className="text-slate-500 text-center py-12">No data available to display trend chart.</p>
                )}
            </div>

            {/* Recent Entries & Breakdown (Hidden for Pastor Role if required, but showing aggregate pie chart is usually fine) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="relative overflow-hidden bg-gradient-to-br from-violet-50 via-fuchsia-50 to-rose-50 p-6 rounded-2xl shadow-2xl border-2 border-violet-200">
                    <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-violet-200/20"></div>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-violet-800 flex items-center gap-2">
                            <svg className="w-6 h-6 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 11V7a1 1 0 112 0v4h4a1 1 0 110 2h-4v4a1 1 0 11-2 0v-4H7a1 1 0 110-2h4z" /></svg>
                            Contribution by Type
                        </h3>
                        <button 
                            onClick={() => setExpandedChart('pie')}
                            className="p-2 hover:bg-violet-100 rounded-lg transition text-violet-600"
                            title="Expand to full screen"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6v4m12-4h4v4M6 18h4v-4m6 4h4v-4" />
                            </svg>
                        </button>
                    </div>
                    {pieData.length > 0 ? (
                        <div style={{ width: '100%', height: 320 }}>
                            <ResponsiveContainer>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        outerRadius={110}
                                        innerRadius={60}
                                        fill="#8884d8"
                                        dataKey="value"
                                        nameKey="name"
                                        isAnimationActive={true}
                                        animationDuration={1200}
                                        label={({ name, value, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={`url(#pieGradient${index})`} />
                                        ))}
                                    </Pie>
                                    {/* Gradients for each slice */}
                                    <defs>
                                        {pieData.map((entry, index) => (
                                            <linearGradient id={`pieGradient${index}`} key={index} x1="0" y1="0" x2="1" y2="1">
                                                <stop offset="0%" stopColor={COLORS[index % COLORS.length]} stopOpacity="0.8" />
                                                <stop offset="100%" stopColor={COLORS[(index+1) % COLORS.length]} stopOpacity="0.9" />
                                            </linearGradient>
                                        ))}
                                    </defs>
                                    <Tooltip formatter={(value: number) => formatCurrency(value, settings.currency)} />
                                    {/* Custom Legend */}
                                    <Legend content={() => (
                                        <div className="flex flex-wrap gap-4 justify-center mt-4">
                                            {pieData.map((entry, index) => (
                                                <div key={entry.name} className="flex items-center gap-2 text-sm font-semibold">
                                                    <span className="inline-block w-4 h-4 rounded-full" style={{ background: `linear-gradient(135deg, ${COLORS[index % COLORS.length]}, ${COLORS[(index+1) % COLORS.length]})` }}></span>
                                                    <span>{entry.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <p className="text-slate-500 text-center py-12">No contributions recorded yet.</p>
                    )}
                </div>
                
                {/* Recent Entries */}
                {(currentUser.role === 'admin' || currentUser.role === 'finance-chair' || currentUser.role === 'finance-team' || currentUser.role === 'pastor') && (
                    <div className="bg-white p-4 rounded-2xl shadow-2xl border-2 border-cyan-200">
                        <h3 className="text-lg font-bold text-cyan-800 mb-4 px-2 flex items-center gap-2">
                            <svg className="w-6 h-6 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3zm0 10c-4.418 0-8-1.79-8-4V6a2 2 0 012-2h12a2 2 0 012 2v8c0 2.21-3.582 4-8 4z" /></svg>
                            Recent Entries
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                            {activeEntries.slice(0, 5).map(entry => {
                                const tooltip = `Created by: ${entry.createdBy || 'Unknown'}${entry.updatedBy ? `\nUpdated by: ${entry.updatedBy}` : ''}`;
                                // Icon by type
                                const typeIcon = {
                                    tithe: <svg className="w-7 h-7 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3zm0 10c-4.418 0-8-1.79-8-4V6a2 2 0 012-2h12a2 2 0 012 2v8c0 2.21-3.582 4-8 4z" /></svg>,
                                    offering: <svg className="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3zm0 10c-4.418 0-8-1.79-8-4V6a2 2 0 012-2h12a2 2 0 012 2v8c0 2.21-3.582 4-8 4z" /></svg>,
                                    "development-fund": <svg className="w-7 h-7 text-fuchsia-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3zm0 10c-4.418 0-8-1.79-8-4V6a2 2 0 012-2h12a2 2 0 012 2v8c0 2.21-3.582 4-8 4z" /></svg>,
                                    harvest: <svg className="w-7 h-7 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3zm0 10c-4.418 0-8-1.79-8-4V6a2 2 0 012-2h12a2 2 0 012 2v8c0 2.21-3.582 4-8 4z" /></svg>,
                                    "no-name": <svg className="w-7 h-7 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3zm0 10c-4.418 0-8-1.79-8-4V6a2 2 0 012-2h12a2 2 0 012 2v8c0 2.21-3.582 4-8 4z" /></svg>,
                                };
                                return (
                                    <div
                                        key={entry.id}
                                        className="flex items-center gap-4 bg-cyan-50/80 border border-cyan-100 rounded-xl p-3 shadow hover:shadow-lg transition group cursor-pointer relative"
                                        title={tooltip}
                                    >
                                        <div className="shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-white border-2 border-cyan-200 shadow-inner">
                                            {typeIcon[entry.type] || <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2" /></svg>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-900 text-lg">{formatCurrency(entry.amount, settings.currency)}</span>
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700 font-bold capitalize">{entry.type.replace('-', ' ')}</span>
                                            </div>
                                            <div className="text-slate-700 text-sm font-medium truncate">{entry.memberName}</div>
                                            <div className="text-slate-500 text-xs">{entry.date}</div>
                                        </div>
                                        <div className="ml-2 flex flex-col items-end">
                                            <span className="text-[10px] text-slate-400 group-hover:text-slate-600 transition" style={{whiteSpace:'pre-line'}}>
                                                {entry.createdBy && <span>By: {entry.createdBy}</span>}
                                                {entry.updatedBy && <span>\nEdit: {entry.updatedBy}</span>}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Full-screen Chart Modals */}
            <ChartModal 
                isOpen={expandedChart === 'trend'} 
                onClose={() => setExpandedChart(null)}
                title={`Year-to-Date Comparison: ${new Date().getFullYear()} vs ${new Date().getFullYear() - 1}`}
            >
                <div style={{ width: '100%', height: 500 }}>
                    <ResponsiveContainer>
                        <LineChart data={monthlyComparisonData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" />
                            <YAxis tickFormatter={(tick) => formatCurrency(tick, settings.currency).replace('.00', '')} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Line type="monotone" dataKey="Current Year" stroke="#4f46e5" strokeWidth={3} dot={{ fill: '#4f46e5', r: 6 }} />
                            <Line type="monotone" dataKey="Previous Year" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 6 }} strokeDasharray="5 5" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </ChartModal>

            <ChartModal 
                isOpen={expandedChart === 'pie'} 
                onClose={() => setExpandedChart(null)}
                title="Contribution by Type"
            >
                <div style={{ width: '100%', height: 500 }}>
                    <ResponsiveContainer>
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={150}
                                fill="#8884d8"
                                dataKey="value"
                                nameKey="name"
                                label={({ name, value }) => `${name}: ${formatCurrency(value, settings.currency)}`}
                            >
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => formatCurrency(value, settings.currency)} />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </ChartModal>
        </div>
    );
};

export default Dashboard;
