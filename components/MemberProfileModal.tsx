
import React, { useMemo, useState } from 'react';
import type { Member, Entry, Settings, EntryType, DevelopmentFundEntry } from '../types';
import { formatCurrency, sanitizeString } from '../utils';

interface MemberProfileModalProps {
    member: Member;
    entries: Entry[];
    developmentEntries: DevelopmentFundEntry[];
    settings: Settings;
    onClose: () => void;
}

const MemberProfileModal: React.FC<MemberProfileModalProps> = ({ member, entries, developmentEntries, settings, onClose }) => {
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState<number>(currentYear);
    const [viewMode, setViewMode] = useState<'summary' | 'statement'>('summary');

    // Filter data for THIS member ONLY and selected year
    const yearData = useMemo(() => {
        // CRITICAL: Filter by member.id to get only this member's data
        const filteredEntries = entries.filter(e => 
            e.memberID === member.id && 
            new Date(e.date).getFullYear() === selectedYear &&
            !e.deleted
        );
        
        const filteredDev = developmentEntries.filter(e =>
            e.memberId === member.id &&
            new Date(e.date).getFullYear() === selectedYear
        );

        const totals: Record<string, number> = {
            'tithe': 0,
            'offering': 0,
            'thanksgiving-offering': 0,
            'development': 0,
            'other': 0
        };

        filteredEntries.forEach(e => {
            const key = totals.hasOwnProperty(e.type) ? e.type : 'other';
            totals[key] += e.amount;
        });

        filteredDev.forEach(e => {
            totals['development'] += e.amount;
        });

        const allTransactions = [
            ...filteredEntries.map(e => ({ ...e, isDev: false })),
            ...filteredDev.map(e => ({ ...e, type: 'development' as const, memberName: member.name, memberID: member.id, fund: 'Dev Fund', method: 'cash', note: e.description, isDev: true }))
        ].sort((a, b) => b.date.localeCompare(a.date));

        const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);

        return { totals, transactions: allTransactions, grandTotal };
    }, [member.id, entries, developmentEntries, selectedYear]);

    const printStatement = () => {
        // Add print class to body to hide background content
        document.body.classList.add('printing-statement');
        window.print();
        // Remove class after print dialog closes
        setTimeout(() => document.body.classList.remove('printing-statement'), 100);
    };

    const exportToCSV = () => {
        // Prepare CSV content
        const headers = ['Date', 'Type', 'Note', 'Amount'];
        const rows = yearData.transactions.map(t => [
            t.date,
            t.type.replace(/-/g, ' '),
            (t.note || '').replace(/,/g, ';'), // Replace commas in notes
            t.amount.toString()
        ]);
        
        // Add total row
        rows.push(['', '', 'TOTAL', yearData.grandTotal.toString()]);
        
        // Build CSV string
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');
        
        // Create blob and download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${sanitizeString(member.name)}_Statement_${selectedYear}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n.charAt(0).toUpperCase()).slice(0, 2).join('');
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex justify-center items-start p-4 overflow-y-auto modal-overlay" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl mt-8 mb-8 border-2 border-slate-200 printable-modal" onClick={e => e.stopPropagation()}>
                
                {/* Modern Header with Avatar */}
                <div className="bg-gradient-to-r from-slate-700 to-slate-800 p-8 rounded-t-2xl text-white no-print">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-6">
                            {/* Avatar Circle */}
                            <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-3xl font-bold ring-4 ring-white/30">
                                {getInitials(sanitizeString(member.name))}
                            </div>
                            <div>
                                <h2 className="text-3xl font-bold mb-2">{sanitizeString(member.name)}</h2>
                                <div className="flex flex-wrap gap-2 text-sm">
                                    <span className="bg-white/20 backdrop-blur px-3 py-1 rounded-full font-semibold">Class {member.classNumber || 'N/A'}</span>
                                    <span className="bg-white/20 backdrop-blur px-3 py-1 rounded-full font-semibold">Member #{member.memberNumber || 'N/A'}</span>
                                    {member.email && (
                                        <span className="bg-white/20 backdrop-blur px-3 py-1 rounded-full font-semibold">📧 {member.email}</span>
                                    )}
                                    {member.phone && (
                                        <span className="bg-white/20 backdrop-blur px-3 py-1 rounded-full font-semibold">📞 {member.phone}</span>
                                    )}
                                    {member.profession && (
                                        <span className="bg-white/20 backdrop-blur px-3 py-1 rounded-full font-semibold">💼 {member.profession}</span>
                                    )}
                                    {member.dobMonth && member.dobDay && (
                                        <span className="bg-white/20 backdrop-blur px-3 py-1 rounded-full font-semibold">
                                            🎂 {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][member.dobMonth-1]} {member.dobDay}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-lg text-2xl font-bold transition-all">×</button>
                    </div>
                </div>

                {/* Year Selector & View Toggle */}
                <div className="bg-slate-50 px-8 py-4 border-b border-slate-200 flex justify-between items-center no-print">
                    <select 
                        value={selectedYear} 
                        onChange={e => setSelectedYear(parseInt(e.target.value))}
                        className="border-2 border-slate-300 rounded-lg shadow-sm py-2 px-4 text-base font-bold text-slate-700 focus:ring-2 focus:ring-slate-400"
                    >
                        {Array.from({ length: 5 }, (_, i) => currentYear - i).map(year => (
                            <option key={year} value={year}>📅 {year}</option>
                        ))}
                    </select>
                    <div className="flex gap-3">
                        {viewMode === 'summary' ? (
                            <button onClick={() => setViewMode('statement')} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-lg shadow-md transition-all">
                                📄 View Yearly Statement
                            </button>
                        ) : (
                            <button onClick={() => setViewMode('summary')} className="bg-slate-400 hover:bg-slate-500 text-white font-bold py-2 px-6 rounded-lg shadow-md transition-all">
                                ← Back to Summary
                            </button>
                        )}
                    </div>
                </div>

                {/* Content Area */}
                <div className="p-8 printable-statement">
                    
                    {viewMode === 'statement' && (
                        <div className="text-center mb-8 border-b-2 border-slate-800 pb-6 hidden-on-screen block-on-print">
                            <h1 className="text-3xl font-bold text-slate-900 uppercase tracking-widest">Yearly Contribution Statement</h1>
                            <p className="text-xl text-slate-600 mt-2 font-medium">Fiscal Year: {selectedYear}</p>
                            <div className="mt-6 flex justify-between items-end text-left">
                                <div>
                                    <p className="text-sm uppercase text-slate-400 font-bold">Member Details</p>
                                    <h3 className="text-xl font-bold">{member.name}</h3>
                                    <p>Member #: {member.memberNumber || '-'}</p>
                                    <p>Class: {member.classNumber || '-'}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm uppercase text-slate-400 font-bold">Date Generated</p>
                                    <p>{new Date().toLocaleDateString()}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Financial Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-gradient-to-br from-blue-400 to-blue-600 p-5 rounded-xl shadow-lg text-white">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold uppercase opacity-90">Total Giving</span>
                                <span className="text-2xl">💰</span>
                            </div>
                            <span className="block text-3xl font-extrabold">{formatCurrency(yearData.grandTotal, settings.currency)}</span>
                            <span className="text-xs opacity-80 mt-1 block">{selectedYear}</span>
                        </div>
                        <div className="bg-gradient-to-br from-green-400 to-green-600 p-5 rounded-xl shadow-lg text-white">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold uppercase opacity-90">Tithes</span>
                                <span className="text-2xl">📊</span>
                            </div>
                            <span className="block text-2xl font-bold">{formatCurrency(yearData.totals['tithe'], settings.currency)}</span>
                        </div>
                        <div className="bg-gradient-to-br from-purple-400 to-purple-600 p-5 rounded-xl shadow-lg text-white">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold uppercase opacity-90">Offerings</span>
                                <span className="text-2xl">🙏</span>
                            </div>
                            <span className="block text-2xl font-bold">{formatCurrency(yearData.totals['offering'], settings.currency)}</span>
                        </div>
                        <div className="bg-gradient-to-br from-amber-400 to-amber-600 p-5 rounded-xl shadow-lg text-white">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold uppercase opacity-90">Dev. Fund</span>
                                <span className="text-2xl">🏗️</span>
                            </div>
                            <span className="block text-2xl font-bold">{formatCurrency(yearData.totals['development'], settings.currency)}</span>
                        </div>
                    </div>

                    {/* Transaction List */}
                    <div className="mt-8">
                         <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-slate-800">
                                📋 Transaction History
                            </h3>
                            <span className="bg-slate-100 px-3 py-1 rounded-full text-sm font-bold text-slate-600">
                                {yearData.transactions.length} transaction{yearData.transactions.length !== 1 ? 's' : ''}
                            </span>
                         </div>
                        {yearData.transactions.length > 0 ? (
                            <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden shadow-sm">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-100 text-slate-700 font-bold">
                                        <tr>
                                            <th className="px-4 py-3">Date</th>
                                            <th className="px-4 py-3">Type</th>
                                            <th className="px-4 py-3">Note</th>
                                            <th className="px-4 py-3 text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {yearData.transactions.map((t, idx) => (
                                            <tr key={t.id || idx} className="hover:bg-blue-50 transition-colors">
                                                <td className="px-4 py-3 font-medium text-slate-700">{t.date}</td>
                                                <td className="px-4 py-3">
                                                    <span className="inline-block px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                                                        {t.type.replace(/-/g, ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-slate-500 italic max-w-xs truncate">{t.note || '—'}</td>
                                                <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(t.amount, settings.currency)}</td>
                                            </tr>
                                        ))}
                                        <tr className="bg-slate-700 text-white font-bold border-t-2 border-slate-800">
                                            <td colSpan={3} className="px-4 py-4 text-right uppercase text-base">Total for {selectedYear}</td>
                                            <td className="px-4 py-4 text-right text-xl">{formatCurrency(yearData.grandTotal, settings.currency)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-16 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                                <div className="text-6xl mb-3">📭</div>
                                <p className="text-xl font-bold text-slate-600">No contributions found</p>
                                <p className="text-slate-400 mt-1">No records for {selectedYear}</p>
                            </div>
                        )}
                    </div>
                    
                    {viewMode === 'statement' && (
                        <div className="mt-12 pt-8 border-t border-slate-200 text-center text-slate-500 text-sm hidden-on-screen block-on-print">
                            <p>Thank you for your generous support of the church's mission.</p>
                            <p className="mt-2 font-bold">Ghana Methodist Church Toronto</p>
                        </div>
                    )}
                </div>

                {/* Footer Actions (Hidden on Print) */}
                <div className="p-6 bg-gradient-to-r from-slate-50 to-slate-100 rounded-b-2xl border-t-2 border-slate-200 flex justify-between items-center gap-3 no-print">
                    <div className="text-sm text-slate-600">
                        <span className="font-bold">Member ID:</span> {member.id.substring(0, 12)}
                    </div>
                    <div className="flex gap-3">
                        {viewMode === 'statement' && (
                            <>
                                <button onClick={printStatement} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg shadow-md flex items-center gap-2 transition-all hover:scale-105">
                                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v6a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
                                    </svg>
                                    Print Statement
                                </button>
                                <button onClick={exportToCSV} className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg shadow-md flex items-center gap-2 transition-all hover:scale-105">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                    Export CSV
                                </button>
                            </>
                        )}
                        <button onClick={onClose} className="bg-white border-2 border-slate-300 hover:bg-slate-100 text-slate-700 font-bold py-3 px-6 rounded-lg transition-all">
                            Close
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                @media print {
                    /* When printing, hide everything except the modal */
                    body.printing-statement > *:not(.modal-overlay) {
                        display: none !important;
                    }
                    
                    /* Make modal overlay clean for print */
                    body.printing-statement .modal-overlay {
                        position: static !important;
                        background: white !important;
                        backdrop-filter: none !important;
                        padding: 0 !important;
                        overflow: visible !important;
                        display: block !important;
                    }
                    
                    /* Make modal full width for print */
                    body.printing-statement .printable-modal {
                        max-width: 100% !important;
                        width: 100% !important;
                        margin: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                    }
                    
                    /* Ensure all content is visible on print */
                    .printable-statement > * {
                        display: block !important;
                    }
                    
                    /* Grid should stay as grid */
                    .grid {
                        display: grid !important;
                    }
                    
                    /* Tables should stay as tables */
                    table {
                        display: table !important;
                    }
                    
                    /* Hide controls and non-printable elements */
                    .no-print { display: none !important; }
                    
                    /* Show print-only content */
                    .block-on-print { display: block !important; }
                    
                    /* Clean background */
                    body { 
                        background: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                }
                .hidden-on-screen { display: none; }
            `}</style>
        </div>
    );
};

export default MemberProfileModal;
