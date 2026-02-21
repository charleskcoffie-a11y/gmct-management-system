// components/EntryModal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from './ToastProvider';
import type { Entry, EntryType, Method, Member, Settings, User, MonthLock } from '../types';
import { sanitizeEntry, isMonthLocked, getNowEST, isEntryWindowOpen, isWeekdayEST, formatMethod } from '../utils';
import { logEntryDeletionToSupabase, markEntryAsDeletedInSupabase } from '../services/supabase';

interface EntryModalProps {
    entry: Entry | null;
    existingEntries: Entry[];
    members: Member[];
    settings: Settings;
    currentUser?: User | null;
    monthLocks?: MonthLock[];
    onSave: (entry: Entry) => void | Promise<void>;
    onSaveAndNew: (entry: Entry) => void | Promise<void>;
    onClose: () => void;
    onDelete: (id: string) => void;
    lockedType?: boolean;
    selectedDay?: string;
}

const ENTRY_TYPES: EntryType[] = ["tithe", "offering", "thanksgiving-offering", "pledge", "harvest-levy", "day-born", "covenant", "childrens-ministry", "other"];

const EntryModal: React.FC<EntryModalProps> = ({ entry, existingEntries, members, settings, currentUser, monthLocks = [], onSave, onSaveAndNew, onClose, onDelete, lockedType = false, selectedDay }) => {
    const [formData, setFormData] = useState<Entry>(entry || sanitizeEntry({}));
    const [amountInput, setAmountInput] = useState<string>('');
    const [classFilter, setClassFilter] = useState('all');
    const [memberNumberInput, setMemberNumberInput] = useState('');
    const [showSuccessToast, setShowSuccessToast] = useState(false);
    const [duplicateWarning, setDuplicateWarning] = useState<{ show: boolean; type: string } | null>(null);

    // Delete modal state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteReason, setDeleteReason] = useState('');
    const [deleteError, setDeleteError] = useState('');
    const [deletionLog, setDeletionLog] = useState<{id: string, reason: string, deletedBy: string, deletedAt: string}[]>([]);

    useEffect(() => {
        const initialData = entry || sanitizeEntry({});
        setFormData(initialData);
        setAmountInput(entry ? String(entry.amount) : '');

        if (entry && entry.memberID) {
            const member = members.find(m => m.id === entry.memberID);
            setMemberNumberInput(member?.memberNumber || '');
        }
    }, [entry, members]);

    const classFilteredMembers = useMemo(() => {
        if (classFilter === 'all') return members;
        return members.filter(m => m.classNumber === classFilter);
    }, [members, classFilter]);

    const searchFilteredMembers = useMemo(() => {
        const numSearch = memberNumberInput.toLowerCase().trim();
        const nameSearch = formData.memberName.toLowerCase().trim();

        const isMemberSelected = classFilteredMembers.some(m => m.id === formData.memberID && m.name === formData.memberName);
        if (isMemberSelected) return classFilteredMembers;

        if (numSearch.length > 0) {
            return classFilteredMembers.filter(m => m.memberNumber && m.memberNumber.toLowerCase().startsWith(numSearch));
        }
        if (nameSearch.length > 0) {
            return classFilteredMembers.filter(m => m.name.toLowerCase().includes(nameSearch));
        }
        return classFilteredMembers;
    }, [formData.memberID, formData.memberName, memberNumberInput, classFilteredMembers]);

    const hasDuplicate = useMemo(() => {
        return existingEntries.some(e =>
            e.id !== formData.id &&
            !e.deleted &&
            e.date === formData.date &&
            e.memberID === formData.memberID &&
            e.type === formData.type
        );
    }, [existingEntries, formData.id, formData.date, formData.memberID, formData.type]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
            setAmountInput(value);
            setFormData(prev => ({ ...prev, amount: parseFloat(value) || 0 }));
        }
    };

    const handleMemberNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newNumber = e.target.value;
        setMemberNumberInput(newNumber);
        setFormData(prev => ({ ...prev, memberID: '', memberName: '', classNumber: '' }));

        const matchedMember = members.find(m => m.memberNumber && m.memberNumber.toLowerCase() === newNumber.toLowerCase());
        if (matchedMember) {
            setFormData(prev => ({
                ...prev,
                memberID: matchedMember.id,
                memberName: matchedMember.name,
                classNumber: matchedMember.classNumber || ''
            }));
        }
    };

    const handleMemberNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newName = e.target.value;
        const matchedMember = members.find(m => m.name.toLowerCase() === newName.toLowerCase());

        if (matchedMember) {
            setFormData(prev => ({
                ...prev,
                memberName: matchedMember.name,
                memberID: matchedMember.id,
                classNumber: matchedMember.classNumber || ''
            }));
            if (matchedMember.memberNumber) {
                setMemberNumberInput(matchedMember.memberNumber);
            }
        } else {
            setFormData(prev => ({ ...prev, memberName: newName, memberID: '', classNumber: '' }));
        }
    };

    const handleKeyDown = async (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (hasDuplicate) {
                const typeDisplay = formData.type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                setDuplicateWarning({ show: true, type: typeDisplay });
                return;
            }
            await handleSubmitAndNew(e as any);
        }
    };

    const { showToast, showConfirm } = useToast();
    const validateAndSubmit = async (callback: (e: Entry) => void | Promise<void>) => {
        if (hasDuplicate) {
            const typeDisplay = formData.type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            setDuplicateWarning({ show: true, type: typeDisplay });
            return false;
        }
        if (!formData.memberID && settings.enforceDirectory) {
            showToast('Please select a valid member from the directory.', 'warning');
            return false;
        }
        if (formData.amount <= 0) {
            showToast('Amount must be greater than zero.', 'warning');
            return false;
        }
        if (new Date(formData.date) > new Date()) {
            let proceed = false;
            await new Promise<void>((resolve) => {
                showConfirm('You are entering a date in the future. Is this correct?', () => { proceed = true; resolve(); }, () => { resolve(); });
            });
            if (!proceed) return false;
        }

        // Only certain roles can add financial entries
        const allowedRolesForEntries = ['admin', 'finance-chair', 'finance-team', 'data-entry'] as const;
        if (!currentUser || !allowedRolesForEntries.includes(currentUser.role as any)) {
            showToast('Your role is limited. Only Admin, Finance Chair, Finance Team, and Data Entry can record financial entries. Statistician accounts can only add Weekly History.', 'error');
            return false;
        }

        const canOverrideLock = currentUser?.role === 'admin' || currentUser?.role === 'finance-chair' || currentUser?.role === 'finance-team';
        
        // Special exception for contractor "Okyere CPA" - Monday to Friday only
        if (currentUser?.username === 'Okyere CPA' && currentUser?.role === 'finance-team') {
            const weekdayCheck = isWeekdayEST();
            if (!weekdayCheck.isWeekday) {
                showToast(`Special restriction for contractors: ${weekdayCheck.reason}`, 'error');
                return false;
            }
        }
        
        // Data Entry role: NEVER allowed to edit, only create new entries
        if (entry && currentUser?.role === 'data-entry') {
            showToast('Data Entry staff cannot edit entries. Only Admin, Finance Chair, and Finance Team can edit. You can only create new entries.', 'error');
            return false;
        }

        // Check entry window restriction - applies to all except Admin & Finance Chair
        const entryWindowStatus = isEntryWindowOpen(settings.entryWindow);
        if (!entryWindowStatus.isOpen && currentUser?.role !== 'admin' && currentUser?.role !== 'finance-chair') {
            showToast(`${entryWindowStatus.reason}\n${entryWindowStatus.nextOpenTime}`, 'error');
            return false;
        }

        // EDIT operations: block outside window for everyone except admin/chair
        if (entry && !entryWindowStatus.isOpen && currentUser?.role !== 'admin' && currentUser?.role !== 'finance-chair') {
            showToast(`Editing is not allowed outside the entry window.\n${entryWindowStatus.reason}\n${entryWindowStatus.nextOpenTime}`, 'error');
            return false;
        }

        // If Admin or Finance Chair overrides entry window, log it
        if (!entryWindowStatus.isOpen && (currentUser?.role === 'admin' || currentUser?.role === 'finance-chair')) {
            const actor = (currentUser?.role || 'admin').toUpperCase();
            const actionType = entry ? 'EDIT' : 'CREATE';
            const overrideNote = `[OVERRIDE (${actor}) - ${actionType} outside entry window] ${formData.note || ''}`;
            formData.note = overrideNote.trim();
        }

        if (isMonthLocked(formData.date, monthLocks) && !canOverrideLock) {
            showToast(`The financial month for ${formData.date} is LOCKED. You cannot add or edit entries for this period.`, 'error');
            return false;
        }

        const now = getNowEST();
        const entryToSave = {
            ...formData,
            updatedBy: currentUser?.username || 'Unknown',
            lastUpdated: now,
            createdBy: formData.createdBy || currentUser?.username || 'Unknown'
        };

        try {
            await callback(entryToSave);
            setShowSuccessToast(true);
            setTimeout(() => setShowSuccessToast(false), 3000);
            return true;
        } catch (error: any) {
            showToast(error.message || 'Failed to save entry', 'error');
            return false;
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await validateAndSubmit(onSave);
    };

    const handleSubmitAndNew = async (e: React.FormEvent) => {
        e.preventDefault();
        const success = await validateAndSubmit(async entryToSave => {
            await onSaveAndNew(entryToSave);
        });
        if (success) {
            setFormData(prev => sanitizeEntry({ date: prev.date }));
            setAmountInput('');
            setMemberNumberInput('');
        }
    };

    return (
        <>
            {duplicateWarning?.show && (
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
                                A <span className="font-bold text-red-600">{duplicateWarning.type}</span> contribution already exists for this member on <span className="font-bold">{formData.date}</span>.
                            </p>
                            <p className="text-sm text-slate-600 bg-amber-50 border-l-4 border-amber-400 p-3 rounded">
                                Tip: Please edit the existing record or choose a different date/type.
                            </p>
                        </div>
                        <div className="p-6 bg-slate-50 rounded-b-2xl flex justify-end">
                            <button
                                onClick={() => setDuplicateWarning(null)}
                                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold py-3 px-8 rounded-lg transition-all shadow-md hover:scale-105"
                            >
                                Got It
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-center items-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl relative border-2 border-slate-200">
                    {showSuccessToast && (
                        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-8 py-3 rounded-full shadow-lg font-bold animate-fadeIn z-50 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Contribution Recorded
                        </div>
                    )}

                    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
                        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-8 rounded-t-2xl text-white">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="bg-white/20 backdrop-blur p-3 rounded-xl">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold">{entry ? 'Edit Contribution' : 'Record Contribution'}</h2>
                                        <p className="text-sm text-blue-100 mt-1">
                                            {selectedDay ? `📅 ${selectedDay} - Day Born Offering` : 'Press Enter to Save & Add Another'}
                                        </p>
                                    </div>
                                </div>
                                <button type="button" onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-lg text-2xl font-bold transition-all">×</button>
                            </div>
                        </div>

                        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto bg-gradient-to-br from-slate-50 to-blue-50">
                            <div className="bg-white rounded-xl p-5 shadow-md border-2 border-blue-100">
                                <label className="block text-xs font-bold text-blue-600 uppercase mb-3 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                                    </svg>
                                    Member Information
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="md:col-span-1">
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Member #</label>
                                        <input name="memberNumber" value={memberNumberInput} onChange={handleMemberNumberChange} placeholder="128" className="w-full border-2 border-slate-300 rounded-lg p-3 font-bold text-blue-700 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all" />
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name</label>
                                        <input 
                                            name="memberName" 
                                            list="members-list" 
                                            value={formData.memberName} 
                                            onChange={handleMemberNameChange} 
                                            placeholder="Search member name..." 
                                            className="w-full border-2 border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all" 
                                            title={`Created by: ${entry?.createdBy || 'Unknown'}\nUpdated by: ${entry?.updatedBy || 'Unknown'}`}
                                        />
                                        <datalist id="members-list">
                                            {searchFilteredMembers.slice(0, 10).map(m => <option key={m.id} value={m.name} />)}
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
                                    <input type="date" name="date" value={formData.date} onChange={handleChange} className="w-full border-2 border-slate-300 rounded-lg p-3 text-slate-700 font-semibold focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all" />
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

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="bg-white rounded-xl p-5 shadow-md border-2 border-amber-100">
                                    <label className="block text-xs font-bold text-amber-600 uppercase mb-3 flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                                        </svg>
                                        Type
                                    </label>
                                    <select name="type" value={formData.type} onChange={handleChange} disabled={lockedType} className={`w-full border-2 rounded-lg p-3 capitalize font-semibold transition-all ${
                                        lockedType
                                            ? 'border-slate-300 bg-slate-100 text-slate-500 cursor-not-allowed'
                                            : 'border-slate-300 text-slate-700 focus:ring-2 focus:ring-amber-400 focus:border-amber-400'
                                    }`}>
                                        {ENTRY_TYPES.map(t => (
                                            <option key={t} value={t}>
                                                {t.replace(/-/g, ' ')}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="bg-white rounded-xl p-5 shadow-md border-2 border-indigo-100">
                                    <label className="block text-xs font-bold text-indigo-600 uppercase mb-3 flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                                            <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                                        </svg>
                                        Payment Method
                                    </label>
                                    <select name="method" value={formData.method} onChange={handleChange} className="w-full border-2 border-slate-300 rounded-lg p-3 capitalize font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-all">
                                        {["cash", "check", "card", "e-transfer", "mobile", "other"].map(m => (
                                            <option key={m} value={m as Method}>
                                                {formatMethod(m)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl p-5 shadow-md border-2 border-slate-200">
                                <label className="block text-xs font-bold text-slate-600 uppercase mb-3 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
                                    </svg>
                                    {formData.type === 'harvest-levy' ? 'Group (Optional)' : 'Note (Optional)'}
                                </label>
                                {formData.type === 'harvest-levy' ? (
                                    (() => {
                                        const baseOptions = ['Men','Women','Youth','Dayborn Special'];
                                        const current = formData.note || '';
                                        const includesCurrent = current && baseOptions.includes(current);
                                        const options = includesCurrent ? baseOptions : (current ? [current, ...baseOptions] : baseOptions);
                                        return (
                                            <select
                                                name="note"
                                                value={current}
                                                onChange={handleChange}
                                                className="w-full border-2 border-slate-300 rounded-lg p-3 text-slate-700 font-semibold focus:ring-2 focus:ring-slate-400 focus:border-slate-400 transition-all bg-white"
                                            >
                                                <option value="">None</option>
                                                {options.map(opt => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        );
                                    })()
                                ) : (
                                    <input name="note" value={formData.note || ''} onChange={handleChange} placeholder="Add any additional details..." className="w-full border-2 border-slate-300 rounded-lg p-3 text-slate-700 focus:ring-2 focus:ring-slate-400 focus:border-slate-400 transition-all" />
                                )}
                            </div>
                        </div>

                        <div className="p-6 bg-gradient-to-r from-slate-100 to-slate-50 rounded-b-2xl flex justify-between items-center border-t-2 border-slate-200">
                            <div className="flex flex-col text-xs text-slate-500">
                                {entry && (
                                    <>
                                        <span>Created by: <span className="font-semibold text-slate-700">{entry.createdBy || 'Unknown'}</span></span>
                                        <span>Last edited by: <span className="font-semibold text-slate-700">{entry.updatedBy || entry.createdBy || 'Unknown'}</span></span>
                                    </>
                                )}
                            </div>

                            {entry ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'finance-chair')) {
                                                alert('Only admins or finance chairs can delete entries.');
                                                return;
                                            }
                                            setShowDeleteModal(true);
                                            setDeleteReason('');
                                            setDeleteError('');
                                        }}
                                        className="text-red-600 font-bold hover:bg-red-50 px-4 py-2 rounded-lg transition-all flex items-center gap-2"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        Delete Entry
                                    </button>
                                    {/* Delete Confirmation Modal */}
                                    {showDeleteModal && (
                                        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                                            <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
                                                <h4 className="text-lg font-bold mb-2 text-red-700">Confirm Delete Entry</h4>
                                                <p className="mb-2">Please provide a reason for deleting this entry:</p>
                                                <textarea className="w-full border-2 border-slate-300 rounded-lg p-2 mb-2" rows={3} value={deleteReason} onChange={e => setDeleteReason(e.target.value)} />
                                                {deleteError && <div className="text-red-600 text-sm mb-2">{deleteError}</div>}
                                                <div className="flex gap-3 justify-end mt-2">
                                                    <button onClick={() => setShowDeleteModal(false)} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg">Cancel</button>
                                                    <button
                                                        onClick={async () => {
                                                            if (!deleteReason.trim()) {
                                                                setDeleteError('Reason is required.');
                                                                return;
                                                            }
                                                            
                                                            try {
                                                                // Log deletion to database
                                                                if (settings.supabaseUrl && settings.supabaseKey) {
                                                                    await logEntryDeletionToSupabase(
                                                                        settings.supabaseUrl,
                                                                        settings.supabaseKey,
                                                                        entry,
                                                                        deleteReason,
                                                                        currentUser?.username || 'Unknown'
                                                                    );
                                                                    
                                                                    // Mark entry as deleted in database
                                                                    await markEntryAsDeletedInSupabase(
                                                                        settings.supabaseUrl,
                                                                        settings.supabaseKey,
                                                                        entry.id,
                                                                        currentUser?.username || 'Unknown',
                                                                        deleteReason
                                                                    );
                                                                }
                                                                
                                                                setShowDeleteModal(false);
                                                                setDeleteError('');
                                                                setDeletionLog(prev => [
                                                                    ...prev,
                                                                    {
                                                                        id: entry.id,
                                                                        reason: deleteReason,
                                                                        deletedBy: currentUser?.username || 'Unknown',
                                                                        deletedAt: getNowEST(),
                                                                    },
                                                                ]);
                                                                
                                                                // Call parent delete handler
                                                                onDelete(entry.id);
                                                                
                                                                // Show success message and close modal
                                                                showToast(`✓ Entry deleted successfully by ${currentUser?.username || 'Unknown'}`, 'success', 3000);
                                                                setTimeout(() => {
                                                                    onClose();
                                                                }, 500);
                                                            } catch (error: any) {
                                                                showToast(`Failed to log deletion: ${error.message}`, 'error', 5000);
                                                            }
                                                        }}
                                                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {/* Deletion Log Section */}
                                    {deletionLog.length > 0 && (
                                        <div className="bg-slate-50 rounded-xl shadow border p-4 mt-8">
                                            <h4 className="font-bold text-slate-700 mb-2">Deleted Entries Log</h4>
                                            <ul className="text-xs text-slate-600 space-y-1">
                                                {deletionLog.map(log => (
                                                    <li key={log.id}>
                                                        <span className="font-semibold">ID:</span> {log.id} | <span className="font-semibold">By:</span> {log.deletedBy} | <span className="font-semibold">At:</span> {log.deletedAt} | <span className="font-semibold">Reason:</span> {log.reason}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div></div>
                            )}

                            <div className="flex gap-3">
                                <button type="button" onClick={onClose} className="bg-white border-2 border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-3 px-6 rounded-lg transition-all">
                                    Cancel
                                </button>
                                {!entry && (
                                    <button
                                        type="button"
                                        onClick={handleSubmitAndNew}
                                        disabled={hasDuplicate}
                                        className={`font-bold py-3 px-6 rounded-lg transition-all shadow-md ${hasDuplicate ? 'bg-gray-400 text-gray-200 cursor-not-allowed opacity-60' : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white hover:scale-105'}`}
                                    >
                                        Save & New
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    disabled={hasDuplicate}
                                    className={`font-bold py-3 px-6 rounded-lg transition-all shadow-md ${hasDuplicate ? 'bg-gray-400 text-gray-200 cursor-not-allowed opacity-60' : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white hover:scale-105'}`}
                                >
                                    {hasDuplicate ? '⚠️ Duplicate Detected' : 'Save'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
};

export default EntryModal;
