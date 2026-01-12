import React, { useState, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Member, Entry, Settings, SyncStatus, Method } from '../types';
import { formatCurrency, getTodayEST, getNowEST } from '../utils';
import { saveEntryToSupabase, markEntryAsDeletedInSupabase, logEntryDeletionToSupabase } from '../services/supabase';
import { downloadReceipt, shareViaWhatsApp } from '../utils/receiptGenerator';

interface DevelopmentFundProps {
    members: Member[];
    entries: Entry[];
    setEntries: React.Dispatch<React.SetStateAction<Entry[]>>;
    settings: Settings;
    syncStatus?: SyncStatus;
    currentUser?: import('../types').User | null;
}

const DevelopmentFund: React.FC<DevelopmentFundProps> = ({ members, entries, setEntries, settings, syncStatus, currentUser }) => {
    // --- State ---
    const [memberInput, setMemberInput] = useState('');
    const [startDate, setStartDate] = useState(''); // Empty = show all
    const [endDate, setEndDate] = useState(''); // Empty = show all
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [showDeleted, setShowDeleted] = useState(false);
    const [datePreset, setDatePreset] = useState<'custom' | 'this-week' | 'this-month' | 'qtd' | 'ytd' | 'last-12m'>('custom');
    const [sortConfig, setSortConfig] = useState<{ key: 'date' | 'amount'; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editDate, setEditDate] = useState<string>('');
    const [editAmount, setEditAmount] = useState<string>('');
    const [editDesc, setEditDesc] = useState<string>('');
    const [editMethod, setEditMethod] = useState<Method>('cash');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [lastDeleted, setLastDeleted] = useState<Entry | null>(null);
    const [duplicateWarning, setDuplicateWarning] = useState(false);
    const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
    type BulkRow = {
        id: string;
        memberInput: string;
        memberId: string;
        memberName: string;
        date: string;
        amount: string;
        note: string;
        method: Method;
    };
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [bulkSaving, setBulkSaving] = useState(false);
    const [bulkRows, setBulkRows] = useState<BulkRow[]>([{
        id: uuidv4(),
        memberInput: '',
        memberId: '',
        memberName: '',
        date: getTodayEST(),
        amount: '',
        note: '',
        method: 'cash'
    }]);

    // Form State
    const [newAmount, setNewAmount] = useState('');
    const [newDate, setNewDate] = useState(() => getTodayEST());
    const [newDesc, setNewDesc] = useState('');
    const [newMethod, setNewMethod] = useState<Method>('cash');
    const [newPaymentMonth, setNewPaymentMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [editPaymentMonth, setEditPaymentMonth] = useState('');

    // Helper function to generate default description based on payment month
    const generatePaymentDescription = (monthStr: string): string => {
        const [year, month] = monthStr.split('-');
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        const monthName = monthNames[parseInt(month) - 1];
        return `${monthName} ${year} Payment`;
    };

    // --- Derived Data ---
    // Filter members to show only those who have pledged to development fund
    const pledgedMembers = useMemo(() => {
        return members.filter(m => m.devFundPledge === true);
    }, [members]);

    const selectedMember = useMemo(() => {
        const term = memberInput.trim().toLowerCase();
        if (!term) return null;
        return pledgedMembers.find(m =>
            m.name.toLowerCase() === term ||
            (m.memberNumber && m.memberNumber.toLowerCase() === term)
        ) || null;
    }, [pledgedMembers, memberInput]);

    const displayEntries = useMemo(() => {
        let filtered = entries.filter(e => {
            if (e.type !== 'development-fund') return false;
            if (e.deleted && !showDeleted) return false; // Hide deleted entries unless showDeleted is true
            if (startDate && e.date < startDate) return false;
            if (endDate && e.date > endDate) return false;
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
    }, [entries, members, startDate, endDate, sortConfig, showDeleted]);

    // Group entries by date
    const groupedEntries = useMemo(() => {
        const groups: { [date: string]: typeof displayEntries } = {};
        displayEntries.forEach(entry => {
            // Only use the date part (YYYY-MM-DD)
            const dateKey = entry.date.slice(0, 10);
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(entry);
        });
        // Sort dates descending
        const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));
        return sortedDates.map(date => ({ date, entries: groups[date] }));
    }, [displayEntries]);

    // State for expanded/collapsed groups
    const [expandedDates, setExpandedDates] = useState<{ [date: string]: boolean }>({});
    useEffect(() => {
        // Expand the most recent date by default on first load
        if (groupedEntries.length > 0 && Object.keys(expandedDates).length === 0) {
            setExpandedDates({ [groupedEntries[0].date]: true });
        }
    }, [groupedEntries]);

    const toggleDateGroup = (date: string) => {
        setExpandedDates(prev => ({ ...prev, [date]: !prev[date] }));
    };

    const totalContributions = displayEntries.reduce((sum, e) => sum + e.amount, 0);

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
        if (!settings.supabaseUrl || !settings.supabaseKey || syncStatus?.state !== 'synced') {
            alert('Writes are disabled until connected to the cloud. Please ensure Supabase is configured and the app shows Connected.');
            return;
        }
        
        // CRITICAL: Block submission if duplicate exists (even via keyboard shortcuts)
        if (hasDuplicate) {
            console.log('🚫 DUPLICATE DETECTED - Entry blocked');
            setDuplicateWarning(true);
            return;
        }
        
        if (!selectedMember) return alert("Please choose a member by typing their name or member #.");
        
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
            method: newMethod,
            amount: amountVal,
            note: newDesc || generatePaymentDescription(newPaymentMonth),
            createdAt: getNowEST(),
            createdBy: (typeof currentUser === 'object' && currentUser?.username) ? currentUser.username : 'Unknown',
            updatedBy: (typeof currentUser === 'object' && currentUser?.username) ? currentUser.username : 'Unknown',
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
            setNewDate(getTodayEST()); // Reset to today
            setNewMethod('cash'); // Reset to default method
            const now = new Date();
            setNewPaymentMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`); // Reset to current month
            setDuplicateWarning(false); // Clear any previous warning
            setMemberInput('');

            setToastMessage('Contribution Added');
            setShowToast(true);
            setTimeout(() => setShowToast(false), 3000);
            setIsEntryModalOpen(false);
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

    // --- Delete Modal State ---
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleteReason, setDeleteReason] = useState('');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const [deletionLog, setDeletionLog] = useState<{id: string, reason: string, deletedBy: string, deletedAt: string}[]>([]);

    const handleDelete = (id: string) => {
        if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'finance-chair')) {
            alert('Only admins or finance chairs can delete entries.');
            return;
        }
        setDeleteId(id);
        setDeleteReason('');
        setDeleteError('');
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = async () => {
        if (!deleteReason.trim()) {
            setDeleteError('Reason is required.');
            return;
        }
        if (!deleteId) return;
        if (!settings.supabaseUrl || !settings.supabaseKey || syncStatus?.state !== 'synced') {
            alert('Deletes are disabled until connected to the cloud. Please ensure Supabase is configured and the app shows Connected.');
            return;
        }
        const entry = entries.find(e => e.id === deleteId);
        if (!entry) {
            alert('Entry not found');
            return;
        }
        
        try {
            // Log deletion to database first
            if (settings.supabaseUrl && settings.supabaseKey) {
                await logEntryDeletionToSupabase(
                    settings.supabaseUrl, 
                    settings.supabaseKey, 
                    entry,
                    deleteReason,
                    currentUser.username
                );
                
                // Then mark as deleted in the entries table
                await markEntryAsDeletedInSupabase(
                    settings.supabaseUrl, 
                    settings.supabaseKey, 
                    deleteId,
                    currentUser.username,
                    deleteReason
                );
            }
            
            // Update local state
            setEntries(prev => prev.map(e => e.id === deleteId ? { 
                ...e, 
                deleted: true, 
                deletedReason: deleteReason, 
                deletedBy: currentUser.username, 
                deletedAt: getNowEST() 
            } : e));
            
            setLastDeleted(entry);
            setDeletionLog(prev => [...prev, { 
                id: deleteId, 
                reason: deleteReason, 
                deletedBy: currentUser.username, 
                deletedAt: getNowEST() 
            }]);
            
            // Show success message
            alert(`✓ Entry deleted successfully.\n\nDeleted by: ${currentUser.username}\nReason: ${deleteReason}`);
        } catch (error: any) {
            alert(`Failed to delete: ${error.message}`);
            setShowDeleteModal(false);
            setDeleteId(null);
            setDeleteReason('');
            setDeleteError('');
            return;
        }
        
        setShowDeleteModal(false);
        setDeleteId(null);
        setDeleteReason('');
        setDeleteError('');
    };

    const handleCancelDelete = () => {
        setShowDeleteModal(false);
        setDeleteId(null);
        setDeleteReason('');
        setDeleteError('');
    };

    const submitBulkRows = async () => {
        if (bulkSaving) return;
        if (!settings.supabaseUrl || !settings.supabaseKey || syncStatus?.state !== 'synced') {
            alert('Writes are disabled until connected to the cloud. Please ensure Supabase is configured and the app shows Connected.');
            return;
        }
        setBulkSaving(true);
        try {
            const prepared: Entry[] = [];
            for (const row of bulkRows) {
                const built = buildBulkEntry(row);
                if (!built) {
                    setBulkSaving(false);
                    return;
                }
                if (prepared.some(p => p.memberID === built.memberID && p.date === built.date && p.type === built.type)) {
                    alert(`Duplicate detected inside bulk list for ${built.memberName} on ${built.date}.`);
                    setBulkSaving(false);
                    return;
                }
                prepared.push(built);
            }
            for (const entry of prepared) {
                if (settings.supabaseUrl && settings.supabaseKey) {
                    await saveEntryToSupabase(settings.supabaseUrl, settings.supabaseKey, entry);
                }
            }
            setEntries(prev => [...prev, ...prepared]);
            setBulkRows([{
                id: uuidv4(),
                memberInput: '',
                memberId: '',
                memberName: '',
                date: getTodayEST(),
                amount: '',
                note: '',
                method: 'cash'
            }]);
            setIsBulkMode(false);
            setMemberInput('');
            setIsEntryModalOpen(false);
            setToastMessage('Bulk Contributions Added');
            setShowToast(true);
            setTimeout(() => setShowToast(false), 3000);
        } catch (error: any) {
            alert(`Failed to save bulk entries: ${error.message}`);
        } finally {
            setBulkSaving(false);
        }
    };

    const addBulkRow = () => {
        setBulkRows(rows => [...rows, {
            id: uuidv4(),
            memberInput: '',
            memberId: '',
            memberName: '',
            date: getTodayEST(),
            amount: '',
            note: '',
            method: 'cash'
        }]);
    };

    const removeBulkRow = (id: string) => {
        setBulkRows(rows => rows.length === 1 ? rows : rows.filter(r => r.id !== id));
    };

    const updateBulkRow = (id: string, patch: Partial<BulkRow>) => {
        setBulkRows(rows => rows.map(r => r.id === id ? { ...r, ...patch } : r));
    };

    const handleBulkMemberChange = (id: string, value: string) => {
        const match = members.find(m =>
            m.name.toLowerCase() === value.toLowerCase() ||
            (m.memberNumber && m.memberNumber.toLowerCase() === value.toLowerCase())
        );

        if (match) {
            updateBulkRow(id, {
                memberInput: match.name,
                memberId: match.id,
                memberName: match.name
            });
        } else {
            updateBulkRow(id, {
                memberInput: value,
                memberId: '',
                memberName: value
            });
        }
    };

    const buildBulkEntry = (row: BulkRow): Entry | null => {
        const amountVal = parseFloat(row.amount);
        if (!row.memberId && settings.enforceDirectory) {
            alert('Please select a valid member from the directory for each row.');
            return null;
        }
        if (isNaN(amountVal) || amountVal <= 0) {
            alert('Amounts must be positive numbers.');
            return null;
        }
        if (new Date(row.date) > new Date()) {
            if (!window.confirm('One or more dates are in the future. Continue?')) return null;
        }

        if (entries.some(en => !en.deleted && en.type === 'development-fund' && en.memberID === row.memberId && en.date === row.date)) {
            alert(`Duplicate detected for ${row.memberName || row.memberInput} on ${row.date}.`);
            return null;
        }

        const member = members.find(m => m.id === row.memberId);

        return {
            id: uuidv4(),
            date: row.date,
            memberID: row.memberId || member?.id || '',
            memberName: member?.name || row.memberName,
            classNumber: member?.classNumber,
            type: 'development-fund',
            fund: 'development-fund',
            method: row.method,
            amount: amountVal,
            note: row.note || undefined,
            createdAt: new Date().toISOString(),
            createdBy: (typeof currentUser === 'object' && currentUser?.username) ? currentUser.username : 'Unknown',
            updatedBy: (typeof currentUser === 'object' && currentUser?.username) ? currentUser.username : 'Unknown',
            deleted: false
        };
    };

    const undoDelete = async () => {
        if (!lastDeleted) return;
        if (!settings.supabaseUrl || !settings.supabaseKey || syncStatus?.state !== 'synced') {
            alert('Writes are disabled until connected to the cloud. Please ensure Supabase is configured and the app shows Connected.');
            return;
        }
        try {
            if (settings.supabaseUrl && settings.supabaseKey) {
                await saveEntryToSupabase(settings.supabaseUrl, settings.supabaseKey, lastDeleted);
            }
            setEntries(prev => [...prev, lastDeleted]);
            setLastDeleted(null);
        } catch (error: any) {
            alert(`Failed to restore: ${error.message}`);
        }
    };

    const startEdit = (entryId: string, date: string, amount: number, desc: string, method: Method = 'cash') => {
        setEditingId(entryId);
        setEditDate(date);
        setEditAmount(String(amount));
        setEditDesc(desc || '');
        setEditMethod(method);
        // Try to extract month from description, otherwise use current month
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        let extractedMonth = '';
        if (desc) {
            const match = desc.match(/(\w+)\s+(\d{4})\s+Payment/);
            if (match) {
                const monthIndex = monthNames.indexOf(match[1]);
                if (monthIndex !== -1) {
                    extractedMonth = `${match[2]}-${String(monthIndex + 1).padStart(2, '0')}`;
                }
            }
        }
        setEditPaymentMonth(extractedMonth || (() => {
            const now = new Date();
            return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        })());
        setIsEditModalOpen(true);
    };

    const saveEdit = async () => {
        if (!editingId) return;
        if (!settings.supabaseUrl || !settings.supabaseKey || syncStatus?.state !== 'synced') {
            alert('Writes are disabled until connected to the cloud. Please ensure Supabase is configured and the app shows Connected.');
            return;
        }
        const amountVal = parseFloat(editAmount);
        if (isNaN(amountVal) || amountVal <= 0) { alert('Enter a valid positive amount.'); return; }
        if (new Date(editDate) > new Date()) {
            if (!window.confirm('Date is in the future. Continue?')) return;
        }
        try {
            console.log('Saving edit for entry:', editingId);
            const updatedEntry = entries.find(e => e.id === editingId);
            console.log('Found entry to edit:', updatedEntry);
            if (!updatedEntry) {
                alert('Error: Entry not found');
                return;
            }
            const newEntry = { ...updatedEntry, date: editDate, amount: amountVal, note: editDesc || generatePaymentDescription(editPaymentMonth), method: editMethod || 'cash', updatedBy: (typeof currentUser === 'object' && currentUser?.username) ? currentUser.username : 'Unknown' };
            console.log('New entry data:', newEntry);
            if (settings.supabaseUrl && settings.supabaseKey) {
                console.log('Saving to Supabase...');
                await saveEntryToSupabase(settings.supabaseUrl, settings.supabaseKey, newEntry);
                console.log('Saved to Supabase successfully');
            }
            console.log('Updating local state...');
            setEntries(prev => {
                const updated = prev.map(e => e.id === editingId ? newEntry : e);
                console.log('Updated entries:', updated);
                console.log('Original entries:', prev);
                console.log('Finding updated entry:', updated.find(e => e.id === editingId));
                return updated;
            });
            setToastMessage('Entry updated successfully!');
            setShowToast(true);
            setTimeout(() => setShowToast(false), 3000);
            setEditingId(null);
            setIsEditModalOpen(false);
        } catch (error: any) {
            console.error('Error saving edit:', error);
            alert(`Failed to save edit: ${error.message}`);
        }
    };

    const cancelEdit = () => {
        setEditingId(null);
        setIsEditModalOpen(false);
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
            if (savedPreset && savedPreset !== 'custom') {
                applyPreset(savedPreset);
            }
        } catch {}
    }, []);

    useEffect(() => {
        try { localStorage.setItem('devfund-sort', JSON.stringify(sortConfig)); } catch {}
    }, [sortConfig]);

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col gap-6 relative">
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
                                A <span className="font-bold text-red-600">Development Fund</span> contribution already exists for <span className="font-bold">{selectedMember?.name || memberInput || 'this member'}</span> on <span className="font-bold">{newDate}</span>.
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
                    ✓ {toastMessage || 'Contribution Added'}
                </div>
            )}

            <div className="flex flex-col bg-gradient-to-br from-white via-purple-50 to-pink-50 rounded-xl shadow-lg border-2 border-purple-200 overflow-hidden flex-1">
                <div className="p-6 border-b-2 border-purple-200 bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                    <div className="flex-1">
                        <h2 className="text-3xl font-bold text-white">💰 Development Fund</h2>
                        <p className="text-purple-100 text-sm mt-1">Track and manage development fund contributions. Use the Add Entry button below for single or bulk captures.</p>
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
                            <button key="all" type="button" onClick={() => {setStartDate(''); setEndDate(''); setDatePreset('all');}} className={`px-2 py-1 rounded-md text-xs font-bold transition transform hover:scale-110 ${datePreset==='all' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' : 'bg-white text-slate-700 border border-purple-300 hover:border-purple-600'}`}>All</button>
                            {(['this-week','this-month','qtd','ytd','last-12m'] as const).map(p => (
                                <button key={p} type="button" onClick={() => applyPreset(p)} className={`px-2 py-1 rounded-md text-xs font-bold transition transform hover:scale-110 ${datePreset===p ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' : 'bg-white text-slate-700 border border-purple-300 hover:border-purple-600'}`}>{p.replace('-', ' ')}</button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 bg-gradient-to-r from-white/70 to-purple-50 border-b border-purple-100 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-purple-700 font-semibold">
                            <span className="bg-purple-600 text-white px-2 py-1 rounded-md text-xs font-bold">Tip</span>
                            Use the button at the bottom-right to add contributions (single or bulk). Filters above keep the table focused on the date range you need.
                        </div>
                        {(currentUser?.role === 'admin' || currentUser?.role === 'finance-chair' || currentUser?.role === 'finance-team') && (
                            <label className="flex items-center gap-2 text-xs font-bold uppercase text-red-700 cursor-pointer bg-red-50 px-3 py-2 rounded-lg border border-red-300">
                                <input type="checkbox" checked={showDeleted} onChange={e => setShowDeleted(e.target.checked)} className="rounded border-red-300 text-red-600 focus:ring-red-500"/>
                                🗑️ Show Deleted Records
                            </label>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-hidden">
                    <div className="overflow-y-auto max-h-[60vh] border-t-2 border-purple-200">
                        {groupedEntries.length === 0 && (
                            <div className="p-12 text-center text-slate-400 text-lg">No contributions found.</div>
                        )}
                        {groupedEntries.map(group => {
                            // Separate active and deleted entries within each group
                            const activeEntries = group.entries.filter(e => {
                                const orig = entries.find(orig => orig.id === e.id);
                                return !orig?.deleted;
                            });
                            const deletedEntries = group.entries.filter(e => {
                                const orig = entries.find(orig => orig.id === e.id);
                                return orig?.deleted === true;
                            });
                            const activeTotal = activeEntries.reduce((s,e)=>s+e.amount,0);
                            const deletedTotal = deletedEntries.reduce((s,e)=>s+e.amount,0);
                            
                            return (
                            <div key={group.date} className="mb-4 border rounded-lg bg-gradient-to-r from-purple-50 to-pink-50">
                                <div
                                    className="flex items-center justify-between px-4 py-2 cursor-pointer bg-gradient-to-r from-purple-200 to-pink-200 border-b"
                                    onClick={() => toggleDateGroup(group.date)}
                                >
                                    <div className="font-bold text-purple-800 text-lg">{group.date}</div>
                                    <div className="text-purple-600 font-semibold">
                                        {expandedDates[group.date] ? '▼' : '►'} {activeEntries.length} active{deletedEntries.length > 0 ? ` + ${deletedEntries.length} deleted` : ''} | {formatCurrency(activeTotal, settings.currency)}
                                    </div>
                                </div>
                                {expandedDates[group.date] && (
                                    <div className="max-h-[500px] overflow-y-auto">
                                        {/* Active Entries Section */}
                                        {activeEntries.length > 0 && (
                                        <div className="space-y-3 p-4">
                                                {activeEntries.map((entry) => {
                                                    const originalEntry = entries.find(e => e.id === entry.id);
                                                    return (
                                                    <div key={entry.id} className="bg-white border-l-4 border-purple-500 rounded-lg p-4 shadow hover:shadow-md transition">
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <span className="font-bold text-slate-800">{entry.memberName}</span>
                                                                    <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs">Class {entry.classNumber}</span>
                                                                </div>
                                                                <p className="text-slate-600 text-sm mb-2">{entry.description}</p>
                                                                <div className="flex items-center gap-3 flex-wrap">
                                                                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-semibold">
                                                                        {originalEntry?.method?.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Cash'}
                                                                    </span>
                                                                    {originalEntry?.createdBy && (
                                                                        <span className="text-slate-500 text-xs">By {originalEntry.createdBy}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-2xl font-bold text-green-600 mb-3">
                                                                    {formatCurrency(entry.amount, settings.currency)}
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <button 
                                                                        onClick={() => {
                                                                            if (!originalEntry) {
                                                                                setToastMessage('Error: Original entry not found');
                                                                                setShowToast(true);
                                                                                setTimeout(() => setShowToast(false), 3000);
                                                                                return;
                                                                            }
                                                                            const member = members.find(m => m.id === originalEntry.memberID);
                                                                            console.log('Download button clicked for entry:', originalEntry.id, 'Member:', member);
                                                                            const result = downloadReceipt({ entry: originalEntry, member, settings });
                                                                            setToastMessage(result.message);
                                                                            setShowToast(true);
                                                                            setTimeout(() => setShowToast(false), 3000);
                                                                        }}
                                                                        title="Download Receipt"
                                                                        className="text-blue-600 hover:text-blue-800 font-bold px-2 py-1 rounded hover:bg-blue-50"
                                                                    >
                                                                        📄
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => {
                                                                            if (!originalEntry) {
                                                                                setToastMessage('Error: Original entry not found');
                                                                                setShowToast(true);
                                                                                setTimeout(() => setShowToast(false), 3000);
                                                                                return;
                                                                            }
                                                                            const member = members.find(m => m.id === originalEntry.memberID);
                                                                            console.log('WhatsApp button clicked for entry:', originalEntry.id, 'Member:', member);
                                                                            const result = shareViaWhatsApp({ entry: originalEntry, member, settings });
                                                                            setToastMessage(result.message);
                                                                            setShowToast(true);
                                                                            setTimeout(() => setShowToast(false), 3000);
                                                                        }}
                                                                        title="Share via WhatsApp"
                                                                        className="text-green-600 hover:text-green-800 font-bold px-2 py-1 rounded hover:bg-green-50"
                                                                    >
                                                                        💬
                                                                    </button>
                                                                    <button onClick={() => startEdit(entry.id, entry.date, entry.amount, entry.description, (originalEntry?.method as Method) || 'cash')} className="text-indigo-600 hover:text-indigo-800 font-bold px-2 py-1 rounded hover:bg-indigo-50">✏️</button>
                                                                    <button onClick={() => handleDelete(entry.id)} className="text-red-400 hover:text-red-600 font-bold px-2 py-1 rounded hover:bg-red-50">🗑️</button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    );
                                                })}
                                        </div>
                                        )}
                                        
                                        {/* Deleted Entries Section */}
                                        {deletedEntries.length > 0 && showDeleted && (
                                        <div className="border-t-4 border-red-200 pt-4">
                                            <div className="px-4 py-2 mb-3 flex items-center justify-between">
                                                <span className="text-red-700 font-bold text-xs uppercase flex items-center gap-2">
                                                    🗑️ Deleted Entries ({deletedEntries.length})
                                                </span>
                                                <span className="text-red-600 text-xs font-semibold">
                                                    Total: {formatCurrency(deletedTotal, settings.currency)}
                                                </span>
                                            </div>
                                            <div className="space-y-3 px-4">
                                                {deletedEntries.map((entry) => {
                                                    const originalEntry = entries.find(e => e.id === entry.id);
                                                    return (
                                                    <div key={entry.id} className="bg-red-50/50 border-l-4 border-red-500 rounded-lg p-4 opacity-70">
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <span className="font-bold text-red-500 line-through">{entry.memberName}</span>
                                                                    <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs">Class {entry.classNumber}</span>
                                                                </div>
                                                                <p className="text-red-600 text-sm mb-2 line-through">{entry.description}</p>
                                                                <div className="text-xs text-red-700">
                                                                    <div className="font-semibold">Deleted by: {originalEntry?.deletedBy || 'Unknown'}</div>
                                                                    <div className="text-red-600 italic">Reason: "{originalEntry?.deletedReason || 'No reason'}"</div>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-lg font-bold text-red-500 line-through">
                                                                    {formatCurrency(entry.amount, settings.currency)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {lastDeleted && (
                <div className="fixed bottom-6 right-6 bg-gradient-to-r from-red-500 to-rose-600 text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 border-2 border-red-300">
                    <span className="font-bold">🗑️ Entry deleted.</span>
                    <button onClick={undoDelete} className="bg-white text-red-600 font-bold px-3 py-1 rounded-md hover:bg-red-100 transition">↩️ Undo</button>
                    <button onClick={()=>setLastDeleted(null)} className="text-red-200 hover:text-white transition font-bold">✕</button>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
                        <h4 className="text-lg font-bold mb-2 text-red-700">Confirm Delete Entry</h4>
                        <p className="mb-2">Please provide a reason for deleting this entry:</p>
                        <textarea 
                            className="w-full border-2 border-slate-300 rounded-lg p-2 mb-2" 
                            rows={3} 
                            value={deleteReason} 
                            onChange={e => setDeleteReason(e.target.value)}
                            placeholder="Enter reason for deletion (required)..."
                        />
                        {deleteError && <div className="text-red-600 text-sm mb-2">{deleteError}</div>}
                        <div className="flex gap-3 justify-end mt-2">
                            <button onClick={handleCancelDelete} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg">Cancel</button>
                            <button onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg">Delete</button>
                        </div>
                    </div>
                </div>
            )}

            <button
                type="button"
                onClick={() => { setIsEntryModalOpen(true); setIsBulkMode(false); }}
                className="fixed bottom-6 right-6 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold px-6 py-4 rounded-full shadow-2xl flex items-center gap-3 text-base"
            >
                <span className="text-2xl leading-none">+</span>
                Add Entry
            </button>

            {isEntryModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-center items-center p-4" onClick={() => setIsEntryModalOpen(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col border-2 border-slate-200" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 rounded-t-2xl text-white flex justify-between items-start">
                            <div>
                                <h3 className="text-2xl font-bold">Add Development Fund Entry</h3>
                                <p className="text-blue-100 text-sm mt-1">Choose single or bulk entry mode below.</p>
                            </div>
                            <button onClick={() => setIsEntryModalOpen(false)} className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-lg text-2xl font-bold transition">×</button>
                        </div>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
                            <div className="text-sm font-semibold text-slate-700">Entry mode</div>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setIsBulkMode(false)} className={`px-4 py-2 rounded-lg text-sm font-bold border-2 transition ${!isBulkMode ? 'bg-green-600 border-green-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-700 hover:border-green-400'}`}>
                                    Single Entry
                                </button>
                                <button type="button" onClick={() => setIsBulkMode(true)} className={`px-4 py-2 rounded-lg text-sm font-bold border-2 transition ${isBulkMode ? 'bg-purple-600 border-purple-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-700 hover:border-purple-400'}`}>
                                    Bulk Entry
                                </button>
                            </div>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            {!isBulkMode && (
                                <form onSubmit={handleAddEntry} onKeyDown={handleKeyDown} className="space-y-4">
                                    <div className="bg-white rounded-xl shadow-md border-2 border-slate-200 p-4">
                                        <label className="block text-xs font-bold uppercase text-slate-600 mb-2">Member</label>
                                        <input
                                            list="devfund-members"
                                            value={memberInput}
                                            onChange={e => setMemberInput(e.target.value)}
                                            placeholder="Type name or member #"
                                            className="w-full border-2 border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 font-medium"
                                        />
                                        <datalist id="devfund-members">
                                            {pledgedMembers.slice(0, 400).map(m => (
                                                <React.Fragment key={m.id}>
                                                    <option value={m.name} />
                                                    {m.memberNumber && <option value={m.memberNumber} />}
                                                </React.Fragment>
                                            ))}
                                        </datalist>
                                        <p className="text-xs text-slate-500 mt-2">
                                            Directory required: {settings.enforceDirectory ? 'Yes' : 'No'} • Showing {pledgedMembers.length} pledged members
                                        </p>
                                        {selectedMember && (
                                            <div className="mt-3 space-y-2">
                                                <div className="flex gap-2 text-xs font-bold text-slate-700">
                                                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md">Class {selectedMember.classNumber || '-'}</span>
                                                    <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-md">ID: {selectedMember.memberNumber || 'N/A'}</span>
                                                </div>
                                                {selectedMember.devFundPledgeAmount && selectedMember.devFundPledgeAmount > 0 && (
                                                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-3">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-bold text-green-700">💰 PLEDGED AMOUNT:</span>
                                                            <span className="text-lg font-bold text-green-700">{formatCurrency(selectedMember.devFundPledgeAmount, settings.currency)}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-white rounded-xl p-4 shadow-md border-2 border-purple-100">
                                            <label className="block text-xs font-bold text-purple-600 uppercase mb-2">Date</label>
                                            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full border-2 border-slate-300 rounded-lg p-3 text-slate-700 font-semibold focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all" />
                                        </div>
                                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 shadow-md border-2 border-green-200">
                                            <label className="block text-xs font-bold text-green-600 uppercase mb-2">Amount</label>
                                            <input inputMode="decimal" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="0.00" className="w-full border-2 border-green-300 rounded-lg p-3 font-bold text-2xl text-right text-green-700 focus:ring-2 focus:ring-green-400 focus:border-green-400 transition-all bg-white" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-white rounded-xl p-4 shadow-md border-2 border-orange-100">
                                            <label className="block text-xs font-bold text-orange-600 uppercase mb-2">Payment For (Month)</label>
                                            <input type="month" value={newPaymentMonth} onChange={e => {setNewPaymentMonth(e.target.value); if (!newDesc || newDesc === generatePaymentDescription(newPaymentMonth)) { setNewDesc(generatePaymentDescription(e.target.value)); }}} className="w-full border-2 border-orange-300 rounded-lg p-3 text-slate-700 font-semibold focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all bg-white" />
                                        </div>
                                        <div></div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-white rounded-xl p-4 shadow-md border-2 border-blue-100">
                                            <label className="block text-xs font-bold text-blue-600 uppercase mb-2">Payment Method</label>
                                            <select value={newMethod} onChange={e => setNewMethod(e.target.value as Method)} className="w-full border-2 border-blue-300 rounded-lg p-3 text-slate-700 font-semibold focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all bg-white">
                                                <option value="cash">Cash</option>
                                                <option value="e-transfer">E-Transfer</option>
                                                <option value="check">Check</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </div>
                                        <div></div>
                                    </div>
                                    <div className="bg-white rounded-xl p-4 shadow-md border-2 border-slate-200">
                                        <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Note (Optional)</label>
                                        <textarea rows={3} value={newDesc || generatePaymentDescription(newPaymentMonth)} onChange={e => setNewDesc(e.target.value)} placeholder={generatePaymentDescription(newPaymentMonth)} className="w-full border-2 border-slate-300 rounded-lg p-3 text-slate-700 focus:ring-2 focus:ring-slate-400 focus:border-slate-400 transition-all" />
                                    </div>
                                    <div className="flex justify-end">
                                        <button
                                            type="submit"
                                            disabled={hasDuplicate || !selectedMember}
                                            className={`font-bold py-3 px-6 rounded-lg transition-all shadow-md ${hasDuplicate || !selectedMember ? 'bg-gray-400 text-gray-200 cursor-not-allowed opacity-60' : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white hover:scale-105'}`}
                                        >
                                            {hasDuplicate ? '⚠️ Duplicate Detected' : 'Save Contribution'}
                                        </button>
                                    </div>
                                </form>
                            )}

                            {isBulkMode && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <div>
                                            <h4 className="text-lg font-bold text-purple-800">Bulk Development Fund Entry</h4>
                                            <p className="text-sm text-slate-600">Add multiple members and save them together.</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button type="button" onClick={addBulkRow} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg shadow-md">+ Add Row</button>
                                            <button type="button" onClick={submitBulkRows} disabled={bulkSaving} className={`font-bold px-4 py-2 rounded-lg shadow-md ${bulkSaving ? 'bg-gray-400 text-gray-200 cursor-not-allowed' : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700'}`}>
                                                {bulkSaving ? 'Saving...' : 'Save All'}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-sm text-slate-700">
                                            <thead className="bg-purple-100 text-purple-800 text-xs uppercase font-bold">
                                                <tr>
                                                    <th className="px-3 py-2 text-left">Member / ID</th>
                                                    <th className="px-3 py-2 text-left">Date</th>
                                                    <th className="px-3 py-2 text-left">Amount</th>
                                                    <th className="px-3 py-2 text-left">Payment Method</th>
                                                    <th className="px-3 py-2 text-left">Note</th>
                                                    <th className="px-3 py-2 text-right">Remove</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-purple-100">
                                                {bulkRows.map(row => {
                                                    const inlineDuplicate = row.memberId && row.date && (
                                                        entries.some(en => !en.deleted && en.type === 'development-fund' && en.memberID === row.memberId && en.date === row.date) ||
                                                        bulkRows.some(other => other.id !== row.id && other.memberId === row.memberId && other.date === row.date)
                                                    );
                                                    return (
                                                        <tr key={row.id} className="bg-white hover:bg-purple-50 transition">
                                                            <td className="px-3 py-2 align-top">
                                                                <input
                                                                    list="devfund-bulk-members"
                                                                    value={row.memberInput}
                                                                    onChange={e => handleBulkMemberChange(row.id, e.target.value)}
                                                                    placeholder="Type name or member #"
                                                                    className="w-full border-2 border-slate-200 rounded-md p-2 text-sm focus:border-purple-400 focus:ring-purple-200"
                                                                />
                                                                <p className="text-[11px] text-slate-500 mt-1">Pick from suggestions to link member.</p>
                                                            </td>
                                                            <td className="px-3 py-2 align-top">
                                                                <input
                                                                    type="date"
                                                                    value={row.date}
                                                                    onChange={e => updateBulkRow(row.id, { date: e.target.value })}
                                                                    className="w-full border-2 border-slate-200 rounded-md p-2 text-sm focus:border-purple-400 focus:ring-purple-200"
                                                                />
                                                            </td>
                                                            <td className="px-3 py-2 align-top">
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={row.amount}
                                                                    onChange={e => updateBulkRow(row.id, { amount: e.target.value })}
                                                                    placeholder="0.00"
                                                                    className="w-full border-2 border-slate-200 rounded-md p-2 text-sm font-bold text-right text-green-700 focus:border-green-400 focus:ring-green-200"
                                                                />
                                                                {inlineDuplicate && (
                                                                    <div className="text-xs text-red-600 font-semibold mt-1">⚠️ Duplicate exists for this member/date</div>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2 align-top">
                                                                <select
                                                                    value={row.method}
                                                                    onChange={e => updateBulkRow(row.id, { method: e.target.value as Method })}
                                                                    className="w-full border-2 border-slate-200 rounded-md p-2 text-sm focus:border-blue-400 focus:ring-blue-200"
                                                                >
                                                                    <option value="cash">Cash</option>
                                                                    <option value="e-transfer">E-Transfer</option>
                                                                    <option value="check">Check</option>
                                                                    <option value="other">Other</option>
                                                                </select>
                                                            </td>
                                                            <td className="px-3 py-2 align-top">
                                                                <input
                                                                    type="text"
                                                                    value={row.note}
                                                                    onChange={e => updateBulkRow(row.id, { note: e.target.value })}
                                                                    placeholder="Optional note"
                                                                    className="w-full border-2 border-slate-200 rounded-md p-2 text-sm focus:border-purple-400 focus:ring-purple-200"
                                                                />
                                                            </td>
                                                            <td className="px-3 py-2 align-top text-right">
                                                                <button type="button" onClick={() => removeBulkRow(row.id)} className="text-red-500 hover:text-red-700 font-bold text-lg">×</button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                        <datalist id="devfund-bulk-members">
                                            {pledgedMembers.slice(0, 400).map(m => (
                                                <React.Fragment key={m.id}>
                                                    <option value={m.name} />
                                                    {m.memberNumber && <option value={m.memberNumber} />}
                                                </React.Fragment>
                                            ))}
                                        </datalist>
                                    </div>
                                    <div className="text-xs text-slate-500 font-medium">
                                        Save All will validate against duplicates and directory rules before pushing to the cloud.
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-4 bg-slate-50 rounded-b-2xl border-t border-slate-200 flex justify-end">
                            <button onClick={() => setIsEntryModalOpen(false)} className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-lg transition-all">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
                        <h4 className="text-lg font-bold mb-2 text-red-700">Confirm Delete Entry</h4>
                        <p className="mb-2">Please provide a reason for deleting this entry:</p>
                        <textarea className="w-full border-2 border-slate-300 rounded-lg p-2 mb-2" rows={3} value={deleteReason} onChange={e => setDeleteReason(e.target.value)} />
                        {deleteError && <div className="text-red-600 text-sm mb-2">{deleteError}</div>}
                        <div className="flex gap-3 justify-end mt-2">
                            <button onClick={handleCancelDelete} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg">Cancel</button>
                            <button onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg">Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Deletion Log Section */}
            {deletionLog.length > 0 && (
                <div className="fixed bottom-24 right-6 bg-white rounded-xl shadow-lg border-2 border-slate-300 p-4 max-w-md max-h-60 overflow-y-auto z-40">
                    <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Deleted Entries Log
                    </h4>
                    <ul className="text-xs text-slate-600 space-y-1">
                        {deletionLog.map(log => (
                            <li key={`${log.id}-${log.deletedAt}`} className="border-l-2 border-red-400 pl-2 py-1">
                                <div><span className="font-semibold">ID:</span> {log.id.substring(0, 8)}...</div>
                                <div><span className="font-semibold">By:</span> {log.deletedBy} | <span className="font-semibold">At:</span> {new Date(log.deletedAt).toLocaleString()}</div>
                                <div><span className="font-semibold">Reason:</span> {log.reason}</div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Edit Entry Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
                        <h2 className="text-xl font-bold text-purple-700 mb-4">Edit Contribution Entry</h2>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Date</label>
                                <input 
                                    type="date" 
                                    value={editDate} 
                                    onChange={e => setEditDate(e.target.value)} 
                                    className="w-full border-2 border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-400 focus:border-purple-400"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Amount</label>
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    value={editAmount} 
                                    onChange={e => setEditAmount(e.target.value)} 
                                    className="w-full border-2 border-green-300 rounded-lg p-2 text-right font-bold text-green-700 focus:ring-2 focus:ring-green-400 focus:border-green-400"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Payment Method</label>
                                <select 
                                    value={editMethod} 
                                    onChange={e => setEditMethod(e.target.value as Method)} 
                                    className="w-full border-2 border-blue-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                                >
                                    <option value="cash">Cash</option>
                                    <option value="e-transfer">E-Transfer</option>
                                    <option value="check">Check</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Payment For (Month)</label>
                                <input 
                                    type="month" 
                                    value={editPaymentMonth} 
                                    onChange={e => {setEditPaymentMonth(e.target.value); if (!editDesc || editDesc === generatePaymentDescription(editPaymentMonth)) { setEditDesc(generatePaymentDescription(e.target.value)); }}} 
                                    className="w-full border-2 border-orange-300 rounded-lg p-2 focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Description/Note</label>
                                <textarea 
                                    value={editDesc} 
                                    onChange={e => setEditDesc(e.target.value)} 
                                    rows={3}
                                    className="w-full border-2 border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 mt-6">
                            <button 
                                onClick={saveEdit} 
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-lg transition"
                            >
                                Save
                            </button>
                            <button 
                                onClick={cancelEdit} 
                                className="flex-1 bg-slate-400 hover:bg-slate-500 text-white font-bold py-2 rounded-lg transition"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DevelopmentFund;
