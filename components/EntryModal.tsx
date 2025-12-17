
// components/EntryModal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import type { Entry, EntryType, Method, Member, Settings, User, MonthLock } from '../types';
import { sanitizeEntry, isMonthLocked } from '../utils';

interface EntryModalProps {
    entry: Entry | null;
    existingEntries: Entry[];
    members: Member[];
    settings: Settings;
    currentUser?: User | null;
    monthLocks?: MonthLock[]; // Added for lock checking
    onSave: (entry: Entry) => void | Promise<void>;
    onSaveAndNew: (entry: Entry) => void | Promise<void>;
    onClose: () => void;
    onDelete: (id: string) => void;
}

const EntryModal: React.FC<EntryModalProps> = ({ entry, existingEntries, members, settings, currentUser, monthLocks = [], onSave, onSaveAndNew, onClose, onDelete }) => {
    const [formData, setFormData] = useState<Entry>(entry || sanitizeEntry({}));
    const [amountInput, setAmountInput] = useState<string>('');
    const [classFilter, setClassFilter] = useState('all');
    const [memberNumberInput, setMemberNumberInput] = useState('');
    const [showSuccessToast, setShowSuccessToast] = useState(false);
    const [duplicateWarning, setDuplicateWarning] = useState<{show: boolean, type: string} | null>(null);

    useEffect(() => {
        const initialData = entry || sanitizeEntry({});
        setFormData(initialData);
        setAmountInput(entry ? String(entry.amount) : '');
        
        if (entry && entry.memberID) {
            const member = members.find(m => m.id === entry.memberID);
            if (member && member.memberNumber) {
                setMemberNumberInput(member.memberNumber);
            } else {
                setMemberNumberInput('');
            }
        }
    }, [entry, members]);

    const classFilteredMembers = useMemo(() => {
        if (classFilter === 'all') return members;
        return members.filter(m => m.classNumber === classFilter);
    }, [members, classFilter]);

    const searchFilteredMembers = useMemo(() => {
        const numSearch = memberNumberInput.toLowerCase().trim();
        const nameSearch = formData.memberName.toLowerCase().trim();

        const isMemberSelected = classFilteredMembers.some(
            m => m.id === formData.memberID && m.name === formData.memberName
        );
        if (isMemberSelected) return classFilteredMembers;

        if (numSearch.length > 0) {
            return classFilteredMembers.filter(m => m.memberNumber && m.memberNumber.toLowerCase().startsWith(numSearch));
        }
        const handleKeyDown = async (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (hasDuplicate) {
                    const typeDisplay = formData.type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    setDuplicateWarning({show: true, type: typeDisplay});
                    return;
                }
                await handleSubmitAndNew(e as any);
            }
        };

        const validateAndSubmit = async (callback: (e: Entry) => void | Promise<void>) => {
            if (hasDuplicate) {
                const typeDisplay = formData.type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                setDuplicateWarning({show: true, type: typeDisplay});
                return false;
            }
            if (!formData.memberID && settings.enforceDirectory) {
                alert("Please select a valid member from the directory.");
                return false;
            }
            if (formData.amount <= 0) {
                alert("Amount must be greater than zero.");
                return false;
            }
            if (new Date(formData.date) > new Date()) {
                if(!window.confirm("You are entering a date in the future. Is this correct?")) return false;
            }

            const canOverrideLock = currentUser?.role === 'admin' || currentUser?.role === 'finance-chair';
            if (isMonthLocked(formData.date, monthLocks) && !canOverrideLock) {
                alert(`The financial month for ${formData.date} is LOCKED. You cannot add or edit entries for this period.`);
                return false;
            }

            if (entry && currentUser?.role === 'data-entry') {
                const createdTime = new Date(entry.createdAt || new Date()).getTime();
                const now = new Date().getTime();
                const minutesDiff = (now - createdTime) / (1000 * 60);
                if (minutesDiff > 15) {
                    alert("Time limit exceeded. Data Entry staff can only edit records within 15 minutes of creation. Please contact a Finance Team member.");
                    return false;
                }
            }

            const now = new Date().toISOString();
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
                alert(error.message || 'Failed to save entry');
                return false;
            }
        };

        const handleSubmit = async (e: React.FormEvent) => {
            e.preventDefault();
            await validateAndSubmit(onSave);
        };

        const handleSubmitAndNew = async (e: React.FormEvent) => {
            e.preventDefault();
            const success = await validateAndSubmit(async (entry) => {
                await onSaveAndNew(entry);
            });
            if (success) {
                setFormData(prev => sanitizeEntry({ date: prev.date }));
                setAmountInput('');
                setMemberNumberInput('');
            }
        };
        const now = new Date().toISOString();
        const entryToSave = {
            ...formData,
            updatedBy: currentUser?.username || 'Unknown',
            lastUpdated: now,
            createdBy: formData.createdBy || currentUser?.username || 'Unknown' // Keep original creator if editing
        };

        callback(entryToSave);
        
        // Success Feedback
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 3000);
    }
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        validateAndSubmit(onSave);
    };
            try {
                await callback(entryToSave);
                return true;
            } catch (error: any) {
                alert(error.message || 'Failed to save entry');
                return false;
            }
    const handleSubmitAndNew = (e: React.FormEvent) => {
        e.preventDefault();
        validateAndSubmit((entry) => {
            onSaveAndNew(entry);
            await validateAndSubmit(onSave);
            setFormData(prev => sanitizeEntry({ date: prev.date })); 
            setAmountInput('');
            setMemberNumberInput('');
        });
            const success = await validateAndSubmit(async (entry) => {
                await onSaveAndNew(entry);
            });
            if (success) {
                // Reset for next entry
                setFormData(prev => sanitizeEntry({ date: prev.date })); 
                setAmountInput('');
                setMemberNumberInput('');
            }
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
                            💡 <strong>Tip:</strong> Please edit the existing record or choose a different date/type.
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
                    {/* Modern Header */}
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
                                    <p className="text-sm text-blue-100 mt-1">Press Enter to Save & Add Another</p>
                                </div>
                            </div>
                            <button type="button" onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-lg text-2xl font-bold transition-all">×</button>
                        </div>
                    </div>
                    
                    <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto bg-gradient-to-br from-slate-50 to-blue-50">
                        {/* Member Selection */}
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
                                    <input name="memberName" list="members-list" value={formData.memberName} onChange={handleMemberNameChange} placeholder="Search member name..." className="w-full border-2 border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all" />
                                    <datalist id="members-list">
                                        {searchFilteredMembers.slice(0, 10).map(m => <option key={m.id} value={m.name} />)}
                                    </datalist>
                                </div>
                            </div>
                        </div>

                        {/* Date & Amount */}
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

                        {/* Type & Method */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="bg-white rounded-xl p-5 shadow-md border-2 border-amber-100">
                                <label className="block text-xs font-bold text-amber-600 uppercase mb-3 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                                    </svg>
                                    Type
                                </label>
                                <select name="type" value={formData.type} onChange={handleChange} className="w-full border-2 border-slate-300 rounded-lg p-3 capitalize font-semibold text-slate-700 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all">
                                    {ENTRY_TYPES.map(t => <option key={t} value={t}>{t.replace(/-/g, ' ')}</option>)}
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
                                    {(["cash", "check", "card", "e-transfer", "mobile", "other"] as Method[]).map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                        </div>
                        
                        {/* Note */}
                        <div className="bg-white rounded-xl p-5 shadow-md border-2 border-slate-200">
                            <label className="block text-xs font-bold text-slate-600 uppercase mb-3 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
                                </svg>
                                Note (Optional)
                            </label>
                            <input name="note" value={formData.note || ''} onChange={handleChange} placeholder="Add any additional details..." className="w-full border-2 border-slate-300 rounded-lg p-3 text-slate-700 focus:ring-2 focus:ring-slate-400 focus:border-slate-400 transition-all" />
                        </div>
                    </div>

                    {/* Modern Footer */}
                    <div className="p-6 bg-gradient-to-r from-slate-100 to-slate-50 rounded-b-2xl flex justify-between items-center border-t-2 border-slate-200">
                         {entry ? (
                            <button type="button" onClick={() => onDelete(entry.id)} className="text-red-600 font-bold hover:bg-red-50 px-4 py-2 rounded-lg transition-all flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                Delete Entry
                            </button>
                        ) : <div></div>}
                        
                        <div className="flex gap-3">
                             <button type="button" onClick={onClose} className="bg-white border-2 border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-3 px-6 rounded-lg transition-all">Cancel</button>
                             {!entry && (
                                <button type="button" onClick={handleSubmitAndNew} disabled={hasDuplicate} className={`font-bold py-3 px-6 rounded-lg transition-all shadow-md ${hasDuplicate ? 'bg-gray-400 text-gray-200 cursor-not-allowed opacity-60' : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white hover:scale-105'}`}>Save & New</button>
                             )}
                             <button type="submit" disabled={hasDuplicate} className={`font-bold py-3 px-6 rounded-lg transition-all shadow-md ${hasDuplicate ? 'bg-gray-400 text-gray-200 cursor-not-allowed opacity-60' : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white hover:scale-105'}`}>{hasDuplicate ? '⚠️ Duplicate Detected' : 'Save'}</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
        </>
    );
};

export default EntryModal;
