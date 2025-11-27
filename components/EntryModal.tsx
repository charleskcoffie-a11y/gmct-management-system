
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
    onSave: (entry: Entry) => void;
    onSaveAndNew: (entry: Entry) => void;
    onClose: () => void;
    onDelete: (id: string) => void;
}

const EntryModal: React.FC<EntryModalProps> = ({ entry, existingEntries, members, settings, currentUser, monthLocks = [], onSave, onSaveAndNew, onClose, onDelete }) => {
    const [formData, setFormData] = useState<Entry>(entry || sanitizeEntry({}));
    const [amountInput, setAmountInput] = useState<string>('');
    const [classFilter, setClassFilter] = useState('all');
    const [memberNumberInput, setMemberNumberInput] = useState('');
    const [showSuccessToast, setShowSuccessToast] = useState(false);

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
        if (nameSearch.length > 0) {
            return classFilteredMembers.filter(m => m.name.toLowerCase().includes(nameSearch));
        }
        return classFilteredMembers;
    }, [formData.memberID, formData.memberName, memberNumberInput, classFilteredMembers]);


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
                classNumber: matchedMember.classNumber || '',
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
                classNumber: matchedMember.classNumber || '',
            }));
            if (matchedMember.memberNumber) {
                setMemberNumberInput(matchedMember.memberNumber);
            }
        } else {
            setFormData(prev => ({ ...prev, memberName: newName, memberID: '', classNumber: '' }));
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmitAndNew(e as any);
        }
    };

    const validateAndSubmit = (callback: (e: Entry) => void) => {
        // 1. Validation
        if (!formData.memberID && settings.enforceDirectory) {
            alert("Please select a valid member from the directory.");
            return;
        }
        if (formData.amount <= 0) {
            alert("Amount must be greater than zero.");
            return;
        }
        if (new Date(formData.date) > new Date()) {
            if(!window.confirm("You are entering a date in the future. Is this correct?")) return;
        }

        // 2. Month Lock Check
        // Only Admin and Finance Chair can override locks
        const canOverrideLock = currentUser?.role === 'admin' || currentUser?.role === 'finance-chair';
        if (isMonthLocked(formData.date, monthLocks) && !canOverrideLock) {
            alert(`The financial month for ${formData.date} is LOCKED. You cannot add or edit entries for this period.`);
            return;
        }

        // 3. Edit Time Limit Check (Data Entry Role)
        if (entry && currentUser?.role === 'data-entry') {
            const createdTime = new Date(entry.createdAt || new Date()).getTime();
            const now = new Date().getTime();
            const minutesDiff = (now - createdTime) / (1000 * 60);
            
            if (minutesDiff > 15) {
                alert("Time limit exceeded. Data Entry staff can only edit records within 15 minutes of creation. Please contact a Finance Team member.");
                return;
            }
        }

        // 4. Audit Trail
        const now = new Date().toISOString();
        const entryToSave = {
            ...formData,
            updatedBy: currentUser?.username || 'Unknown',
            lastUpdated: now,
            createdBy: formData.createdBy || currentUser?.username || 'Unknown' // Keep original creator if editing
        };

        // 5. Duplicate Check
        const isDuplicate = existingEntries.some(e => 
            e.id !== formData.id && 
            !e.deleted &&
            e.date === formData.date &&
            e.memberID === formData.memberID &&
            e.type === formData.type &&
            Math.abs(e.amount - formData.amount) < 0.01
        );

        if (isDuplicate) {
            if (!window.confirm(`⚠️ Possible Duplicate: An entry for $${formData.amount} on ${formData.date} already exists. Save anyway?`)) {
                return;
            }
        }

        callback(entryToSave);
        
        // Success Feedback
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 3000);
    }
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        validateAndSubmit(onSave);
    };
    
    const handleSubmitAndNew = (e: React.FormEvent) => {
        e.preventDefault();
        validateAndSubmit((entry) => {
            onSaveAndNew(entry);
            // Reset for next entry
            setFormData(prev => sanitizeEntry({ date: prev.date })); 
            setAmountInput('');
            setMemberNumberInput('');
        });
    };

    const ENTRY_TYPES: EntryType[] = ["tithe", "offering", "thanksgiving-offering", "pledge", "harvest-levy", "kofi-and-ama", "other"];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl relative">
                
                {showSuccessToast && (
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-2 rounded-full shadow-lg font-bold animate-fadeIn z-50">
                        ✓ Contribution Recorded
                    </div>
                )}

                <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
                    <div className="p-6 border-b">
                        <h2 className="text-2xl font-bold text-gray-800">{entry ? 'Edit Contribution' : 'Record Contribution'}</h2>
                        <p className="text-sm text-slate-500">Press Enter to Save & Add Another</p>
                    </div>
                    
                    <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                        {/* Member Selection */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                             <div className="md:col-span-1">
                                <label className="block text-sm font-bold text-gray-700">Member #</label>
                                <input name="memberNumber" value={memberNumberInput} onChange={handleMemberNumberChange} placeholder="128" className="w-full border-gray-300 rounded-lg p-3 font-bold text-indigo-700 focus:ring-indigo-500" />
                            </div>
                            <div className="md:col-span-3">
                                <label className="block text-sm font-bold text-gray-700">Name</label>
                                <input name="memberName" list="members-list" value={formData.memberName} onChange={handleMemberNameChange} placeholder="Search Name..." className="w-full border-gray-300 rounded-lg p-3 focus:ring-indigo-500" />
                                <datalist id="members-list">
                                    {searchFilteredMembers.slice(0, 10).map(m => <option key={m.id} value={m.name} />)}
                                </datalist>
                            </div>
                        </div>

                        {/* Date Amount */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700">Date</label>
                                <input type="date" name="date" value={formData.date} onChange={handleChange} className="w-full border-gray-300 rounded-lg p-3 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700">Amount</label>
                                <input inputMode="decimal" value={amountInput} onChange={handleAmountChange} placeholder="0.00" className="w-full border-gray-300 rounded-lg p-3 font-bold text-xl text-right focus:ring-indigo-500" />
                            </div>
                        </div>

                        {/* Type Method */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700">Type</label>
                                <select name="type" value={formData.type} onChange={handleChange} className="w-full border-gray-300 rounded-lg p-3 capitalize">
                                    {ENTRY_TYPES.map(t => <option key={t} value={t}>{t.replace(/-/g, ' ')}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700">Method</label>
                                <select name="method" value={formData.method} onChange={handleChange} className="w-full border-gray-300 rounded-lg p-3 capitalize">
                                    {(["cash", "check", "card", "e-transfer", "mobile", "other"] as Method[]).map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                        </div>
                        
                         <div>
                            <label className="block text-sm font-bold text-gray-700">Note (Optional)</label>
                            <input name="note" value={formData.note || ''} onChange={handleChange} className="w-full border-gray-300 rounded-lg p-3" />
                        </div>
                    </div>

                    <div className="p-6 bg-gray-50 rounded-b-xl flex justify-between items-center">
                         {entry ? (
                            <button type="button" onClick={() => onDelete(entry.id)} className="text-red-600 font-bold hover:underline">Delete Entry</button>
                        ) : <div></div>}
                        
                        <div className="flex gap-3">
                             <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 font-bold py-3 px-6 rounded-lg">Cancel</button>
                             {!entry && (
                                <button type="button" onClick={handleSubmitAndNew} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg">Save & New</button>
                             )}
                             <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg">Save</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EntryModal;
