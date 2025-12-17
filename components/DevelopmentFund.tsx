
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Member, Entry, Settings } from '../types';
import { formatCurrency, sanitizeString } from '../utils';
import { saveEntryToSupabase, deleteEntryFromSupabase } from '../services/supabase';

interface DevelopmentFundProps {
    members: Member[];
    entries: Entry[];
    setEntries: React.Dispatch<React.SetStateAction<Entry[]>>;
    settings: Settings;
}

const DevelopmentFund: React.FC<DevelopmentFundProps> = ({ members, entries, setEntries, settings }) => {
    // --- State ---
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState(''); // Empty = show all
    const [endDate, setEndDate] = useState(''); // Empty = show all
    const [showToast, setShowToast] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [historyScope, setHistoryScope] = useState<'filtered' | 'all'>('filtered');
    const [datePreset, setDatePreset] = useState<'custom' | 'this-week' | 'this-month' | 'qtd' | 'ytd' | 'last-12m'>('custom');
    const [sortConfig, setSortConfig] = useState<{ key: 'date' | 'amount'; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editDate, setEditDate] = useState<string>('');
    const [editAmount, setEditAmount] = useState<string>('');
    const [editDesc, setEditDesc] = useState<string>('');
    const [lastDeleted, setLastDeleted] = useState<Entry | null>(null);
    const quickAmountRef = useRef<HTMLInputElement | null>(null);
    const [duplicateWarning, setDuplicateWarning] = useState(false);

    // Form State
    const [newAmount, setNewAmount] = useState('');
    const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));
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
            if (e.type !== 'development-fund') return false;
            if (e.deleted) return false; // Hide deleted entries
            if (startDate && e.date < startDate) return false;
            if (endDate && e.date > endDate) return false;
            if (selectedMember && e.memberID !== selectedMember.id) return false;
            return true;
        });

        // Map with member details and normalize fields used in UI
        const mapped = filtered.map(e => {
            const member = members.find(m => m.id === e.memberID);
            return {
                id: e.id,
                date: e.date,
                amount: e.amount || 0,
                description: (e as any).note || '',
                memberId: e.memberID,
                memberName: e.memberName || member?.name || 'Unknown',
                memberNumber: member?.memberNumber || '-',
                classNumber: e.classNumber || member?.classNumber || '9999'
            };
        });

        // Sort according to sortConfig
        const sortable = [...mapped];
        sortable.sort((a, b) => {
            let cmp = 0;
            if (sortConfig.key === 'date') {
                cmp = a.date.localeCompare(b.date);
            } else if (sortConfig.key === 'amount') {
                cmp = a.amount - b.amount;
            }
            return sortConfig.direction === 'asc' ? cmp : -cmp;
        });
        return sortable;

    }, [entries, members, selectedMember, startDate, endDate, sortConfig]);

    const totalContributions = displayEntries.reduce((sum, e) => sum + e.amount, 0);

    const selectedMemberEntries = useMemo(() => {
        if (!selectedMember) return [] as Array<Entry & { date: string }>;
        const baseAll = entries.filter(e => e.type === 'development-fund' && e.memberID === selectedMember.id);
        const base = historyScope === 'filtered'
            ? baseAll.filter(e => (!startDate || e.date >= startDate) && (!endDate || e.date <= endDate))
            : baseAll;
        return base.sort((a, b) => b.date.localeCompare(a.date));
    }, [entries, selectedMember, historyScope, startDate, endDate]);

    // --- Handlers ---

    // Check for duplicate in real-time - calculate directly instead of useMemo
    const hasDuplicate = (() => {
        if (!selectedMember || !newDate) return false;
        
        return entries.some(en => 
            !en.deleted &&
            en.type === 'development-fund' &&
            en.memberID === selectedMember.id &&
            en.date === newDate
        );
    })();

    const handleAddEntry = async (e: React.FormEvent | React.MouseEvent) => {
        if ('preventDefault' in e) e.preventDefault();
        
        // CRITICAL: Block submission if duplicate exists (even via keyboard shortcuts)
        if (hasDuplicate) {
            console.log('🚫 DUPLICATE DETECTED - Entry blocked');
            setDuplicateWarning(true);
            return;
        }
        
        if (!selectedMember) return alert("Please select a member first.");
        
        const amountVal = parseFloat(newAmount);
        if (isNaN(amountVal) || amountVal <= 0) return alert("Please enter a valid positive amount.");
        if (new Date(newDate) > new Date()) {
             if(!window.confirm("Date is in the future. Continue?")) return;
        }

        const newEntry: Entry = {
            id: uuidv4(),
            date: newDate,
            memberID: selectedMember.id,
            memberName: selectedMember.name,
            classNumber: selectedMember.classNumber,
            type: 'development-fund',
            fund: 'development-fund',
            method: 'other',
            amount: amountVal,
            note: newDesc || undefined,
            createdAt: new Date().toISOString(),
            deleted: false
        };

        // Save to database first (multi-user mode)
        try {
            if (settings.supabaseUrl && settings.supabaseKey) {
                await saveEntryToSupabase(settings.supabaseUrl, settings.supabaseKey, newEntry);
            }
            // Then update local state
            setEntries(prev => [...prev, newEntry]);
            
            // Reset form completely
            setNewAmount('');
            setNewDesc('');
            setNewDate(new Date().toISOString().slice(0, 10)); // Reset to today
            setDuplicateWarning(false); // Clear any previous warning
            
            setShowToast(true);
            setTimeout(() => setShowToast(false), 3000);
            // Focus amount for quick batch entry
            quickAmountRef.current?.focus();
        } catch (error: any) {
            alert(`Failed to save: ${error.message}`);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            // Prevent keyboard submission if duplicate exists
            if (hasDuplicate) {
                e.preventDefault();
                setDuplicateWarning(true);
                return;
            }
            handleAddEntry(e as any);
        }
    };

    const handleDelete = async (id: string) => {
        const entry = entries.find(e => e.id === id) || null;
        if(window.confirm("Delete this contribution?")) {
            try {
                if (settings.supabaseUrl && settings.supabaseKey) {
                    await deleteEntryFromSupabase(settings.supabaseUrl, settings.supabaseKey, id);
                }
                setEntries(prev => prev.filter(e => e.id !== id));
                setLastDeleted(entry);
            } catch (error: any) {
                alert(`Failed to delete: ${error.message}`);
            }
        }
    };

    const undoDelete = async () => {
        if (!lastDeleted) return;
        try {
            if (settings.supabaseUrl && settings.supabaseKey) {
                await saveEntryToSupabase(settings.supabaseUrl, settings.supabaseKey, lastDeleted);
            }
            setEntries(prev => [...prev, lastDeleted!]);
            setLastDeleted(null);
        } catch (error: any) {
            alert(`Failed to restore: ${error.message}`);
        }
    };

    const startEdit = (entryId: string, date: string, amount: number, desc: string) => {
        setEditingId(entryId);
        setEditDate(date);
        setEditAmount(String(amount));
        setEditDesc(desc || '');
    };

    const saveEdit = async () => {
        if (!editingId) return;
        const amountVal = parseFloat(editAmount);
        if (isNaN(amountVal) || amountVal <= 0) { alert('Enter a valid positive amount.'); return; }
        if (new Date(editDate) > new Date()) {
            if (!window.confirm('Date is in the future. Continue?')) return;
        }
        try {
            const updatedEntry = entries.find(e => e.id === editingId);
            if (updatedEntry) {
                const newEntry = { ...updatedEntry, date: editDate, amount: amountVal, note: editDesc };
                if (settings.supabaseUrl && settings.supabaseKey) {
                    await saveEntryToSupabase(settings.supabaseUrl, settings.supabaseKey, newEntry);
                }
                setEntries(prev => prev.map(e => e.id === editingId ? newEntry : e));
            }
            setEditingId(null);
        } catch (error: any) {
            alert(`Failed to save edit: ${error.message}`);
        }
    };

    const cancelEdit = () => {
        setEditingId(null);
    };

    const applyPreset = (preset: typeof datePreset) => {
        setDatePreset(preset);
        const today = new Date();
        const toISO = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10);
        let start = startDate;
        let end = endDate;
        if (preset === 'this-week') {
            const day = today.getDay();
            const diffToSunday = day; // Sunday as week start
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - diffToSunday);
            start = toISO(weekStart);
            end = toISO(today);
        } else if (preset === 'this-month') {
            const mStart = new Date(today.getFullYear(), today.getMonth(), 1);
            start = toISO(mStart);
            end = toISO(today);
        } else if (preset === 'qtd') {
            const month = today.getMonth();
            const qStartMonth = month - (month % 3);
            const qStart = new Date(today.getFullYear(), qStartMonth, 1);
            start = toISO(qStart);
            end = toISO(today);
        } else if (preset === 'ytd') {
            const yStart = new Date(today.getFullYear(), 0, 1);
            start = toISO(yStart);
            end = toISO(today);
        } else if (preset === 'last-12m') {
            const past = new Date(today);
            past.setMonth(today.getMonth() - 12);
            start = toISO(past);
            end = toISO(today);
        } else {
            // custom, do not change
        }
        setStartDate(start);
        setEndDate(end);
        try { localStorage.setItem('devfund-datePreset', preset); } catch {}
    };

    useEffect(() => {
        try {
            const savedPreset = localStorage.getItem('devfund-datePreset') as any;
            if (savedPreset) setDatePreset(savedPreset);
        } catch {}
    }, []);

    useEffect(() => {
        try { localStorage.setItem('devfund-sort', JSON.stringify(sortConfig)); } catch {}
    }, [sortConfig]);

    useEffect(() => {
        try {
            const savedScope = localStorage.getItem('devfund-historyScope') as any;
            if (savedScope) setHistoryScope(savedScope);
        } catch {}
    }, []);

    useEffect(() => {
        try { localStorage.setItem('devfund-historyScope', historyScope); } catch {}
    }, [historyScope]);

    const exportMemberCsv = () => {
        if (!selectedMember) return;
        const rows = [['Date','Amount','Description','MemberName','MemberID']];
        const member = selectedMember;
        selectedMemberEntries.forEach(e => rows.push([e.date, String(e.amount), (e as any).note || '', member.name, member.memberNumber || '-']))
        const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g,'""') + '"').join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `devfund_${member.name.replace(/\s+/g,'_')}_${historyScope}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col md:flex-row gap-6 relative">
            
            {duplicateWarning && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex justify-center items-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border-2 border-red-300 animate-fadeIn">
                        <div className="bg-gradient-to-r from-red-600 to-orange-600 p-6 rounded-t-2xl">
                            <div className="flex items-center gap-3 text-white">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <h3 className="text-xl font-bold">Duplicate Entry Detected</h3>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-slate-700 leading-relaxed">
                                A <span className="font-bold text-red-600">Development Fund</span> contribution already exists for <span className="font-bold">{selectedMember?.name}</span> on <span className="font-bold">{newDate}</span>.
                            </p>
                            <p className="text-sm text-slate-600 bg-amber-50 border-l-4 border-amber-400 p-3 rounded">
                                💡 <strong>Tip:</strong> Please choose a different date or edit the existing entry.
                            </p>
                        </div>
                        <div className="p-6 bg-slate-50 rounded-b-2xl flex justify-end">
                            <button
                                onClick={() => setDuplicateWarning(false)}
                                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold py-3 px-8 rounded-lg transition-all shadow-md hover:scale-105"
                            >
                                Got It
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showToast && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-2 rounded-full shadow-lg font-bold animate-fadeIn z-50">
                    ✓ Contribution Added
                </div>
            )}

            {/* Sidebar: Member Search */}
            <div className="w-full md:w-1/3 lg:w-1/4 flex flex-col bg-gradient-to-b from-blue-50 to-indigo-50 rounded-xl shadow-lg border-2 border-blue-200 overflow-hidden">
                <div className="p-4 bg-gradient-to-r from-blue-500 to-indigo-600 border-b border-blue-300">
                    <h3 className="font-bold text-white mb-2 text-lg">👥 Member Search</h3>
                    <input 
                        type="text" 
                        placeholder="Name, ID, or Class..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full border-2 border-blue-200 rounded-lg shadow-sm focus:ring-blue-400 focus:border-blue-400 py-2 px-3"
                    />
                </div>
                <div className="flex-1 overflow-y-auto">
                    {filteredMembers.map(m => (
                        <button
                            key={m.id}
                            onClick={() => setSelectedMember(m)}
                            className={`w-full text-left p-4 border-b border-blue-100 transition-all flex justify-between items-center ${
                              selectedMember?.id === m.id 
                                ? 'bg-gradient-to-r from-blue-400 to-indigo-500 text-white shadow-md border-l-4 border-l-blue-700 font-semibold' 
                                : 'hover:bg-blue-100 text-slate-800'
                            }`}
                        >
                            <div>
                                <div className="font-bold">{sanitizeString(m.name)}</div>
                                <div className={`text-xs ${selectedMember?.id === m.id ? 'text-blue-100' : 'text-slate-600'}`}>Class {m.classNumber || '-'} • ID: {m.memberNumber || '-'}</div>
                            </div>
                            <div className="text-lg">›</div>
                        </button>
                    ))}
                    {filteredMembers.length === 0 && (
                        <div className="p-8 text-center text-blue-400 italic">No members found.</div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col bg-gradient-to-br from-white via-purple-50 to-pink-50 rounded-xl shadow-lg border-2 border-purple-200 overflow-hidden">
                
                {/* Header / Filters / Stats */}
                <div className="p-6 border-b-2 border-purple-200 bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 sticky top-0 z-20 shadow-md">
                    <div className="flex-1">
                        <h2 className="text-3xl font-bold text-white">💰 Development Fund</h2>
                        <p className="text-purple-100 text-sm mt-1">
                            {selectedMember 
                                ? `💎 Showing records for ${sanitizeString(selectedMember.name)}` 
                                : "📊 Viewing all contributions (Select a member to add)"}
                        </p>
                    </div>

                    <div className="bg-gradient-to-br from-yellow-300 to-orange-400 px-6 py-3 rounded-xl border-2 border-yellow-400 shadow-lg flex flex-col items-end min-w-[200px] transform hover:scale-105 transition">
                        <span className="text-xs font-bold uppercase text-white tracking-wider">💵 Total Collected</span>
                        <span className="text-2xl font-extrabold text-white">{formatCurrency(totalContributions, settings.currency)}</span>
                    </div>

                    <div className="flex gap-2 items-center bg-gradient-to-r from-white to-purple-100 p-3 rounded-lg border-2 border-purple-300 shadow-lg self-stretch xl:self-auto justify-center">
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border-2 border-purple-300 text-sm focus:ring-purple-400 focus:border-purple-400 text-slate-700 bg-white rounded px-2 py-1"/>
                        <span className="text-purple-600 font-bold">to</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border-2 border-purple-300 text-sm focus:ring-purple-400 focus:border-purple-400 text-slate-700 bg-white rounded px-2 py-1"/>
                        <div className="flex gap-1 ml-2">
                            {(['this-week','this-month','qtd','ytd','last-12m'] as const).map(p => (
                                <button key={p} type="button" onClick={() => applyPreset(p)} className={`px-2 py-1 rounded-md text-xs font-bold transition transform hover:scale-110 ${datePreset===p ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' : 'bg-white text-slate-700 border border-purple-300 hover:border-purple-600'}`}>{p.replace('-', ' ')}</button>
                            ))}
                        </div>
                        {selectedMember && (
                            <button type="button" onClick={() => { setHistoryScope('filtered'); setIsHistoryOpen(true); }} className="ml-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3 py-2 rounded-md">Member History</button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                    
                    {/* List of Contributions */}
                    <div className="flex-1 overflow-y-auto p-0 lg:border-r border-slate-200 relative">
                        {selectedMember && (
                            <div className="bg-indigo-50 border-b border-indigo-200 p-3 flex flex-wrap gap-2 items-end">
                                <div className="w-full">
                                    {hasDuplicate && (
                                        <div className="mb-2 bg-red-100 border-l-4 border-red-500 text-red-700 p-2 rounded text-sm">
                                            <strong>⚠️ Duplicate Entry:</strong> An entry already exists for this member on {newDate}
                                        </div>
                                    )}
                                    <label className="block text-xs font-bold uppercase text-indigo-800 mb-1 ml-1">Quick Add</label>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                                        <input type="date" value={newDate} onChange={e=>setNewDate(e.target.value)} className="border-slate-300 rounded-md p-2" />
                                        <input ref={quickAmountRef} type="number" step="0.01" value={newAmount} onChange={e=>setNewAmount(e.target.value)} placeholder="Amount" className="border-slate-300 rounded-md p-2" />
                                        <input type="text" value={newDesc} onChange={e=>setNewDesc(e.target.value)} placeholder="Description" className="border-slate-300 rounded-md p-2" />
                                        <button onClick={handleAddEntry} disabled={hasDuplicate} className={`font-bold px-4 rounded-md ${hasDuplicate ? 'bg-gray-400 text-gray-200 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>{hasDuplicate ? '⚠️ Duplicate' : 'Save'}</button>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="overflow-y-auto max-h-[55vh] border-t-2 border-purple-200">
                         <table className="w-full text-left text-slate-700">
                            <thead className="bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs uppercase font-bold sticky top-0 z-10 shadow-md">
                                <tr>
                                    <th className="px-4 py-3 cursor-pointer" onClick={() => setSortConfig(s => ({ key: 'date', direction: s.key==='date' && s.direction==='asc' ? 'desc' : 'asc' }))}>
                                        Date {sortConfig.key==='date' ? (sortConfig.direction==='asc' ? '▲' : '▼') : ''}
                                    </th>
                                    {!selectedMember && <th className="px-4 py-3">Member</th>}
                                    <th className="px-4 py-3">Class</th>
                                    <th className="px-4 py-3">Desc</th>
                                    <th className="px-4 py-3 text-right cursor-pointer" onClick={() => setSortConfig(s => ({ key: 'amount', direction: s.key==='amount' && s.direction==='asc' ? 'desc' : 'asc' }))}>
                                        Amount {sortConfig.key==='amount' ? (sortConfig.direction==='asc' ? '▲' : '▼') : ''}
                                    </th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-purple-100 text-sm">
                                {displayEntries.map((entry, idx) => (
                                    <tr key={entry.id} className={`transition ${idx % 2 === 0 ? 'bg-white hover:bg-purple-50' : 'bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100'}`}>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            {editingId===entry.id ? (
                                                <input type="date" value={editDate} onChange={e=>setEditDate(e.target.value)} className="border-slate-300 rounded-md p-1" />
                                            ) : entry.date}
                                        </td>
                                        {!selectedMember && (
                                            <td className="px-4 py-3 font-medium text-slate-800">{entry.memberName}</td>
                                        )}
                                        <td className="px-4 py-3 text-center">{entry.classNumber}</td>
                                        <td className="px-4 py-3 truncate max-w-[150px]">
                                            {editingId===entry.id ? (
                                                <input type="text" value={editDesc} onChange={e=>setEditDesc(e.target.value)} className="border-slate-300 rounded-md p-1 w-full" />
                                            ) : entry.description}
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-slate-800">
                                            {editingId===entry.id ? (
                                                <input type="number" step="0.01" value={editAmount} onChange={e=>setEditAmount(e.target.value)} className="border-slate-300 rounded-md p-1 w-28 text-right" />
                                            ) : formatCurrency(entry.amount, settings.currency)}
                                        </td>
                                        <td className="px-4 py-3 text-right flex gap-2 justify-end">
                                            {editingId===entry.id ? (
                                                <>
                                                    <button onClick={saveEdit} className="text-green-600 hover:text-green-800 font-bold px-2 py-1 rounded hover:bg-green-50">Save</button>
                                                    <button onClick={cancelEdit} className="text-slate-600 hover:text-slate-800 font-bold px-2 py-1 rounded hover:bg-slate-100">Cancel</button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => startEdit(entry.id, entry.date, entry.amount, entry.description)} className="text-indigo-600 hover:text-indigo-800 font-bold px-2 py-1 rounded hover:bg-indigo-50">Edit</button>
                                                    <button onClick={() => handleDelete(entry.id)} className="text-red-400 hover:text-red-600 font-bold px-2 py-1 rounded hover:bg-red-50">×</button>
                                                </>
                                            )}
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
                            <tfoot>
                                <tr className="bg-gradient-to-r from-purple-100 to-pink-100 border-t-2 border-purple-300 font-bold text-slate-700">
                                    <td className="px-4 py-3" colSpan={selectedMember ? 3 : 4}>
                                        <span className="text-xs font-bold uppercase text-purple-600">Visible:</span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-extrabold text-purple-700">{formatCurrency(displayEntries.reduce((s,e)=>s+e.amount,0), settings.currency)}</td>
                                    <td className="px-4 py-3 text-right text-purple-600">{displayEntries.length} entries</td>
                                </tr>
                            </tfoot>
                        </table>
                        </div>
                        {lastDeleted && (
                            <div className="fixed bottom-6 right-6 bg-gradient-to-r from-red-500 to-rose-600 text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 border-2 border-red-300">
                                <span className="font-bold">🗑️ Entry deleted.</span>
                                <button onClick={undoDelete} className="bg-white text-red-600 font-bold px-3 py-1 rounded-md hover:bg-red-100 transition">↩️ Undo</button>
                                <button onClick={()=>setLastDeleted(null)} className="text-red-200 hover:text-white transition font-bold">✕</button>
                            </div>
                        )}
                    </div>

                    {/* Add Entry Form (Only visible if member selected) */}
                    {selectedMember ? (
                        <div className="w-full lg:w-1/3 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-6 shadow-inner overflow-y-auto h-full border-t lg:border-t-0 border-2 border-green-200">
                            <h3 className="font-bold text-green-800 mb-4 border-b-2 border-green-300 pb-2 flex items-center gap-2 text-lg">
                                <span className="bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">+</span>
                                Add Contribution
                            </h3>
                            <div className="mb-6 bg-gradient-to-br from-white to-green-100 p-4 rounded-lg border-2 border-green-300 shadow-md">
                                <span className="text-xs font-bold text-green-600 uppercase tracking-wide">💎 Beneficiary</span>
                                <div className="font-bold text-xl bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mt-1">{sanitizeString(selectedMember.name)}</div>
                                <div className="text-sm font-medium text-slate-600 mt-1 flex gap-2">
                                    <span className="bg-gradient-to-r from-blue-400 to-cyan-400 text-white px-2 py-0.5 rounded font-bold">📚 Class {selectedMember.classNumber}</span>
                                    <span className="bg-gradient-to-r from-purple-400 to-pink-400 text-white px-2 py-0.5 rounded font-bold">🎫 ID: {selectedMember.memberNumber || 'N/A'}</span>
                                </div>
                            </div>
                            
                            <form onSubmit={handleAddEntry} onKeyDown={handleKeyDown} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-bold text-green-700 mb-1">📅 Date</label>
                                    <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} required className="w-full border-2 border-green-300 rounded-lg shadow-sm py-2 px-3 focus:ring-green-400 focus:border-green-400 font-medium" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-green-700 mb-1">💰 Amount</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <span className="text-green-600 font-bold text-lg">$</span>
                                        </div>
                                        <input type="number" step="0.01" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="0.00" required className="w-full pl-8 border-2 border-green-300 rounded-lg shadow-sm font-bold text-xl py-2 focus:ring-green-400 focus:border-green-400 bg-white text-green-700" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-green-700 mb-1">📝 Description (Optional)</label>
                                    <textarea rows={3} value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="e.g. Monthly pledge" className="w-full border-2 border-green-300 rounded-lg shadow-sm py-2 px-3 focus:ring-green-400 focus:border-green-400" />
                                </div>
                                <button type="submit" disabled={hasDuplicate} className={`w-full font-bold py-3.5 rounded-lg shadow-lg transition-all active:scale-95 text-lg ${hasDuplicate ? 'bg-gray-400 text-gray-200 cursor-not-allowed opacity-60' : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white hover:scale-[1.02]'}`}>
                                    {hasDuplicate ? '⚠️ Duplicate on this date' : '✓ Save Contribution'}
                                </button>
                                <p className="text-center text-xs text-green-600 font-medium">Press Ctrl+Enter to save</p>
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

            {isHistoryOpen && selectedMember && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 pt-16" onClick={() => setIsHistoryOpen(false)}>
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">Contribution History: {sanitizeString(selectedMember.name)}</h3>
                                <p className="text-slate-500 text-sm">Scope: {historyScope === 'filtered' ? 'Filtered (date range)' : 'All time'}</p>
                            </div>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setHistoryScope('filtered')} className={`px-3 py-1 rounded-md text-sm font-bold ${historyScope==='filtered' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>Filtered</button>
                                <button type="button" onClick={() => setHistoryScope('all')} className={`px-3 py-1 rounded-md text-sm font-bold ${historyScope==='all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>All Time</button>
                            </div>
                        </div>
                        <div className="p-6 max-h-[60vh] overflow-y-auto">
                            {selectedMemberEntries.length > 0 ? (
                                <table className="w-full text-left text-slate-600">
                                    <thead className="bg-slate-100 text-slate-700 text-xs uppercase font-bold sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3">Date</th>
                                            <th className="px-4 py-3">Description</th>
                                            <th className="px-4 py-3 text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-sm">
                                        {selectedMemberEntries.map(e => (
                                            <tr key={e.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-3 whitespace-nowrap">{e.date}</td>
                                                <td className="px-4 py-3 truncate">{(e as any).note || ''}</td>
                                                <td className="px-4 py-3 text-right font-bold">{formatCurrency(e.amount, settings.currency)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="text-center text-slate-400 p-12">No contributions found for chosen scope.</div>
                            )}
                        </div>
                        <div className="p-4 bg-slate-50 rounded-b-xl flex justify-between items-center">
                            <div className="text-sm text-slate-600 font-bold">
                                Total: {formatCurrency(selectedMemberEntries.reduce((s,e)=>s+e.amount,0), settings.currency)} • {selectedMemberEntries.length} entries
                            </div>
                            <div className="flex gap-2">
                                <button type="button" onClick={exportMemberCsv} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg">Export CSV</button>
                                <button type="button" onClick={() => setIsHistoryOpen(false)} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg">Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DevelopmentFund;
