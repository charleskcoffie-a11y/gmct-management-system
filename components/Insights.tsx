
// components/Insights.tsx
import React, { useMemo, useState, useEffect } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import type { Entry, Settings, EntryType, HarvestEntry } from '../types';
import { formatCurrency, capitalize, calculateInsights, sanitizeEntryType } from '../utils';

interface InsightsProps {
    entries: Entry[];
    harvestEntries: HarvestEntry[];
    settings: Settings;
}

const Insights: React.FC<InsightsProps> = ({ entries, harvestEntries, settings }) => {
    // Initialize year-to-date filters
    const currentYear = new Date().getFullYear();
    const startOfYear = `${currentYear}-01-01`;
    const today = new Date().toISOString().slice(0, 10);
    
    const [startDate, setStartDate] = useState(startOfYear);
    const [endDate, setEndDate] = useState(today);
    const [typeFilter, setTypeFilter] = useState<EntryType | 'all'>('all');

    const combinedEntries = useMemo(() => {
        const harvestedAsEntries: Entry[] = harvestEntries.map(h => ({
            id: h.id,
            date: h.date,
            memberID: h.memberID,
            memberName: h.memberName,
            classNumber: h.classNumber,
            type: 'harvest-levy',
            fund: 'harvest levy',
            method: 'other',
            amount: h.amount,
            note: h.note,
            createdAt: h.createdAt,
            deleted: h.deleted,
        }));
        return [...entries, ...harvestedAsEntries];
    }, [entries, harvestEntries]);

    // Normalize types and drop deleted rows before filtering
    const normalizedEntries = useMemo(() => (
        combinedEntries
            .filter(e => !e.deleted)
            .map(e => ({ ...e, type: sanitizeEntryType(e.type) }))
    ), [combinedEntries]);

    // Filter Data for current year
    const filteredEntries = useMemo(() => {
        return normalizedEntries.filter(e => {
            if (startDate && e.date < startDate) return false;
            if (endDate && e.date > endDate) return false;
            if (typeFilter !== 'all' && e.type !== typeFilter) return false;
            return true;
        });
    }, [normalizedEntries, startDate, endDate, typeFilter]);

    // Calculate AI Summary (based on ALL entries for context, not just filtered)
    const aiSummary = useMemo(() => calculateInsights(normalizedEntries), [normalizedEntries]);

    const totalContribution = filteredEntries.reduce((acc, entry) => acc + entry.amount, 0);
    const totalEntries = filteredEntries.length;

    const contributionByType: Record<string, number> = {};
    for (const entry of filteredEntries) {
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

    // Create comparison data: current year vs previous year
    const monthlyComparisonData = useMemo(() => {
        const currentYearData: { [key: string]: number } = {};
        const previousYearData: { [key: string]: number } = {};
        
        // Process current year filtered data
        for (const entry of filteredEntries) {
            const monthKey = entry.date.substring(5, 7); // Get MM
            currentYearData[monthKey] = (currentYearData[monthKey] || 0) + entry.amount;
        }
        
        // Process previous year data (all entries from previous year)
        const previousYear = currentYear - 1;
        for (const entry of normalizedEntries) {
            if (entry.date.startsWith(String(previousYear)) && !entry.deleted) {
                const month = parseInt(entry.date.substring(5, 7));
                const dayOfYear = new Date(entry.date).getDay();
                const monthKey = entry.date.substring(5, 7); // Get MM
                previousYearData[monthKey] = (previousYearData[monthKey] || 0) + entry.amount;
            }
        }

        const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
        return months.map(month => ({
            name: new Date(`2024-${month}-02`).toLocaleDateString('en-US', { month: 'short' }),
            'Current Year': currentYearData[month] || 0,
            'Previous Year': previousYearData[month] || 0,
        }));
    }, [filteredEntries, combinedEntries, currentYear]);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 border border-slate-200 rounded shadow-lg">
                    <p className="font-bold text-slate-800">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <p key={index} style={{ color: entry.color }} className="font-semibold">
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
            <div className="flex justify-between items-end">
                <h2 className="text-2xl font-bold text-slate-800">Financial Insights & Reports</h2>
            </div>

            {/* Empty State when no entries */}
            {combinedEntries.length === 0 ? (
                <div className="text-center py-20 bg-gradient-to-br from-slate-50 to-indigo-50 rounded-2xl border-2 border-slate-200">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 mx-auto mb-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p className="text-3xl font-bold text-slate-800 mb-3">No Financial Data Yet</p>
                    <p className="text-lg text-slate-600 mb-6">Start adding financial records to see insights and reports here.</p>
                    <p className="text-base text-slate-500">Go to the <span className="font-bold text-indigo-600">Financial Records</span> page to add entries.</p>
                </div>
            ) : (
                <>
            
            {/* Filter Presets */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl shadow-sm border border-blue-200/50">
                <p className="text-xs font-bold text-slate-600 uppercase mb-3">Quick Filters</p>
                <div className="flex flex-wrap gap-2 mb-4">
                    <button onClick={() => {
                        const today = new Date();
                        const startOfYear = new Date(today.getFullYear(), 0, 1);
                        setStartDate(startOfYear.toISOString().split('T')[0]);
                        setEndDate(today.toISOString().split('T')[0]);
                    }} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm transition">Year to Date</button>
                    <button onClick={() => {
                        const today = new Date();
                        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                        setStartDate(startOfMonth.toISOString().split('T')[0]);
                        setEndDate(today.toISOString().split('T')[0]);
                    }} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition">This Month</button>
                    <button onClick={() => {
                        const today = new Date();
                        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
                        setStartDate(lastMonth.toISOString().split('T')[0]);
                        setEndDate(lastMonthEnd.toISOString().split('T')[0]);
                    }} className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white font-medium rounded-lg text-sm transition">Last Month</button>
                    <button onClick={() => {
                        const today = new Date();
                        const last90Days = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
                        setStartDate(last90Days.toISOString().split('T')[0]);
                        setEndDate(today.toISOString().split('T')[0]);
                    }} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg text-sm transition">Last 90 Days</button>
                    <button onClick={() => {
                        const today = new Date();
                        const lastYear = new Date(today.getFullYear() - 1, 0, 1);
                        const lastYearEnd = new Date(today.getFullYear() - 1, 11, 31);
                        setStartDate(lastYear.toISOString().split('T')[0]);
                        setEndDate(lastYearEnd.toISOString().split('T')[0]);
                    }} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg text-sm transition">Last Year</button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200/80 flex flex-wrap gap-4 items-end">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border-slate-300 rounded-lg shadow-sm" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Date</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border-slate-300 rounded-lg shadow-sm" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type</label>
                    <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} className="border-slate-300 rounded-lg shadow-sm">
                        <option value="all">All Types</option>
                        {["tithe", "offering", "thanksgiving-offering", "pledge", "harvest-levy", "harvest", "day-born", "development-fund", "other"].map(t => (
                            <option key={t} value={t}>{t.replace(/-/g, ' ')}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* AI Summary Box */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-lg p-6 text-white flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                    <h3 className="text-indigo-100 font-bold uppercase tracking-wider text-sm mb-1">Current Month Performance</h3>
                    <div className="text-4xl font-extrabold">{formatCurrency(aiSummary.currentMonthTotal, settings.currency)}</div>
                    <div className="flex items-center gap-2 mt-2">
                         <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                             aiSummary.trend === 'up' ? 'bg-green-400 text-green-900' : 
                             aiSummary.trend === 'down' ? 'bg-red-400 text-red-900' : 'bg-white/20'
                         }`}>
                             {aiSummary.trend.toUpperCase()}
                         </span>
                         <span className="text-indigo-100 text-sm font-medium">{aiSummary.comparisonText}</span>
                    </div>
                </div>
                <div className="text-right hidden md:block">
                     <div className="text-indigo-200 text-xs font-bold uppercase">Filtered Total</div>
                     <div className="text-2xl font-bold">{formatCurrency(totalContribution, settings.currency)}</div>
                     <div className="text-indigo-200 text-xs mt-1">{totalEntries} entries matched</div>
                </div>
            </div>
            
            {/* Chart Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-4 rounded-xl shadow-sm border border-slate-200/80">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 px-2">Year-to-Date Comparison: {currentYear} vs {currentYear - 1}</h3>
                    {monthlyComparisonData.some(d => d['Current Year'] > 0 || d['Previous Year'] > 0) ? (
                        <div style={{ width: '100%', height: 350 }}>
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
                        <p className="text-slate-500 text-center py-12">No data available matching filters.</p>
                    )}
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200/80">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Distribution</h3>
                    {pieData.length > 0 ? (
                        <div style={{ width: '100%', height: 350 }}>
                            <ResponsiveContainer>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="value"
                                        nameKey="name"
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
                    ) : (
                         <p className="text-slate-500 text-center py-12">No data.</p>
                    )}
                </div>
            </div>
                </>
            )}
        </div>
    );
};

export default Insights;
