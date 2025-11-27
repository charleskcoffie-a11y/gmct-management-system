
// components/Insights.tsx
import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import type { Entry, Settings, EntryType } from '../types';
import { formatCurrency, capitalize, calculateInsights } from '../utils';

interface InsightsProps {
    entries: Entry[];
    settings: Settings;
}

const Insights: React.FC<InsightsProps> = ({ entries, settings }) => {
    // Local Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [typeFilter, setTypeFilter] = useState<EntryType | 'all'>('all');

    // Filter Data
    const filteredEntries = useMemo(() => {
        return entries.filter(e => {
            if (startDate && e.date < startDate) return false;
            if (endDate && e.date > endDate) return false;
            if (typeFilter !== 'all' && e.type !== typeFilter) return false;
            return true;
        });
    }, [entries, startDate, endDate, typeFilter]);

    // Calculate AI Summary (based on ALL entries for context, not just filtered)
    const aiSummary = useMemo(() => calculateInsights(entries), [entries]);

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

    const monthlyData = useMemo(() => {
        const data: { [key: string]: number } = {}; 
        for (const entry of filteredEntries) {
            const monthKey = entry.date.substring(0, 7);
            data[monthKey] = (data[monthKey] || 0) + entry.amount;
        }

        return Object.keys(data)
            .sort()
            .map(monthKey => ({
                name: new Date(`${monthKey}-02`).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
                Total: data[monthKey],
            }));
    }, [filteredEntries]);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-2 border border-slate-200 rounded shadow-sm">
                    <p className="font-bold">{label}</p>
                    <p className="text-indigo-600">{`${payload[0].name}: ${formatCurrency(payload[0].value, settings.currency)}`}</p>
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
                        {["tithe", "offering", "thanksgiving-offering", "pledge", "harvest-levy", "kofi-and-ama", "other"].map(t => (
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
                    <h3 className="text-lg font-bold text-slate-800 mb-4 px-2">Trend Analysis</h3>
                    {monthlyData.length > 0 ? (
                        <div style={{ width: '100%', height: 350 }}>
                            <ResponsiveContainer>
                                <BarChart data={monthlyData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" />
                                    <YAxis tickFormatter={(tick) => formatCurrency(tick, settings.currency).replace('.00', '')} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="Total" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                                </BarChart>
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
        </div>
    );
};

export default Insights;
