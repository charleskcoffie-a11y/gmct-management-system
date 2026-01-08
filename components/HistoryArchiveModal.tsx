// components/HistoryArchiveModal.tsx
import React, { useMemo, useState } from 'react';
import type { WeeklyHistoryRecord } from '../types';

interface HistoryArchiveModalProps {
    isOpen: boolean;
    onClose: () => void;
    history: WeeklyHistoryRecord[];
    onEditRecord?: (record: WeeklyHistoryRecord) => void;
    onDeleteRecord?: (id: string) => void;
}

const HistoryArchiveModal: React.FC<HistoryArchiveModalProps> = ({ isOpen, onClose, history, onEditRecord, onDeleteRecord }) => {
    const [yearFilter, setYearFilter] = useState<string>('all');
    const [monthFilter, setMonthFilter] = useState<string>('all');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const availableYears = useMemo(() => {
        const years = new Set<string>();
        history.forEach(rec => years.add(rec.dateOfService.slice(0, 4)));
        return Array.from(years).sort((a, b) => b.localeCompare(a));
    }, [history]);

    const filteredHistory = useMemo(() => {
        return history.filter(rec => {
            const year = rec.dateOfService.slice(0, 4);
            const month = rec.dateOfService.slice(5, 7);
            if (yearFilter !== 'all' && year !== yearFilter) return false;
            if (monthFilter !== 'all' && month !== monthFilter) return false;
            return true;
        }).sort((a, b) => b.dateOfService.localeCompare(a.dateOfService));
    }, [history, yearFilter, monthFilter]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border-2 border-slate-200 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-700 to-slate-900 p-6 border-b-2 border-slate-800">
                    <div className="flex justify-between items-center">
                        <h2 className="text-3xl font-extrabold text-white flex items-center gap-3">
                            📚 History Archive
                        </h2>
                        <button onClick={onClose} className="text-white hover:text-slate-200 text-3xl font-bold transition-colors">×</button>
                    </div>
                    <p className="text-slate-200 mt-1 font-medium">Browse and search through all service records</p>
                </div>

                {/* Filters */}
                <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-6 border-b border-slate-200 flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-sm font-bold uppercase text-slate-700 mb-2">📅 Year</label>
                        <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="w-full border-2 border-slate-300 rounded-lg py-2 px-3 font-bold text-slate-700 focus:ring-2 focus:ring-slate-400 focus:border-slate-400">
                            <option value="all">All Years</option>
                            {availableYears.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-bold uppercase text-slate-700 mb-2">📆 Month</label>
                        <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="w-full border-2 border-slate-300 rounded-lg py-2 px-3 font-bold text-slate-700 focus:ring-2 focus:ring-slate-400 focus:border-slate-400">
                            <option value="all">All Months</option>
                            {["01","02","03","04","05","06","07","08","09","10","11","12"].map(month => (
                                <option key={month} value={month}>Month {month}</option>
                            ))}
                        </select>
                    </div>
                    <div className="text-sm font-bold text-slate-700 bg-white px-4 py-2 rounded-lg border border-slate-300">
                        📋 {filteredHistory.length} record{filteredHistory.length !== 1 ? 's' : ''}
                    </div>
                </div>

                {/* Content - Scrollable */}
                <div className="overflow-y-auto flex-1 p-6 space-y-3">
                    {filteredHistory.length > 0 ? (
                        filteredHistory.map((rec, idx) => (
                            <div key={rec.id} className="bg-gradient-to-r from-slate-50 to-slate-100 border-2 border-slate-200 rounded-lg p-4 hover:shadow-lg hover:border-slate-400 transition-all hover:scale-[1.01]">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
                                    {/* Date Card */}
                                    <div className="bg-white rounded-lg p-3 border border-slate-300">
                                        <div className="text-xs font-bold uppercase text-slate-600 mb-1">Date</div>
                                        <div className="text-lg font-extrabold text-slate-900">{rec.dateOfService}</div>
                                    </div>

                                    {/* Officiant Card */}
                                    <div className="bg-white rounded-lg p-3 border border-slate-300">
                                        <div className="text-xs font-bold uppercase text-slate-600 mb-1">Officiant</div>
                                        <div className="text-sm font-bold text-slate-800 truncate">{rec.officiant || '—'}</div>
                                    </div>

                                    {/* Topic Card */}
                                    <div className="bg-white rounded-lg p-3 border border-slate-300 md:col-span-2">
                                        <div className="text-xs font-bold uppercase text-slate-600 mb-1">Sermon Topic</div>
                                        <div className="text-sm font-bold text-slate-800 line-clamp-2">{rec.sermonTopic || '—'}</div>
                                    </div>
                                </div>

                                {/* Details Row */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-xs">
                                    <div className="bg-blue-100 border border-blue-300 rounded-lg p-2 text-center">
                                        <div className="font-bold text-blue-900">👥 Attendance</div>
                                        <div className="font-extrabold text-lg text-blue-700">{rec.attendance.men + rec.attendance.women + rec.attendance.children + rec.attendance.visitors}</div>
                                    </div>
                                    <div className="bg-emerald-100 border border-emerald-300 rounded-lg p-2 text-center">
                                        <div className="font-bold text-emerald-900">🤝 Visitors</div>
                                        <div className="font-extrabold text-lg text-emerald-700">{rec.visitorsList.length}</div>
                                    </div>
                                    <div className="bg-amber-100 border border-amber-300 rounded-lg p-2 text-center">
                                        <div className="font-bold text-amber-900">💝 Donations</div>
                                        <div className="font-extrabold text-lg text-amber-700">{rec.donationsList.length}</div>
                                    </div>
                                    <div className="bg-purple-100 border border-purple-300 rounded-lg p-2 text-center">
                                        <div className="font-bold text-purple-900">📝 By</div>
                                        <div className="font-bold text-purple-700 truncate">{rec.preparedBy || '—'}</div>
                                    </div>
                                </div>

                                {/* Expand Details & Edit Button */}
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
                                        className="flex-1 bg-slate-300 hover:bg-slate-400 text-slate-900 font-bold py-1 px-3 rounded text-sm"
                                    >
                                        {expandedId === rec.id ? '▼ Collapse' : '▶ Details'}
                                    </button>
                                    {onEditRecord && (
                                        <button 
                                            onClick={() => {
                                                onEditRecord(rec);
                                                onClose();
                                            }}
                                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded text-sm"
                                        >
                                            ✏️ Edit
                                        </button>
                                    )}
                                    {onDeleteRecord && (
                                        <button 
                                            onClick={() => {
                                                if (window.confirm(`Delete record from ${rec.dateOfService}?`)) {
                                                    onDeleteRecord(rec.id);
                                                }
                                            }}
                                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded text-sm"
                                        >
                                            🗑️ Delete
                                        </button>
                                    )}
                                </div>

                                {/* Expanded Details */}
                                {expandedId === rec.id && (
                                    <div className="mt-3 pt-3 border-t border-slate-300 grid grid-cols-2 gap-2 text-xs">
                                        <div className="bg-white p-2 rounded border border-slate-200">
                                            <span className="font-bold text-slate-600">Liturgist:</span> {rec.liturgist || '—'}
                                        </div>
                                        <div className="bg-white p-2 rounded border border-slate-200">
                                            <span className="font-bold text-slate-600">Announcements:</span> {rec.announcementsBy || '—'}
                                        </div>
                                        {rec.worshipHighlights && (
                                            <div className="bg-white p-2 rounded border border-slate-200 col-span-2">
                                                <span className="font-bold text-slate-600">Worship Highlights:</span> {rec.worshipHighlights}
                                            </div>
                                        )}
                                        {rec.observations && (
                                            <div className="bg-white p-2 rounded border border-slate-200 col-span-2">
                                                <span className="font-bold text-slate-600">Observations:</span> {rec.observations}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-12">
                            <div className="text-6xl mb-4">📭</div>
                            <p className="text-xl font-bold text-slate-500">No records found</p>
                            <p className="text-sm text-slate-400">Try adjusting your filters</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-slate-100 border-t border-slate-200 p-4 flex justify-end gap-3">
                    <button onClick={onClose} className="bg-gradient-to-br from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white font-bold py-2 px-6 rounded-lg shadow-md transition-all">
                        Close Archive
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HistoryArchiveModal;
