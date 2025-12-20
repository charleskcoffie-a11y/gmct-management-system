import React, { useState, useMemo } from 'react';
import { useToast } from './ToastProvider';
import type { HarvestEntry, Member, Settings } from '../types';
import { formatCurrency } from '../utils';

interface HarvestProps {
    members: Member[];
    entries: HarvestEntry[];
    setEntries: React.Dispatch<React.SetStateAction<HarvestEntry[]>>;
    settings: Settings;
    currentUser?: { name: string; role: string } | null;
}

const Harvest: React.FC<HarvestProps> = ({ members, entries, setEntries, settings, currentUser }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<HarvestEntry | null>(null);
    const [selectedDateForModal, setSelectedDateForModal] = useState<string | null>(null);
    const [modalClassFilter, setModalClassFilter] = useState<string>('all');
    
    // Filters
    const [startDateFilter, setStartDateFilter] = useState(new Date().toISOString().split('T')[0]);
    const [endDateFilter, setEndDateFilter] = useState(new Date().toISOString().split('T')[0]);
    const [classFilter, setClassFilter] = useState('all');
    const [searchFilter, setSearchFilter] = useState('');
    const [showDeleted, setShowDeleted] = useState(false);

    // Form state
    const [formData, setFormData] = useState<HarvestEntry>({
        id: '',
        date: new Date().toISOString().split('T')[0],
        memberID: '',
        memberName: '',
        classNumber: '',
        amount: 0,
        note: '',
        createdAt: new Date().toISOString()
    });
    const [amountInput, setAmountInput] = useState('');
    const [memberNumberInput, setMemberNumberInput] = useState('');

    const membersMap = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);

    // Filtered entries
    const filteredEntries = useMemo(() => {
        return entries.filter(entry => {
            if (entry.deleted && !showDeleted) return false;
            if (searchFilter && !entry.memberName.toLowerCase().includes(searchFilter.toLowerCase())) return false;
            if (startDateFilter && entry.date < startDateFilter) return false;
            if (endDateFilter && entry.date > endDateFilter) return false;
            
            const member = membersMap.get(entry.memberID);
            const entryClass = entry.classNumber || member?.classNumber;
            if (classFilter !== 'all' && entryClass !== classFilter) return false;
            return true;
        }).sort((a, b) => b.date.localeCompare(a.date));
    }, [entries, searchFilter, classFilter, startDateFilter, endDateFilter, showDeleted, membersMap]);

    // Group by date
    const entriesByDate = useMemo(() => {
        const groups: Record<string, HarvestEntry[]> = {};
        filteredEntries.forEach(entry => {
            if (!groups[entry.date]) {
                groups[entry.date] = [];
            }
            groups[entry.date].push(entry);
        });
        return groups;
    }, [filteredEntries]);

    const sortedDates = useMemo(() => {
        return Object.keys(entriesByDate).sort((a, b) => b.localeCompare(a));
    }, [entriesByDate]);

    // Summary
    const summary = useMemo(() => {
        const activeEntries = filteredEntries.filter(e => !e.deleted);
        return {
            total: activeEntries.reduce((sum, e) => sum + e.amount, 0),
            count: activeEntries.length
        };
    }, [filteredEntries]);

    const handleOpenModal = (entry: HarvestEntry | null = null) => {
        if (entry) {
            setFormData(entry);
            setAmountInput(String(entry.amount));
            const member = members.find(m => m.id === entry.memberID);
            setMemberNumberInput(member?.memberNumber || '');
        } else {
            setFormData({
                id: crypto.randomUUID(),
                date: new Date().toISOString().split('T')[0],
                memberID: '',
                memberName: '',
                classNumber: '',
                amount: 0,
                note: '',
                createdBy: currentUser?.name,
                createdAt: new Date().toISOString()
            });
            setAmountInput('');
            setMemberNumberInput('');
        }
        setSelectedEntry(entry);
        setIsModalOpen(true);
    };

    const { showToast, showConfirm } = useToast();
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.memberID || formData.amount <= 0) {
            showToast('Please select a member and enter a valid amount', 'warning');
            return;
        }

        if (selectedEntry) {
            setEntries(prev => prev.map(entry => 
                entry.id === selectedEntry.id 
                    ? { ...formData, updatedBy: currentUser?.name, lastUpdated: new Date().toISOString() }
                    : entry
            ));
        } else {
            setEntries(prev => [...prev, formData]);
        }
        setIsModalOpen(false);
    };

    const handleDelete = (id: string) => {
        showConfirm('Are you sure you want to delete this harvest entry?', () => {
            setEntries(prev => prev.map(e => e.id === id ? { ...e, deleted: true, updatedBy: currentUser?.name, lastUpdated: new Date().toISOString() } : e));
            setIsModalOpen(false);
        });
    };

    const handleMemberNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newNumber = e.target.value;
        setMemberNumberInput(newNumber);
        
        const matchedMember = members.find(m => m.memberNumber && m.memberNumber.toLowerCase() === newNumber.toLowerCase());
        if (matchedMember) {
            setFormData(prev => ({
                ...prev,
                memberID: matchedMember.id,
                memberName: matchedMember.name,
                classNumber: matchedMember.classNumber || '',
            }));
        } else {
            setFormData(prev => ({ ...prev, memberID: '', memberName: '', classNumber: '' }));
        }
    };

    const handleMemberNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newName = e.target.value;
        const matchedMember = members.find(m => m.name.toLowerCase() === newName.toLowerCase());

        if (matchedMember) {
            setFormData(prev => ({
                ...prev,
                memberID: matchedMember.id,
                memberName: matchedMember.name,
                classNumber: matchedMember.classNumber || '',
            }));
            setMemberNumberInput(matchedMember.memberNumber || '');
        } else {
            setFormData(prev => ({ ...prev, memberName: newName }));
        }
    };

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
            setAmountInput(value);
            setFormData(prev => ({ ...prev, amount: parseFloat(value) || 0 }));
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-br from-slate-50 to-amber-50 p-8 rounded-2xl shadow-lg border-2 border-slate-200">
                <div className="flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-4 mb-3">
                            <div className="bg-gradient-to-br from-amber-400 to-orange-400 p-4 rounded-xl shadow-md">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-3xl font-bold text-slate-800">Harvest Contributions</h2>
                                <p className="text-base text-slate-500 mt-1 font-medium">Track harvest thanksgiving and contributions</p>
                            </div>
                        </div>
                    </div>
                    {currentUser?.role !== 'pastor' && (
                        <button onClick={() => handleOpenModal()} className="bg-gradient-to-br from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white font-bold py-4 px-8 rounded-xl shadow-lg transition-all hover:scale-105 text-base flex items-center gap-3 group">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 group-hover:rotate-90 transition-transform" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                            </svg>
                            Record Harvest
                        </button>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 p-6 rounded-xl shadow-lg border-2 border-amber-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 items-end">
                <div className="lg:col-span-1">
                    <label className="block text-sm font-bold uppercase text-amber-600 mb-1">🔍 Search Member</label>
                    <input type="text" placeholder="Name..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)} className="block w-full border-2 border-amber-200 rounded-lg shadow-sm py-3 focus:ring-amber-300 focus:border-amber-300 font-medium"/>
                </div>
                <div className="lg:col-span-1">
                    <label className="block text-sm font-bold uppercase text-amber-600 mb-1">📚 Class</label>
                    <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="block w-full border-2 border-amber-200 rounded-lg shadow-sm py-3 focus:ring-amber-300 focus:border-amber-300 font-medium">
                        <option value="all">All Classes</option>
                        {Array.from({ length: settings.maxClasses }, (_, i) => String(i + 1)).map(num => (<option key={num} value={num}>Class {num}</option>))}
                    </select>
                </div>
                <div className="lg:col-span-3 grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold uppercase text-amber-600 mb-1">📅 Start Date</label>
                        <input type="date" value={startDateFilter} onChange={e => setStartDateFilter(e.target.value)} className="block w-full border-2 border-amber-200 rounded-lg shadow-sm py-3 focus:ring-amber-300 focus:border-amber-300 font-medium"/>
                    </div>
                    <div>
                        <label className="block text-sm font-bold uppercase text-amber-600 mb-1">📅 End Date</label>
                        <input type="date" value={endDateFilter} onChange={e => setEndDateFilter(e.target.value)} className="block w-full border-2 border-amber-200 rounded-lg shadow-sm py-3 focus:ring-amber-300 focus:border-amber-300 font-medium"/>
                    </div>
                </div>
            </div>

            {/* Summary */}
            {summary.total > 0 && (
                <div className="bg-gradient-to-br from-amber-300 to-orange-400 p-6 rounded-xl shadow-lg border-2 border-amber-200 flex flex-col justify-center">
                    <h3 className="text-white font-bold text-sm uppercase tracking-wider">🌾 Harvest Total</h3>
                    <p className="text-4xl font-bold text-white mt-2 drop-shadow">{formatCurrency(summary.total, settings.currency)}</p>
                    <p className="text-amber-50 text-sm mt-1 font-semibold">{summary.count} contribution{summary.count !== 1 ? 's' : ''}</p>
                </div>
            )}

            {/* Grouped List */}
            <div className="bg-white rounded-xl shadow-lg border-2 border-slate-200 overflow-hidden">
                {(currentUser?.role === 'admin' || currentUser?.role === 'finance-chair') && (
                    <div className="bg-gradient-to-r from-red-100 to-pink-100 px-4 py-2 border-b-2 border-red-300 flex justify-end">
                        <label className="flex items-center gap-2 text-xs font-bold uppercase text-red-700 cursor-pointer">
                            <input type="checkbox" checked={showDeleted} onChange={e => setShowDeleted(e.target.checked)} className="rounded border-red-300 text-red-600 focus:ring-red-500"/>
                            🗑️ Show Deleted Records
                        </label>
                    </div>
                )}
                <div className="max-h-[60vh] overflow-y-auto p-6 space-y-4">
                    {sortedDates.length === 0 ? (
                        <div className="text-center py-16 text-slate-400">
                            <div className="text-6xl mb-4">📭</div>
                            <p className="text-xl font-bold">No harvest records found</p>
                            <p className="text-sm mt-2">Try adjusting your filters</p>
                        </div>
                    ) : (
                        sortedDates.map(date => {
                            const dateEntries = entriesByDate[date];
                            const dateTotal = dateEntries.reduce((sum, e) => sum + e.amount, 0);
                            const hasDeleted = dateEntries.some(e => e.deleted);
                            
                            return (
                                <div key={date} className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border-2 border-amber-200 shadow-md hover:shadow-lg transition-all overflow-hidden">
                                    <button 
                                        onClick={() => {
                                            setSelectedDateForModal(date);
                                            setModalClassFilter('all');
                                        }}
                                        className="w-full p-5 flex items-center justify-between hover:bg-amber-100 transition-colors text-left"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="bg-gradient-to-br from-amber-500 to-orange-500 text-white rounded-xl p-4 shadow-md">
                                                <div className="text-xs font-bold uppercase">{new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}</div>
                                                <div className="text-2xl font-bold">{new Date(date + 'T00:00:00').getDate()}</div>
                                                <div className="text-xs">{new Date(date + 'T00:00:00').getFullYear()}</div>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-3">
                                                    <h3 className="text-xl font-bold text-slate-800">{new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
                                                    {hasDeleted && <span className="text-xs bg-red-200 text-red-800 px-2 py-1 rounded-full font-bold">Has Deleted</span>}
                                                </div>
                                                <p className="text-sm text-slate-600 mt-1 font-medium">{dateEntries.length} contribution{dateEntries.length !== 1 ? 's' : ''}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-bold text-green-600">{formatCurrency(dateTotal, settings.currency)}</div>
                                            <div className="text-sm text-amber-500 font-semibold mt-1 flex items-center gap-1">
                                                Click to view details
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Date Details Modal */}
            {selectedDateForModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-center items-center p-4" onClick={() => setSelectedDateForModal(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col border-2 border-slate-200" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 rounded-t-2xl text-white">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className="text-2xl font-bold">{new Date(selectedDateForModal + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h2>
                                    <p className="text-amber-100 mt-1">{entriesByDate[selectedDateForModal].length} contribution{entriesByDate[selectedDateForModal].length !== 1 ? 's' : ''} • Total: {formatCurrency(entriesByDate[selectedDateForModal].reduce((sum, e) => sum + e.amount, 0), settings.currency)}</p>
                                </div>
                                <button onClick={() => setSelectedDateForModal(null)} className="text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-lg text-2xl font-bold transition-all">×</button>
                            </div>
                            
                            <div className="flex items-center gap-3">
                                <label className="text-sm font-bold text-amber-50">Filter by Class:</label>
                                <select 
                                    value={modalClassFilter} 
                                    onChange={e => setModalClassFilter(e.target.value)}
                                    className="border-2 border-amber-300 bg-white/95 text-slate-800 rounded-lg px-4 py-2 font-semibold focus:ring-2 focus:ring-white focus:border-white transition-all"
                                >
                                    <option value="all">All Classes</option>
                                    {Array.from({ length: settings.maxClasses }, (_, i) => String(i + 1)).map(num => (
                                        <option key={num} value={num}>Class {num}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="space-y-3">
                                {entriesByDate[selectedDateForModal]
                                    .filter(entry => {
                                        if (modalClassFilter === 'all') return true;
                                        const member = membersMap.get(entry.memberID);
                                        const entryClass = entry.classNumber || member?.classNumber;
                                        return entryClass === modalClassFilter;
                                    })
                                    .map((entry) => {
                                    const member = membersMap.get(entry.memberID);
                                    const displayClass = entry.classNumber || member?.classNumber || '-';
                                    const canEdit = !entry.deleted && currentUser?.role !== 'pastor';
                                    
                                    return (
                                        <div key={entry.id} className={`rounded-xl border-2 p-5 transition-all ${entry.deleted ? 'bg-red-50 border-red-200' : 'bg-gradient-to-r from-slate-50 to-amber-50 border-slate-200 hover:shadow-md'}`}>
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <h3 className="text-lg font-bold text-slate-800">{entry.memberName}</h3>
                                                        {entry.deleted && <span className="text-xs bg-red-200 text-red-800 px-2 py-1 rounded-full font-bold">DELETED</span>}
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                                        <div>
                                                            <span className="text-slate-500 font-medium">Member #:</span>
                                                            <span className="ml-1 font-bold text-slate-700">{member?.memberNumber || '-'}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-500 font-medium">Class:</span>
                                                            <span className="ml-1 font-bold text-slate-700">{displayClass}</span>
                                                        </div>
                                                    </div>
                                                    {entry.note && (
                                                        <div className="mt-2 text-sm text-slate-600 italic">
                                                            <span className="font-medium">Note:</span> {entry.note}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-right ml-4">
                                                    <div className="text-2xl font-bold text-green-600">{formatCurrency(entry.amount, settings.currency)}</div>
                                                    {canEdit && (
                                                        <button 
                                                            onClick={() => { 
                                                                handleOpenModal(entry);
                                                                setSelectedDateForModal(null);
                                                            }} 
                                                            className="mt-2 text-amber-600 hover:text-amber-800 font-bold text-sm hover:underline"
                                                        >
                                                            Edit
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        
                        <div className="p-6 bg-slate-50 rounded-b-2xl border-t-2 border-slate-200 flex justify-between items-center">
                            <div className="text-sm text-slate-600">
                                <span className="font-bold">Total for this date:</span> {formatCurrency(entriesByDate[selectedDateForModal].reduce((sum, e) => sum + e.amount, 0), settings.currency)}
                            </div>
                            <button onClick={() => setSelectedDateForModal(null)} className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-lg transition-all">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Entry Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-center items-center p-4" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl relative border-2 border-slate-200" onClick={e => e.stopPropagation()}>
                        <form onSubmit={handleSubmit}>
                            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-8 rounded-t-2xl text-white">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-white/20 backdrop-blur p-3 rounded-xl">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold">{selectedEntry ? 'Edit Harvest' : 'Record Harvest'}</h2>
                                        </div>
                                    </div>
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-lg text-2xl font-bold transition-all">×</button>
                                </div>
                            </div>
                            
                            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto bg-gradient-to-br from-slate-50 to-amber-50">
                                <div className="bg-white rounded-xl p-5 shadow-md border-2 border-amber-100">
                                    <label className="block text-xs font-bold text-amber-600 uppercase mb-3 flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                                        </svg>
                                        Member Information
                                    </label>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div className="md:col-span-1">
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Member #</label>
                                            <input value={memberNumberInput} onChange={handleMemberNumberChange} placeholder="128" className="w-full border-2 border-slate-300 rounded-lg p-3 font-bold text-amber-700 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all" />
                                        </div>
                                        <div className="md:col-span-3">
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name</label>
                                            <input list="members-list" value={formData.memberName} onChange={handleMemberNameChange} placeholder="Search by first or last name..." className="w-full border-2 border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all" />
                                            <datalist id="members-list">
                                                {members.map(m => <option key={m.id} value={m.name} />)}
                                            </datalist>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="bg-white rounded-xl p-5 shadow-md border-2 border-purple-100">
                                        <label className="block text-xs font-bold text-purple-600 uppercase mb-3 flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                                            </svg>
                                            Date
                                        </label>
                                        <input type="date" value={formData.date} onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))} className="w-full border-2 border-slate-300 rounded-lg p-3 text-slate-700 font-semibold focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all" />
                                    </div>
                                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 shadow-md border-2 border-green-200">
                                        <label className="block text-xs font-bold text-green-600 uppercase mb-3 flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                                            </svg>
                                            Amount
                                        </label>
                                        <input inputMode="decimal" value={amountInput} onChange={handleAmountChange} placeholder="0.00" className="w-full border-2 border-green-300 rounded-lg p-3 font-bold text-2xl text-right text-green-700 focus:ring-2 focus:ring-green-400 focus:border-green-400 transition-all bg-white" />
                                    </div>
                                </div>
                                
                                <div className="bg-white rounded-xl p-5 shadow-md border-2 border-slate-200">
                                    <label className="block text-xs font-bold text-slate-600 uppercase mb-3 flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
                                        </svg>
                                        Note (Optional)
                                    </label>
                                    <input value={formData.note || ''} onChange={e => setFormData(prev => ({ ...prev, note: e.target.value }))} placeholder="Add any additional details..." className="w-full border-2 border-slate-300 rounded-lg p-3 text-slate-700 focus:ring-2 focus:ring-slate-400 focus:border-slate-400 transition-all" />
                                </div>
                            </div>

                            <div className="p-6 bg-gradient-to-r from-slate-100 to-slate-50 rounded-b-2xl flex justify-between items-center border-t-2 border-slate-200">
                                {selectedEntry ? (
                                    <button type="button" onClick={() => handleDelete(selectedEntry.id)} className="text-red-600 font-bold hover:bg-red-50 px-4 py-2 rounded-lg transition-all flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        Delete Entry
                                    </button>
                                ) : <div></div>}
                                
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="bg-white border-2 border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-3 px-6 rounded-lg transition-all">Cancel</button>
                                    <button type="submit" className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-md hover:scale-105">Save</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Harvest;
