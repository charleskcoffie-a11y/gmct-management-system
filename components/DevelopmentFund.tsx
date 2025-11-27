
import React, { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Member, DevelopmentFundEntry, Settings } from '../types';
import { formatCurrency, sanitizeString } from '../utils';

interface DevelopmentFundProps {
    members: Member[];
    entries: DevelopmentFundEntry[];
    setEntries: React.Dispatch<React.SetStateAction<DevelopmentFundEntry[]>>;
    settings: Settings;
}

const DevelopmentFund: React.FC<DevelopmentFundProps> = ({ members, entries, setEntries, settings }) => {
    // --- State ---
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)); // Jan 1st
    const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10)); // Today
    const [showToast, setShowToast] = useState(false);

    // Form State
    const [newAmount, setNewAmount] = useState('');
    const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
    const [newDesc, setNewDesc] = useState('');

    // --- Derived Data ---
    const filteredMembers = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return members.filter(m => 
            m.name.toLowerCase().includes(term) ||
            (m.memberNumber && m.memberNumber.toLowerCase().includes(term)) ||
            (m.classNumber && m.classNumber === term) || 
            (m.classNumber && `class ${m.classNumber}` === term)
        ).sort((a, b) => {
            const classA = parseInt(a.classNumber || '9999');
            const classB = parseInt(b.classNumber || '9999');
            if (classA !== classB) return classA - classB;
            return a.name.localeCompare(b.name);
        });
    }, [members, searchTerm]);

    const displayEntries = useMemo(() => {
        let filtered = entries.filter(e => {
            if (startDate && e.date < startDate) return false;
            if (endDate && e.date > endDate) return false;
            if (selectedMember && e.memberId !== selectedMember.id) return false;
            return true;
        });

        // Sort: Class Number -> Member Name -> Date Descending
        return filtered.map(e => {
            const member = members.find(m => m.id === e.memberId);
            return {
                ...e,
                memberName: member?.name || 'Unknown',
                memberNumber: member?.memberNumber || '-',
                classNumber: member?.classNumber || '9999'
            };
        }).sort((a, b) => {
            const classA = parseInt(a.classNumber);
            const classB = parseInt(b.classNumber);
            if (classA !== classB) return classA - classB;
            
            const nameCompare = a.memberName.localeCompare(b.memberName);
            if (nameCompare !== 0) return nameCompare;

            return b.date.localeCompare(a.date); // Newest first
        });

    }, [entries, members, selectedMember, startDate, endDate]);

    const totalContributions = displayEntries.reduce((sum, e) => sum + e.amount, 0);

    // --- Handlers ---

    const handleAddEntry = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMember) return alert("Please select a member first.");
        
        const amountVal = parseFloat(newAmount);
        if (isNaN(amountVal) || amountVal <= 0) return alert("Please enter a valid positive amount.");
        if (new Date(newDate) > new Date()) {
             if(!window.confirm("Date is in the future. Continue?")) return;
        }

        const newEntry: DevelopmentFundEntry = {
            id: uuidv4(),
            date: newDate,
            amount: amountVal,
            description: newDesc,
            memberId: selectedMember.id
        };

        setEntries(prev => [...prev, newEntry]);
        
        // Reset form but keep date
        setNewAmount('');
        setNewDesc('');
        
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            handleAddEntry(e as any);
        }
    };

    const handleDelete = (id: string) => {
        if(window.confirm("Delete this contribution?")) {
            setEntries(prev => prev.filter(e => e.id !== id));
        }
    };

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col md:flex-row gap-6 relative">
            
            {showToast && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-2 rounded-full shadow-lg font-bold animate-fadeIn z-50">
                    ✓ Contribution Added
                </div>
            )}

            {/* Sidebar: Member Search */}
            <div className="w-full md:w-1/3 lg:w-1/4 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200">
                    <h3 className="font-bold text-slate-700 mb-2">Member Search</h3>
                    <input 
                        type="text" 
                        placeholder="Name, ID, or Class..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500"
                    />
                </div>
                <div className="flex-1 overflow-y-auto">
                    {filteredMembers.map(m => (
                        <button
                            key={m.id}
                            onClick={() => setSelectedMember(m)}
                            className={`w-full text-left p-4 border-b border-slate-100 transition-colors flex justify-between items-center ${selectedMember?.id === m.id ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : 'hover:bg-slate-50'}`}
                        >
                            <div>
                                <div className="font-bold text-slate-800">{sanitizeString(m.name)}</div>
                                <div className="text-xs text-slate-500">Class {m.classNumber || '-'} • ID: {m.memberNumber || '-'}</div>
                            </div>
                            <div className="text-indigo-400">›</div>
                        </button>
                    ))}
                    {filteredMembers.length === 0 && (
                        <div className="p-8 text-center text-slate-400 italic">No members found.</div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                
                {/* Header / Filters / Stats */}
                <div className="p-6 border-b border-slate-200 bg-slate-50 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-slate-800">Development Fund</h2>
                        <p className="text-slate-500 text-sm mt-1">
                            {selectedMember 
                                ? `Showing records for ${sanitizeString(selectedMember.name)}` 
                                : "Viewing all contributions (Select a member to add)"}
                        </p>
                    </div>

                    <div className="bg-white px-6 py-3 rounded-xl border border-indigo-100 shadow-sm flex flex-col items-end min-w-[200px]">
                        <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Total Collected</span>
                        <span className="text-2xl font-extrabold text-indigo-600">{formatCurrency(totalContributions, settings.currency)}</span>
                    </div>

                    <div className="flex gap-2 items-center bg-white p-2 rounded-lg border border-slate-200 shadow-sm self-stretch xl:self-auto justify-center">
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border-none text-sm focus:ring-0 text-slate-600 bg-transparent"/>
                        <span className="text-slate-400 font-bold">to</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border-none text-sm focus:ring-0 text-slate-600 bg-transparent"/>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                    
                    {/* List of Contributions */}
                    <div className="flex-1 overflow-y-auto p-0 lg:border-r border-slate-200 relative">
                         <table className="w-full text-left text-slate-600">
                            <thead className="bg-slate-100 text-slate-700 text-xs uppercase font-bold sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-4 py-3 cursor-pointer">Date ▼</th>
                                    {!selectedMember && <th className="px-4 py-3">Member</th>}
                                    <th className="px-4 py-3">Class</th>
                                    <th className="px-4 py-3">Desc</th>
                                    <th className="px-4 py-3 text-right">Amount</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {displayEntries.map(entry => (
                                    <tr key={entry.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 whitespace-nowrap">{entry.date}</td>
                                        {!selectedMember && (
                                            <td className="px-4 py-3 font-medium text-slate-800">{entry.memberName}</td>
                                        )}
                                        <td className="px-4 py-3 text-center">{entry.classNumber}</td>
                                        <td className="px-4 py-3 truncate max-w-[150px]">{entry.description}</td>
                                        <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(entry.amount, settings.currency)}</td>
                                        <td className="px-4 py-3 text-right">
                                            <button onClick={() => handleDelete(entry.id)} className="text-red-400 hover:text-red-600 font-bold px-2 py-1 rounded hover:bg-red-50">×</button>
                                        </td>
                                    </tr>
                                ))}
                                {displayEntries.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-12 text-center text-slate-400">
                                            <p className="text-lg">No contributions found.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Add Entry Form (Only visible if member selected) */}
                    {selectedMember ? (
                        <div className="w-full lg:w-1/3 bg-slate-50 p-6 shadow-inner overflow-y-auto h-full border-t lg:border-t-0 border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2 flex items-center gap-2">
                                <span className="bg-indigo-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">+</span>
                                Add Contribution
                            </h3>
                            <div className="mb-6 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Beneficiary</span>
                                <div className="font-bold text-xl text-indigo-700 mt-1">{sanitizeString(selectedMember.name)}</div>
                                <div className="text-sm font-medium text-slate-500 mt-1 flex gap-3">
                                    <span className="bg-slate-100 px-2 py-0.5 rounded">Class {selectedMember.classNumber}</span>
                                    <span className="bg-slate-100 px-2 py-0.5 rounded">ID: {selectedMember.memberNumber || 'N/A'}</span>
                                </div>
                            </div>
                            
                            <form onSubmit={handleAddEntry} onKeyDown={handleKeyDown} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Date</label>
                                    <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} required className="w-full border-slate-300 rounded-lg shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Amount</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <span className="text-slate-500 font-bold">$</span>
                                        </div>
                                        <input type="number" step="0.01" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="0.00" required className="w-full pl-8 border-slate-300 rounded-lg shadow-sm font-bold text-xl py-2 focus:ring-indigo-500 focus:border-indigo-500 text-indigo-700" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Description (Optional)</label>
                                    <textarea rows={3} value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="e.g. Monthly pledge" className="w-full border-slate-300 rounded-lg shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500" />
                                </div>
                                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-lg shadow-lg transition-all hover:scale-[1.02] active:scale-95 text-lg">
                                    Save Contribution
                                </button>
                                <p className="text-center text-xs text-slate-400">Press Ctrl+Enter to save</p>
                                <button type="button" onClick={() => setSelectedMember(null)} className="w-full text-slate-500 text-sm hover:text-slate-700 font-medium py-2">
                                    Cancel Selection
                                </button>
                            </form>
                        </div>
                    ) : (
                        <div className="hidden lg:flex w-1/3 bg-slate-50 items-center justify-center p-8 text-center text-slate-400 border-l border-slate-200">
                            <div>
                                <div className="bg-slate-200 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                                    <span className="text-4xl text-white font-bold">←</span>
                                </div>
                                <h4 className="text-lg font-bold text-slate-600">Select a Member</h4>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DevelopmentFund;
