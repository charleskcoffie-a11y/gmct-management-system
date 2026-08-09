import React, { useState, useMemo, useEffect } from 'react';
import { useToast } from './ToastProvider';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { Entry, Member, Settings, SyncStatus, User } from '../types';
import { formatCurrency, getTodayEST, getNowEST } from '../utils';
import { markEntryAsDeletedInSupabase, logEntryDeletionToSupabase, saveEntryToSupabase, loadEntriesFromSupabase, getSupabaseClient } from '../services/supabase';

interface HarvestProps {
    members: Member[];
    entries: Entry[];
    setEntries: React.Dispatch<React.SetStateAction<Entry[]>>;
    settings: Settings;
    currentUser?: User | null;
    syncStatus?: SyncStatus;
    onCreatePledges?: (pledges: Entry[]) => void;
}

const Harvest: React.FC<HarvestProps> = ({ members, entries, setEntries, settings, currentUser, syncStatus, onCreatePledges }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
    const [selectedDateForModal, setSelectedDateForModal] = useState<string | null>(null);
    const [modalClassFilter, setModalClassFilter] = useState<string>('all');
    
    // Filters
    const [startDateFilter, setStartDateFilter] = useState('');
    const [endDateFilter, setEndDateFilter] = useState('');
    const [classFilter, setClassFilter] = useState('all');
    const [searchFilter, setSearchFilter] = useState('');
    const [showDeleted, setShowDeleted] = useState(false);
    const [showDuplicatesPanel, setShowDuplicatesPanel] = useState(false);
    const [showSummary, setShowSummary] = useState(true);
    const [acceptedDuplicateKeys, setAcceptedDuplicateKeys] = useLocalStorage<string[]>('gmct-harvest-accepted-duplicates', []);
    const [collapsedYears, setCollapsedYears] = useState<Set<string>>(new Set());
    const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
    
    // Delete state
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleteReason, setDeleteReason] = useState('');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    // Harvest types to filter
    const harvestTypes = ['harvest-levy', 'harvest', 'harvest-pledge', 'harvest-launch', 'womens-harvest', 'mens-harvest', 'youth-harvest', 'youth-harvest-levy'] as const;

    // Form state
    const [formData, setFormData] = useState<Entry>({
        id: '',
        date: getTodayEST(),
        memberID: '',
        memberName: '',
        classNumber: '',
        type: 'harvest-levy',
        fund: 'harvest',
        method: 'cash',
        amount: 0,
        note: '',
        createdAt: getNowEST()
    });
    const harvestCategories = [
        { value: 'harvest-levy', label: 'Harvest Levy' },
        { value: 'mens-harvest', label: "Men's Harvest" },
        { value: 'womens-harvest', label: "Women's Harvest" },
        { value: 'youth-harvest-levy', label: 'Youth Harvest Levy' },
        { value: 'youth-harvest', label: 'Youth Harvest' },
        { value: 'harvest', label: 'Harvest Sales' },
        { value: 'harvest-pledge', label: 'Harvest Pledge' },
        { value: 'harvest-launch', label: 'Harvest Launch' }
    ];
    const predefinedGroupOptions = ['Men', 'Women', 'Youth', 'Dayborn Special'];
    const [amountInput, setAmountInput] = useState('');
    const [memberNumberInput, setMemberNumberInput] = useState('');
    const [groupSelection, setGroupSelection] = useState('');

    const membersMap = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);
    // Require browser online state AND valid Supabase credentials AND synced status
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : false;
    const isConnected = isOnline && !!settings.supabaseUrl && !!settings.supabaseKey && syncStatus?.state === 'synced';

    // Filtered entries - get only harvest-type entries from entries table
    const filteredEntries = useMemo(() => {
        return entries.filter(entry => {
            // Only include harvest-related types
            if (!harvestTypes.includes(entry.type as any)) return false;
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
        const groups: Record<string, Entry[]> = {};
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

    const groupedDates = useMemo(() => {
        const groups: Array<{
            year: string;
            months: Array<{
                monthKey: string;
                monthLabel: string;
                dates: string[];
                total: number;
                count: number;
            }>;
        }> = [];

        const byYear = new Map<string, Map<string, string[]>>();

        sortedDates.forEach(date => {
            const [year, month] = date.split('-');
            if (!byYear.has(year)) {
                byYear.set(year, new Map());
            }
            const months = byYear.get(year)!;
            if (!months.has(month)) {
                months.set(month, []);
            }
            months.get(month)!.push(date);
        });

        Array.from(byYear.entries())
            .sort(([a], [b]) => b.localeCompare(a))
            .forEach(([year, months]) => {
                const monthGroups = Array.from(months.entries())
                    .sort(([a], [b]) => b.localeCompare(a))
                    .map(([month, dates]) => {
                        const monthLabel = new Date(`${year}-${month}-01T00:00:00`).toLocaleDateString('en-US', {
                            month: 'long',
                            year: 'numeric'
                        });
                        const total = dates.reduce((sum, date) => {
                            const dayEntries = entriesByDate[date] || [];
                            return sum + dayEntries.filter(entry => !entry.deleted).reduce((daySum, entry) => daySum + entry.amount, 0);
                        }, 0);
                        const count = dates.reduce((sum, date) => sum + (entriesByDate[date]?.length || 0), 0);

                        return {
                            monthKey: `${year}-${month}`,
                            monthLabel,
                            dates,
                            total,
                            count,
                        };
                    });

                groups.push({ year, months: monthGroups });
            });

        return groups;
    }, [entriesByDate, sortedDates]);

    const getNormalizedTokens = (value: string) =>
        (value || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim()
            .split(/\s+/)
            .filter(Boolean);

    const getHarvestSummaryKey = (entry: Entry) => {
        const rawType = (entry.type || '').toLowerCase();

        // Explicitly-typed entries always map to their own category — never re-classify by note/group
        if (rawType === 'harvest-launch') return 'harvest-launch';
        if (rawType === 'harvest-levy') return 'harvest-levy';
        if (rawType === 'harvest-pledge') return 'harvest-pledge';
        if (rawType === 'womens-harvest') return 'womens-harvest';
        if (rawType === 'mens-harvest') return 'mens-harvest';
        if (rawType === 'youth-harvest-levy') return 'youth-harvest-levy';
        if (rawType === 'youth-harvest') return 'youth-harvest';

        // Generic 'harvest' type: sub-classify by note/group/fund
        const rawNote = (entry.note || '').toLowerCase();
        const rawGroup = (entry.groupName || '').toLowerCase();
        const rawFund = (entry.fund || '').toLowerCase();
        const combinedTokens = [
            ...getNormalizedTokens(rawNote),
            ...getNormalizedTokens(rawGroup),
            ...getNormalizedTokens(rawFund)
        ];
        if (combinedTokens.includes('womens') || combinedTokens.includes('women')) return 'womens-harvest';
        if (combinedTokens.includes('mens') || combinedTokens.includes('men')) return 'mens-harvest';
        if (combinedTokens.includes('youth') && combinedTokens.includes('levy')) return 'youth-harvest-levy';
        if (combinedTokens.includes('youth')) return 'youth-harvest';

        return entry.type;
    };

    const isHarvestEntryLike = (entry: Entry) => {
        const rawType = (entry.type || '').toLowerCase();
        const rawNote = (entry.note || '').toLowerCase();
        const rawGroup = (entry.groupName || '').toLowerCase();
        const rawFund = (entry.fund || '').toLowerCase();
        const combinedText = `${rawType} ${rawNote} ${rawGroup} ${rawFund}`;
        const combinedTokens = getNormalizedTokens(combinedText);

        if (harvestTypes.includes(rawType as any)) return true;
        if (['womens-harvest', 'mens-harvest', 'youth-harvest', 'youth-harvest-levy'].some(type => combinedTokens.includes(type.replace(/-/g, '')))) return true;
        return ['harvest', 'levy', 'pledge', 'launch'].some(keyword => combinedTokens.includes(keyword));
    };

    const getDuplicateGroupKey = (entry: Entry) => {
        const memberKey = entry.memberID || (entry.memberName || '').trim().toLowerCase();
        return `${entry.date}__${entry.type}__${memberKey}`;
    };

    useEffect(() => {
        if (!entries.length) return;

        const reactivationTargets = entries.filter(entry => {
            if (!harvestTypes.includes(entry.type as any)) return false;
            if (!entry.deleted) return false;
            const isAcceptedDuplicate = entry.deletedReason === 'Accepted as duplicate' || entry.deletedReason?.includes('Accepted as duplicate');
            const isInAcceptedList = acceptedDuplicateKeys.includes(getDuplicateGroupKey(entry));
            return isAcceptedDuplicate || isInAcceptedList;
        });

        if (reactivationTargets.length === 0) return;

        const restoreEntries = async () => {
            const restoredEntries = entries.map(entry => {
                const target = reactivationTargets.find(item => item.id === entry.id);
                if (!target) return entry;
                return {
                    ...entry,
                    deleted: false,
                    deletedReason: undefined,
                    deletedBy: undefined,
                    deletedAt: undefined,
                };
            });

            setEntries(restoredEntries);

            if (settings.supabaseUrl && settings.supabaseKey && syncStatus?.state === 'synced') {
                for (const entry of reactivationTargets) {
                    const savedEntry = {
                        ...entry,
                        deleted: false,
                        deletedReason: undefined,
                        deletedBy: undefined,
                        deletedAt: undefined,
                    };
                    await saveEntryToSupabase(settings.supabaseUrl, settings.supabaseKey, savedEntry);
                }
            }
        };

        void restoreEntries();
    }, [acceptedDuplicateKeys, entries, settings.supabaseUrl, settings.supabaseKey, syncStatus?.state]);

    // Summary totals for currently applied filters (independent of showDeleted toggle)
    const summary = useMemo(() => {
        const matchingEntries = entries.filter(entry => {
            if (!harvestTypes.includes(entry.type as any)) return false;
            if (searchFilter && !entry.memberName.toLowerCase().includes(searchFilter.toLowerCase())) return false;
            if (startDateFilter && entry.date < startDateFilter) return false;
            if (endDateFilter && entry.date > endDateFilter) return false;

            const member = membersMap.get(entry.memberID);
            const entryClass = entry.classNumber || member?.classNumber;
            if (classFilter !== 'all' && entryClass !== classFilter) return false;
            return true;
        });

        const activeEntries = matchingEntries.filter(e => !e.deleted);
        const deletedEntries = matchingEntries.filter(e => e.deleted);
        const activeTotal = activeEntries.reduce((sum, e) => sum + e.amount, 0);
        const deletedTotal = deletedEntries.reduce((sum, e) => sum + e.amount, 0);
        const activeByType = activeEntries.reduce((acc, entry) => {
            const key = getHarvestSummaryKey(entry);
            acc[key] = (acc[key] || 0) + entry.amount;
            return acc;
        }, {} as Record<string, number>);

        return {
            activeTotal,
            deletedTotal,
            grossTotal: activeTotal + deletedTotal,
            activeCount: activeEntries.length,
            deletedCount: deletedEntries.length,
            activeByType,
        };
    }, [entries, harvestTypes, searchFilter, startDateFilter, endDateFilter, classFilter, membersMap]);

    const duplicateGroups = useMemo(() => {
        const activeHarvestEntries = entries.filter(entry => harvestTypes.includes(entry.type as any) && !entry.deleted);
        const groups = new Map<string, Entry[]>();

        activeHarvestEntries.forEach(entry => {
            const key = getDuplicateGroupKey(entry);
            const current = groups.get(key) || [];
            current.push(entry);
            groups.set(key, current);
        });

        return Array.from(groups.entries())
            .filter(([, group]) => group.length > 1)
            .filter(([key]) => !acceptedDuplicateKeys.includes(key))
            .map(([key, group]) => ({ key, entries: group }))
            .sort((a, b) => b.entries[0].date.localeCompare(a.entries[0].date));
    }, [entries, acceptedDuplicateKeys]);

    const handleOpenModal = (entry: Entry | null = null) => {
        if (!isConnected) {
            alert('Writes are disabled until connected to the cloud. Please ensure Supabase is configured and the app shows Connected.');
            return;
        }
        if (entry) {
            setFormData(entry);
            setAmountInput(String(entry.amount));
            const member = members.find(m => m.id === entry.memberID);
            setMemberNumberInput(member?.memberNumber || '');
            setGroupSelection(entry.note && !predefinedGroupOptions.includes(entry.note) ? '__other__' : (entry.note || ''));
        } else {
            setFormData({
                id: crypto.randomUUID(),
                date: getTodayEST(),
                memberID: '',
                memberName: '',
                classNumber: '',
                type: 'harvest-levy',
                fund: 'harvest',
                method: 'cash',
                amount: 0,
                note: '',
                createdBy: currentUser?.username,
                createdAt: getNowEST()
            });
            setAmountInput('');
            setMemberNumberInput('');
            setGroupSelection('');
        }
        setSelectedEntry(entry);
        setIsModalOpen(true);
    };

    const { showToast, showConfirm } = useToast();
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isConnected) {
            showToast('Requires cloud connection to save', 'warning');
            return;
        }
        if (!formData.memberID || formData.amount <= 0) {
            showToast('Please select a member and enter a valid amount', 'warning');
            return;
        }

        if (!settings.supabaseUrl || !settings.supabaseKey) {
            showToast('Supabase is not configured for Harvest saves', 'error');
            return;
        }

        const entryToSave = selectedEntry
            ? { ...formData, updatedBy: currentUser?.username, lastUpdated: getNowEST() }
            : formData;

        // First guard: local duplicate check in currently loaded entries.
        const localDuplicate = entries.some(existing => {
            if (existing.deleted) return false;
            if (!harvestTypes.includes(existing.type as any)) return false;
            if (existing.date !== entryToSave.date) return false;
            if (existing.type !== entryToSave.type) return false;
            if (existing.memberID !== entryToSave.memberID) return false;
            if (existing.id === entryToSave.id) return false;
            if (existing.amount !== entryToSave.amount) return false;
            return true;
        });

        if (localDuplicate) {
            showToast('Possible duplicate detected. It will be flagged for verification instead of being blocked.', 'warning');
        }

        try {
            // Second guard: cloud duplicate check to avoid race conditions / stale local cache.
            const supabase = getSupabaseClient(settings.supabaseUrl, settings.supabaseKey);
            if (!supabase) {
                showToast('Supabase connection is invalid. Cannot validate duplicates.', 'error');
                return;
            }

            const { data: dbPotentialDupes, error: dupeCheckError } = await supabase
                .from('entries')
                .select('id, amount, note, group_name')
                .eq('date', entryToSave.date)
                .eq('type', entryToSave.type)
                .eq('member_id', entryToSave.memberID)
                .or('deleted.is.null,deleted.eq.false')
                .limit(10);

            if (dupeCheckError) {
                showToast(`Duplicate check failed: ${dupeCheckError.message}`, 'error');
                return;
            }

            const dbHasDuplicate = (dbPotentialDupes || []).some(row => {
                if (row.id === entryToSave.id) return false;
                return Number(row.amount) === Number(entryToSave.amount);
            });
            if (dbHasDuplicate) {
                showToast('Possible duplicate detected in the cloud record. It has been flagged for verification.', 'warning');
            }

            await saveEntryToSupabase(settings.supabaseUrl, settings.supabaseKey, entryToSave);
            const updatedEntries = await loadEntriesFromSupabase(settings.supabaseUrl, settings.supabaseKey);
            setEntries(updatedEntries);
            setIsModalOpen(false);
            showToast('Harvest entry saved successfully', 'success');
        } catch (error: any) {
            showToast(`Failed to save harvest entry: ${error.message}`, 'error');
        }
    };

    const handleVerifyAndAcceptDuplicateGroup = async (group: { key: string; entries: Entry[] }) => {
        if (!group.entries.length) return;

        try {
            const updatedEntries = group.entries.map(entry => ({
                ...entry,
                deleted: false,
                deletedReason: undefined,
                deletedBy: undefined,
                deletedAt: undefined,
            }));

            if (settings.supabaseUrl && settings.supabaseKey && syncStatus?.state === 'synced') {
                for (const entry of updatedEntries) {
                    await saveEntryToSupabase(settings.supabaseUrl, settings.supabaseKey, entry);
                }
                const refreshedEntries = await loadEntriesFromSupabase(settings.supabaseUrl, settings.supabaseKey);
                setEntries(refreshedEntries);
            } else {
                setEntries(prev => prev.map(item => {
                    const matching = updatedEntries.find(entry => entry.id === item.id);
                    return matching ? { ...item, ...matching } : item;
                }));
            }

            setAcceptedDuplicateKeys(prev => prev.includes(group.key) ? prev : [...prev, group.key]);
            showToast('Duplicate group verified and accepted. Both contributions remain active and are included in the totals.', 'success');
        } catch (error: any) {
            showToast(`Failed to resolve duplicate group: ${error.message}`, 'error');
        }
    };

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

    const confirmDelete = async () => {
        if (!deleteId) return;
        if (!settings.supabaseUrl || !settings.supabaseKey || syncStatus?.state !== 'synced') {
            setDeleteError('Writes are disabled until connected to the cloud.');
            return;
        }

        const entry = entries.find(e => e.id === deleteId);
        if (!entry) {
            setDeleteError('Entry not found');
            return;
        }

        try {
            // Mark as deleted in Supabase
            await markEntryAsDeletedInSupabase(
                settings.supabaseUrl,
                settings.supabaseKey,
                deleteId,
                (typeof currentUser === 'object' && currentUser?.username) ? currentUser.username : 'Unknown',
                deleteReason
            );
            
            // Log the deletion
            await logEntryDeletionToSupabase(
                settings.supabaseUrl,
                settings.supabaseKey,
                entry,
                (typeof currentUser === 'object' && currentUser?.username) ? currentUser.username : 'Unknown',
                deleteReason
            );

            // Update local state
            setEntries(prev => prev.map(e => e.id === deleteId ? {
                ...e,
                deleted: true,
                deletedReason: deleteReason,
                deletedBy: (typeof currentUser === 'object' && currentUser?.username) ? currentUser.username : 'Unknown',
                deletedAt: getNowEST(),
            } : e));

            showToast('Entry deleted successfully', 'success');
            setShowDeleteModal(false);
            setDeleteId(null);
            setDeleteReason('');
        } catch (error: any) {
            setDeleteError(`Failed to delete: ${error.message}`);
        }
    };

    const cancelDelete = () => {
        setShowDeleteModal(false);
        setDeleteId(null);
        setDeleteReason('');
        setDeleteError('');
    };

    const toggleYear = (year: string) => {
        setCollapsedYears(prev => {
            const next = new Set(prev);
            if (next.has(year)) next.delete(year);
            else next.add(year);
            return next;
        });
    };

    const toggleMonth = (monthKey: string) => {
        setCollapsedMonths(prev => {
            const next = new Set(prev);
            if (next.has(monthKey)) next.delete(monthKey);
            else next.add(monthKey);
            return next;
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
                    <div className="flex gap-3">
                        {currentUser?.role !== 'pastor' && (
                            <button onClick={() => handleOpenModal()} disabled={!isConnected} title={!isConnected ? 'Requires cloud connection to add records' : undefined} className={`bg-gradient-to-br from-amber-400 to-orange-400 text-white font-bold py-4 px-8 rounded-xl shadow-lg text-base flex items-center gap-3 group transition-all ${!isConnected ? 'opacity-60 cursor-not-allowed' : 'hover:from-amber-500 hover:to-orange-500 hover:scale-105'}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 group-hover:rotate-90 transition-transform" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                </svg>
                                Record Harvest
                            </button>
                        )}
                        <button onClick={() => (window as any).GMCTNavigateTab && (window as any).GMCTNavigateTab('harvest-pledges')} className="bg-gradient-to-br from-indigo-500 to-fuchsia-600 text-white font-bold py-4 px-8 rounded-xl shadow-lg text-base flex items-center gap-3 group transition-all hover:from-indigo-600 hover:to-fuchsia-700 hover:scale-105">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h8a1 1 0 01.894.553l3 6A1 1 0 0115 11H9.618l.447 2.236A1 1 0 019.09 14H7a1 1 0 110-2h1.382l-.724-3.618A1 1 0 006.676 8H4a1 1 0 01-1-1V4z" clipRule="evenodd" /></svg>
                            Harvest Pledges
                        </button>
                    </div>
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
            <div className="bg-gradient-to-br from-amber-300 to-orange-400 p-6 rounded-xl shadow-lg border-2 border-amber-200">
                <button type="button" onClick={() => setShowSummary(prev => !prev)} className="w-full text-left">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="text-white font-bold text-sm uppercase tracking-wider">🌾 Harvest Final Total (Excludes Deleted)</h3>
                            <p className="text-4xl font-bold text-white mt-2 drop-shadow">{formatCurrency(summary.activeTotal, settings.currency)}</p>
                            <p className="text-amber-50 text-sm mt-1 font-semibold">Active: {summary.activeCount} contribution{summary.activeCount !== 1 ? 's' : ''}</p>
                        </div>
                        <span className="text-2xl font-bold text-white/90">{showSummary ? '−' : '+'}</span>
                    </div>
                </button>
                {showSummary && (
                    <div className="mt-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="bg-white/20 rounded-lg p-2 text-white">
                                <div className="font-bold uppercase tracking-wide">Deleted</div>
                                <div className="text-sm font-bold">{formatCurrency(summary.deletedTotal, settings.currency)}</div>
                                <div>{summary.deletedCount} record{summary.deletedCount !== 1 ? 's' : ''}</div>
                            </div>
                            <div className="bg-white/20 rounded-lg p-2 text-white">
                                <div className="font-bold uppercase tracking-wide">Gross</div>
                                <div className="text-sm font-bold">{formatCurrency(summary.grossTotal, settings.currency)}</div>
                                <div>For audit only</div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-8 gap-2 text-xs">
                            <div className="bg-white/20 rounded-lg p-2 text-white">
                                <div className="font-bold uppercase tracking-wide">Harvest Levy</div>
                                <div className="text-sm font-bold">{formatCurrency(summary.activeByType['harvest-levy'] || 0, settings.currency)}</div>
                            </div>
                            <div className="bg-white/20 rounded-lg p-2 text-white">
                                <div className="font-bold uppercase tracking-wide">Men's Harvest</div>
                                <div className="text-sm font-bold">{formatCurrency(summary.activeByType['mens-harvest'] || 0, settings.currency)}</div>
                            </div>
                            <div className="bg-white/20 rounded-lg p-2 text-white">
                                <div className="font-bold uppercase tracking-wide">Women's Harvest</div>
                                <div className="text-sm font-bold">{formatCurrency(summary.activeByType['womens-harvest'] || 0, settings.currency)}</div>
                            </div>
                            <div className="bg-white/20 rounded-lg p-2 text-white">
                                <div className="font-bold uppercase tracking-wide">Youth Harvest Levy</div>
                                <div className="text-sm font-bold">{formatCurrency(summary.activeByType['youth-harvest-levy'] || 0, settings.currency)}</div>
                            </div>
                            <div className="bg-white/20 rounded-lg p-2 text-white">
                                <div className="font-bold uppercase tracking-wide">Youth Harvest</div>
                                <div className="text-sm font-bold">{formatCurrency(summary.activeByType['youth-harvest'] || 0, settings.currency)}</div>
                            </div>
                            <div className="bg-white/20 rounded-lg p-2 text-white">
                                <div className="font-bold uppercase tracking-wide">Harvest Launch</div>
                                <div className="text-sm font-bold">{formatCurrency(summary.activeByType['harvest-launch'] || 0, settings.currency)}</div>
                            </div>
                            <div className="bg-white/20 rounded-lg p-2 text-white">
                                <div className="font-bold uppercase tracking-wide">Harvest Pledge</div>
                                <div className="text-sm font-bold">{formatCurrency(summary.activeByType['harvest-pledge'] || 0, settings.currency)}</div>
                            </div>
                            <div className="bg-white/20 rounded-lg p-2 text-white">
                                <div className="font-bold uppercase tracking-wide">Harvest</div>
                                <div className="text-sm font-bold">{formatCurrency(summary.activeByType['harvest'] || 0, settings.currency)}</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Duplicate Entries Audit */}
            <div className="bg-white rounded-xl shadow-lg border-2 border-red-200 overflow-hidden">
                <button
                    type="button"
                    onClick={() => setShowDuplicatesPanel(prev => !prev)}
                    className="w-full px-5 py-4 flex items-center justify-between bg-gradient-to-r from-red-50 to-rose-50 hover:from-red-100 hover:to-rose-100 transition-colors"
                >
                    <div className="text-left">
                        <div className="text-sm font-bold uppercase tracking-wide text-red-700">Duplicate Entries (Cloud Data)</div>
                        <div className="text-xs text-red-600">Same member + same date + same category</div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-red-700">
                            {duplicateGroups.length} group{duplicateGroups.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-xs font-bold text-red-700">{showDuplicatesPanel ? 'Hide' : 'Show'}</span>
                    </div>
                </button>

                {showDuplicatesPanel && (
                    <div className="p-4 space-y-3 bg-red-50/40">
                        {duplicateGroups.length === 0 ? (
                            <div className="text-sm text-slate-600">No duplicates found.</div>
                        ) : (
                            duplicateGroups.map(group => {
                                const lead = group.entries[0];
                                const groupTotal = group.entries.reduce((sum, e) => sum + e.amount, 0);
                                const canFix = !!currentUser && ['admin', 'finance-chair', 'finance-team'].includes(currentUser.role);
                                const canVerify = currentUser?.role === 'admin';

                                return (
                                    <div key={group.key} className="rounded-lg border border-red-200 bg-white p-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="text-sm font-bold text-slate-800">{lead.memberName}</div>
                                                <div className="text-xs text-slate-600">
                                                    {lead.date} • {lead.type.replace(/-/g, ' ')} • {group.entries.length} duplicates • Total {formatCurrency(groupTotal, settings.currency)}
                                                </div>
                                            </div>
                                            {canVerify && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleVerifyAndAcceptDuplicateGroup(group)}
                                                    className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded"
                                                    title="Verify and accept this duplicate group"
                                                >
                                                    ✓ Verify & Accept
                                                </button>
                                            )}
                                        </div>
                                        <div className="mt-2 space-y-1">
                                            {group.entries.map(entry => (
                                                <div key={entry.id} className="flex items-center justify-between text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1">
                                                    <span>
                                                        {formatCurrency(entry.amount, settings.currency)} • ID: {entry.id.slice(0, 8)} • By: {entry.createdBy || 'Unknown'}
                                                    </span>
                                                    {canFix && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenModal(entry)}
                                                            className="text-amber-700 hover:text-amber-900 font-bold"
                                                        >
                                                            Open
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>

            {/* Grouped List */}
            <div className="bg-white rounded-xl shadow-lg border-2 border-slate-200 overflow-hidden">
                {(currentUser?.role === 'admin' || currentUser?.role === 'finance-chair' || currentUser?.role === 'finance-team' || currentUser?.role === 'pastor') && (
                    <div className="bg-gradient-to-r from-red-100 to-pink-100 px-4 py-2 border-b-2 border-red-300 flex justify-end">
                        <label className="flex items-center gap-2 text-xs font-bold uppercase text-red-700 cursor-pointer">
                            <input type="checkbox" checked={showDeleted} onChange={e => setShowDeleted(e.target.checked)} className="rounded border-red-300 text-red-600 focus:ring-red-500"/>
                            🗑️ Show Deleted Records
                        </label>
                    </div>
                )}
                <div className="max-h-[60vh] overflow-y-auto p-6 space-y-4">
                    {groupedDates.length === 0 ? (
                        <div className="text-center py-16 text-slate-400">
                            <div className="text-6xl mb-4">📭</div>
                            <p className="text-xl font-bold">No harvest records found</p>
                            <p className="text-sm mt-2">Try adjusting your filters</p>
                        </div>
                    ) : (
                        groupedDates.map(yearGroup => (
                            <div key={yearGroup.year} className="space-y-4">
                                <button
                                    type="button"
                                    onClick={() => toggleYear(yearGroup.year)}
                                    className="sticky top-0 z-10 w-full bg-slate-100/95 backdrop-blur rounded-xl border border-slate-200 px-4 py-3 shadow-sm flex items-center justify-between text-left hover:bg-slate-200/95 transition-colors"
                                >
                                    <h3 className="text-xl font-bold text-slate-800">{yearGroup.year}</h3>
                                    <span className="text-sm font-bold text-slate-600 flex items-center gap-2">
                                        {collapsedYears.has(yearGroup.year) ? 'Expand' : 'Collapse'}
                                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform ${collapsedYears.has(yearGroup.year) ? '' : 'rotate-180'}`} viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </span>
                                </button>
                                {!collapsedYears.has(yearGroup.year) && yearGroup.months.map(monthGroup => (
                                    <div key={monthGroup.monthKey} className="space-y-3">
                                        <button
                                            type="button"
                                            onClick={() => toggleMonth(monthGroup.monthKey)}
                                            className="w-full flex items-center justify-between rounded-xl bg-gradient-to-r from-amber-100 to-orange-100 border border-amber-200 px-4 py-3 text-left hover:from-amber-200 hover:to-orange-200 transition-colors"
                                        >
                                            <div>
                                                <h4 className="text-lg font-bold text-amber-900">{monthGroup.monthLabel}</h4>
                                                <p className="text-sm font-medium text-amber-700">{monthGroup.count} contribution{monthGroup.count !== 1 ? 's' : ''}</p>
                                            </div>
                                            <div className="text-right flex items-center gap-4">
                                                <div className="text-lg font-bold text-green-700">{formatCurrency(monthGroup.total, settings.currency)}</div>
                                                <span className="text-sm font-bold text-amber-800 flex items-center gap-2">
                                                    {collapsedMonths.has(monthGroup.monthKey) ? 'Expand' : 'Collapse'}
                                                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform ${collapsedMonths.has(monthGroup.monthKey) ? '' : 'rotate-180'}`} viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                                    </svg>
                                                </span>
                                            </div>
                                        </button>
                                        {!collapsedMonths.has(monthGroup.monthKey) && monthGroup.dates.map(date => {
                                            const dateEntries = entriesByDate[date];
                                            const dateTotal = dateEntries.filter(e => !e.deleted).reduce((sum, e) => sum + e.amount, 0);
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
                                        })}
                                    </div>
                                ))}
                            </div>
                        ))
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
                                    <p className="text-amber-100 mt-1">{entriesByDate[selectedDateForModal].length} contribution{entriesByDate[selectedDateForModal].length !== 1 ? 's' : ''} • Active Total: {formatCurrency(entriesByDate[selectedDateForModal].filter(e => !e.deleted).reduce((sum, e) => sum + e.amount, 0), settings.currency)}</p>
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
                                    const canDelete = !entry.deleted && currentUser && (currentUser.role === 'admin' || currentUser.role === 'finance-chair');
                                    
                                    return (
                                        <div 
                                            key={entry.id} 
                                            className={`rounded-xl border-2 p-5 transition-all ${entry.deleted ? 'bg-red-50 border-red-200' : 'bg-gradient-to-r from-slate-50 to-amber-50 border-slate-200 hover:shadow-md'}`}
                                            title={`Created by: ${entry.createdBy || 'Unknown'}\nUpdated by: ${entry.updatedBy || 'Unknown'}`}
                                        >
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
                                                        <div className="col-span-2 text-xs text-slate-500 mt-1">
                                                            Created by: {entry.createdBy || 'Unknown'}{entry.updatedBy ? ` | Updated by: ${entry.updatedBy}` : ''}
                                                        </div>
                                                    </div>
                                                    {entry.deleted && (
                                                        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 space-y-1">
                                                            <div><span className="font-semibold">Deleted by:</span> {entry.deletedBy || 'Unknown'}</div>
                                                            <div><span className="font-semibold">Reason:</span> {entry.deletedReason || 'No reason provided'}</div>
                                                            <div>
                                                                <span className="font-semibold">Deleted at:</span>{' '}
                                                                {entry.deletedAt ? new Date(entry.deletedAt).toLocaleString() : 'Unknown'}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {entry.note && (
                                                        <div className="mt-2 text-sm text-slate-600 italic">
                                                            <span className="font-medium">Note:</span> {entry.note}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-right ml-4">
                                                    <div className="text-2xl font-bold text-green-600">{formatCurrency(entry.amount, settings.currency)}</div>
                                                    <div className="mt-2 flex items-center gap-3 justify-end">
                                                        {canEdit && (
                                                            <button 
                                                                onClick={() => { 
                                                                    if (!isConnected) { showToast('Requires cloud connection to edit', 'warning'); return; }
                                                                    handleOpenModal(entry);
                                                                    setSelectedDateForModal(null);
                                                                }} 
                                                                disabled={!isConnected}
                                                                title={!isConnected ? 'Requires cloud connection' : undefined}
                                                                className={`font-bold text-sm ${!isConnected ? 'text-amber-400 cursor-not-allowed' : 'text-amber-600 hover:text-amber-800 hover:underline'}`}
                                                            >
                                                                Edit
                                                            </button>
                                                        )}
                                                        {canDelete && (
                                                            <button
                                                                onClick={() => handleDelete(entry.id)}
                                                                className="text-sm font-bold text-red-600 hover:text-red-800 hover:underline"
                                                            >
                                                                Delete
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        
                        <div className="p-6 bg-slate-50 rounded-b-2xl border-t-2 border-slate-200 flex justify-between items-center">
                            <div className="text-sm text-slate-600">
                                <span className="font-bold">Active total for this date:</span> {formatCurrency(entriesByDate[selectedDateForModal].filter(e => !e.deleted).reduce((sum, e) => sum + e.amount, 0), settings.currency)}
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
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name</label>
                                            <input list="members-list" value={formData.memberName} onChange={handleMemberNameChange} placeholder="Search by first or last name..." className="w-full border-2 border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all" />
                                            <datalist id="members-list">
                                                {members.map(m => <option key={m.id} value={m.name} />)}
                                            </datalist>
                                        </div>
                                        <div className="md:col-span-1">
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Category</label>
                                            <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as Entry['type'] })} className="w-full border-2 border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all">
                                                {harvestCategories.map(cat => (
                                                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                                                ))}
                                            </select>
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
                                        Group (Optional)
                                    </label>
                                    {(() => {
                                        const current = formData.note || '';
                                        const showCustomGroupInput = groupSelection === '__other__';
                                        return (
                                            <div className="space-y-3">
                                                <select
                                                    value={groupSelection}
                                                    onChange={e => {
                                                        const value = e.target.value;
                                                        if (value === '__other__') {
                                                            setGroupSelection('__other__');
                                                            setFormData(prev => ({ ...prev, note: predefinedGroupOptions.includes(prev.note || '') ? '' : (prev.note || '') }));
                                                            return;
                                                        }
                                                        setGroupSelection(value);
                                                        setFormData(prev => ({ ...prev, note: value }));
                                                    }}
                                                    className="w-full border-2 border-slate-300 rounded-lg p-3 text-slate-700 font-semibold focus:ring-2 focus:ring-slate-400 focus:border-slate-400 transition-all bg-white"
                                                >
                                                    <option value="">None</option>
                                                    {predefinedGroupOptions.map(opt => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                    <option value="__other__">Other</option>
                                                </select>
                                                {showCustomGroupInput && (
                                                    <input
                                                        type="text"
                                                        value={current}
                                                        onChange={e => {
                                                            setGroupSelection('__other__');
                                                            setFormData(prev => ({ ...prev, note: e.target.value }));
                                                        }}
                                                        placeholder="Enter custom group"
                                                        className="w-full border-2 border-slate-300 rounded-lg p-3 text-slate-700 font-semibold focus:ring-2 focus:ring-slate-400 focus:border-slate-400 transition-all bg-white"
                                                    />
                                                )}
                                            </div>
                                        );
                                    })()}
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
                                    <button type="submit" disabled={!isConnected} title={!isConnected ? 'Requires cloud connection' : undefined} className={`bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-md ${!isConnected ? 'opacity-60 cursor-not-allowed' : 'hover:from-amber-600 hover:to-orange-600 hover:scale-105'}`}>Save</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                        <h2 className="text-xl font-bold text-red-700 mb-4">Delete Entry</h2>
                        
                        <p className="text-slate-600 mb-4">Are you sure you want to delete this harvest entry? This action is permanent.</p>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Reason for Deletion (Optional)</label>
                            <textarea
                                value={deleteReason}
                                onChange={e => setDeleteReason(e.target.value)}
                                rows={3}
                                placeholder="Enter reason for deletion..."
                                className="w-full border-2 border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-red-400 focus:border-red-400"
                            />
                        </div>

                        {deleteError && (
                            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3 mb-4">
                                <p className="text-red-700 text-sm font-semibold">{deleteError}</p>
                            </div>
                        )}

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={cancelDelete}
                                className="px-4 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-300 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
        </div>
    );
};

export default Harvest;
