
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

    // Filter data for member and year
    const yearData = useMemo(() => {
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
    }, [member, entries, developmentEntries, selectedYear]);

    const printStatement = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[70] flex justify-center items-start p-4 overflow-y-auto" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mt-8 mb-8" onClick={e => e.stopPropagation()}>
                
                {/* Screen Header (Hidden on Print) */}
                <div className="flex justify-between items-center p-6 border-b border-slate-200 no-print">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">{sanitizeString(member.name)}</h2>
                        <div className="text-slate-500 text-sm flex gap-3 mt-1">
                             <span className="bg-slate-100 px-2 py-0.5 rounded">Class {member.classNumber || 'N/A'}</span>
                             <span className="bg-slate-100 px-2 py-0.5 rounded">ID: {member.memberNumber || 'N/A'}</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <select 
                            value={selectedYear} 
                            onChange={e => setSelectedYear(parseInt(e.target.value))}
                            className="border-slate-300 rounded-lg shadow-sm py-2 px-3 text-sm font-bold text-slate-700"
                        >
                            {Array.from({ length: 5 }, (_, i) => currentYear - i).map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                        {viewMode === 'summary' ? (
                            <button onClick={() => setViewMode('statement')} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-sm">
                                View Yearly Statement
                            </button>
                        ) : (
                             <button onClick={() => setViewMode('summary')} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg shadow-sm">
                                Back to Summary
                            </button>
                        )}
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 text-xl font-bold">×</button>
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
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <span className="block text-xs font-bold uppercase text-slate-400">Total Giving ({selectedYear})</span>
                            <span className="block text-2xl font-extrabold text-indigo-700 mt-1">{formatCurrency(yearData.grandTotal, settings.currency)}</span>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-100">
                            <span className="block text-xs font-bold uppercase text-slate-400">Tithes</span>
                            <span className="block text-xl font-bold text-slate-700 mt-1">{formatCurrency(yearData.totals['tithe'], settings.currency)}</span>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-100">
                            <span className="block text-xs font-bold uppercase text-slate-400">Offerings</span>
                            <span className="block text-xl font-bold text-slate-700 mt-1">{formatCurrency(yearData.totals['offering'], settings.currency)}</span>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-100">
                            <span className="block text-xs font-bold uppercase text-slate-400">Dev. Fund</span>
                            <span className="block text-xl font-bold text-slate-700 mt-1">{formatCurrency(yearData.totals['development'], settings.currency)}</span>
                        </div>
                    </div>

                    {/* Transaction List */}
                    <div className="mt-8">
                         <h3 className="text-lg font-bold text-slate-800 mb-4 uppercase tracking-wide border-b border-slate-100 pb-2">
                             Transaction History
                        </h3>
                        {yearData.transactions.length > 0 ? (
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-100 text-slate-600 uppercase font-bold">
                                    <tr>
                                        <th className="px-4 py-3">Date</th>
                                        <th className="px-4 py-3">Type</th>
                                        <th className="px-4 py-3">Note</th>
                                        <th className="px-4 py-3 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {yearData.transactions.map((t, idx) => (
                                        <tr key={t.id || idx} className="hover:bg-slate-50">
                                            <td className="px-4 py-3">{t.date}</td>
                                            <td className="px-4 py-3 capitalize font-medium">
                                                {t.type.replace(/-/g, ' ')}
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 italic max-w-xs truncate">{t.note}</td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(t.amount, settings.currency)}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-slate-50 font-bold text-slate-900 border-t-2 border-slate-300">
                                        <td colSpan={3} className="px-4 py-4 text-right uppercase">Total</td>
                                        <td className="px-4 py-4 text-right text-lg">{formatCurrency(yearData.grandTotal, settings.currency)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        ) : (
                            <p className="text-center py-12 text-slate-400 italic">No contributions found for {selectedYear}.</p>
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
                <div className="p-6 bg-slate-50 rounded-b-xl border-t border-slate-200 flex justify-end gap-3 no-print">
                    {viewMode === 'statement' && (
                        <button onClick={printStatement} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg shadow-md flex items-center gap-2">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v6a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
                            </svg>
                            Print / Save as PDF
                        </button>
                    )}
                    <button onClick={onClose} className="bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold py-3 px-6 rounded-lg">
                        Close
                    </button>
                </div>
            </div>

            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    .block-on-print { display: block !important; }
                    .printable-statement { padding: 0 !important; }
                    body { background: white; }
                    .fixed { position: static; overflow: visible; }
                    .bg-black { background: white; }
                }
                .hidden-on-screen { display: none; }
            `}</style>
        </div>
    );
};

export default MemberProfileModal;
