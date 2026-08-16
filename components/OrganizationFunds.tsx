import React, { useEffect, useMemo, useState } from 'react';
import type { OrganizationFundOrganization, OrganizationFundTransaction, Settings, User } from '../types';
import { formatCurrency } from '../utils';
import { useToast } from './ToastProvider';
import {
    loadOrganizationFundOrganizations,
    loadOrganizationFundTransactions,
    saveOrganizationFundOrganization,
    saveOrganizationFundTransaction,
    deleteOrganizationFundTransaction,
    setOrganizationFundOrganizationActive,
} from '../services/supabase';

interface Props {
    settings: Settings;
    currentUser: User;
    canWrite: boolean;
}

const DEFAULT_ORGANIZATIONS = [
    'AMB',
    'Girls Fellowship',
    "Women's Fellowship",
    "Men's Fellowship",
    'Singing Band',
    'Choir',
    'CLB',
    'Children Ministries',
    'Guild',
    'SUWMA MYF',
];

const statusBadgeClass = (status: OrganizationFundTransaction['status']): string => {
    if (status === 'approved' || status === 'posted') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (status === 'pending') return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-rose-100 text-rose-800 border-rose-200';
};

const getOrganizationBalance = (entries: OrganizationFundTransaction[], organizationId: string): number => {
    return entries
        .filter((entry) => entry.organizationId === organizationId)
        .reduce((sum, entry) => {
            if (entry.type === 'deposit' && entry.status === 'posted') return sum + entry.amount;
            if (entry.type === 'withdrawal' && entry.status === 'approved') return sum - entry.amount;
            return sum;
        }, 0);
};

const OrganizationFunds: React.FC<Props> = ({ settings, currentUser, canWrite }) => {
    const { showConfirm } = useToast();
    const [organizations, setOrganizations] = useState<OrganizationFundOrganization[]>([]);
    const [entries, setEntries] = useState<OrganizationFundTransaction[]>([]);
    const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const [depositAmount, setDepositAmount] = useState<string>('');
    const [depositDate, setDepositDate] = useState<string>(new Date().toISOString().slice(0, 10));
    const [depositSubmittedBy, setDepositSubmittedBy] = useState<string>('');
    const [depositNote, setDepositNote] = useState<string>('');

    const [requestAmount, setRequestAmount] = useState<string>('');
    const [requestDate, setRequestDate] = useState<string>(new Date().toISOString().slice(0, 10));
    const [requestBy, setRequestBy] = useState<string>('');
    const [requestPurpose, setRequestPurpose] = useState<string>('');

    const [approvalSignatures, setApprovalSignatures] = useState<Record<string, string>>({});
    const [newOrganizationName, setNewOrganizationName] = useState<string>('');
    const [isHistoryCollapsed, setIsHistoryCollapsed] = useState<boolean>(true);
    const [isOrgSummaryCollapsed, setIsOrgSummaryCollapsed] = useState<boolean>(true);
    const [isManageOrganizationsCollapsed, setIsManageOrganizationsCollapsed] = useState<boolean>(true);
    const [isYearlySummaryCollapsed, setIsYearlySummaryCollapsed] = useState<boolean>(true);
    const [orgSortKey, setOrgSortKey] = useState<'name' | 'deposited' | 'withdrawn' | 'net' | 'pending'>('name');
    const [orgSortDirection, setOrgSortDirection] = useState<'asc' | 'desc'>('asc');
    const [editingEntry, setEditingEntry] = useState<OrganizationFundTransaction | null>(null);
    const [editingAmount, setEditingAmount] = useState<string>('');
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    const canUseCloud = !!settings.supabaseUrl && !!settings.supabaseKey;

    const refresh = async () => {
        if (!canUseCloud) {
            setErrorMessage('Supabase is not configured. Open Settings and set Supabase URL/Key.');
            return;
        }
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const [orgRows, txRows] = await Promise.all([
                loadOrganizationFundOrganizations(settings.supabaseUrl, settings.supabaseKey),
                loadOrganizationFundTransactions(settings.supabaseUrl, settings.supabaseKey),
            ]);

            const normalizedOrgs = orgRows.length > 0
                ? orgRows
                : DEFAULT_ORGANIZATIONS.map((name) => ({
                    id: crypto.randomUUID(),
                    name,
                    isActive: true,
                    createdBy: currentUser.username,
                    updatedBy: currentUser.username,
                } as OrganizationFundOrganization));

            setOrganizations(normalizedOrgs);
            setEntries(txRows);
            setSelectedOrganizationId((prev) => {
                if (prev && normalizedOrgs.some((org) => org.id === prev)) return prev;
                return normalizedOrgs[0]?.id || '';
            });

            if (orgRows.length === 0) {
                await Promise.all(normalizedOrgs.map((org) => saveOrganizationFundOrganization(settings.supabaseUrl, settings.supabaseKey, org)));
            }
        } catch (err: any) {
            setErrorMessage(err?.message || 'Failed to load organization funds data.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        refresh();
    }, [settings.supabaseUrl, settings.supabaseKey]);

    const selectedOrg = organizations.find((org) => org.id === selectedOrganizationId) || organizations[0] || null;

    const selectedOrgEntries = useMemo(
        () => entries
            .filter((entry) => selectedOrg && entry.organizationId === selectedOrg.id)
            .sort((a, b) => b.date.localeCompare(a.date)),
        [entries, selectedOrg]
    );

    const selectedOrgBalance = useMemo(
        () => selectedOrg ? getOrganizationBalance(entries, selectedOrg.id) : 0,
        [entries, selectedOrg]
    );

    const selectedOrgSummaryByYear = useMemo(() => {
        const grouped = new Map<string, {
            deposited: number;
            withdrawn: number;
            pending: number;
            rejected: number;
        }>();

        selectedOrgEntries.forEach((entry) => {
            const year = entry.date.slice(0, 4) || 'Unknown';
            const current = grouped.get(year) || { deposited: 0, withdrawn: 0, pending: 0, rejected: 0 };

            if (entry.type === 'deposit' && entry.status === 'posted') {
                current.deposited += entry.amount;
            }
            if (entry.type === 'withdrawal' && entry.status === 'approved') {
                current.withdrawn += entry.amount;
            }
            if (entry.type === 'withdrawal' && entry.status === 'pending') {
                current.pending += entry.amount;
            }
            if (entry.type === 'withdrawal' && entry.status === 'rejected') {
                current.rejected += entry.amount;
            }

            grouped.set(year, current);
        });

        return Array.from(grouped.entries())
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([year, totals]) => ({ year, ...totals, net: totals.deposited - totals.withdrawn }));
    }, [selectedOrgEntries]);

    const organizationContributionSummary = useMemo(() => {
        const rows = organizations.map((org) => {
            const orgEntries = entries.filter((entry) => entry.organizationId === org.id);
            const deposited = orgEntries.reduce((sum, entry) => (
                entry.type === 'deposit' && entry.status === 'posted' ? sum + entry.amount : sum
            ), 0);
            const withdrawn = orgEntries.reduce((sum, entry) => (
                entry.type === 'withdrawal' && entry.status === 'approved' ? sum + entry.amount : sum
            ), 0);
            const pending = orgEntries.reduce((sum, entry) => (
                entry.type === 'withdrawal' && entry.status === 'pending' ? sum + entry.amount : sum
            ), 0);

            return {
                id: org.id,
                name: org.name,
                deposited,
                withdrawn,
                pending,
                net: deposited - withdrawn,
            };
        });

        rows.sort((a, b) => {
            const direction = orgSortDirection === 'asc' ? 1 : -1;
            if (orgSortKey === 'name') return a.name.localeCompare(b.name) * direction;
            return ((a as any)[orgSortKey] - (b as any)[orgSortKey]) * direction;
        });

        return rows;
    }, [organizations, entries, orgSortKey, orgSortDirection]);

    const pendingRequests = useMemo(
        () => entries
            .filter((entry) => entry.type === 'withdrawal' && entry.status === 'pending')
            .sort((a, b) => b.date.localeCompare(a.date)),
        [entries]
    );

    const canManageOrganizations = currentUser.role === 'admin' || currentUser.role === 'finance-chair';

    const handleOrganizationSort = (key: 'name' | 'deposited' | 'withdrawn' | 'net' | 'pending') => {
        setOrgSortKey((prevKey) => {
            if (prevKey === key) {
                setOrgSortDirection((prev) => prev === 'asc' ? 'desc' : 'asc');
                return prevKey;
            }
            setOrgSortDirection(key === 'name' ? 'asc' : 'desc');
            return key;
        });
    };

    const addDeposit = async () => {
        if (!canWrite || !canUseCloud) return;
        const amount = Number.parseFloat(depositAmount);
        if (!selectedOrg) return alert('Select an organization first.');
        if (!Number.isFinite(amount) || amount <= 0) return alert('Enter a valid deposit amount.');
        if (!depositSubmittedBy.trim()) return alert('Enter who submitted the money.');

        const next: OrganizationFundTransaction = {
            id: crypto.randomUUID(),
            organizationId: selectedOrg.id,
            organizationNameSnapshot: selectedOrg.name,
            type: 'deposit',
            status: 'posted',
            amount,
            date: depositDate || new Date().toISOString().slice(0, 10),
            submittedBy: depositSubmittedBy.trim(),
            enteredBy: currentUser.username,
            note: depositNote.trim(),
            updatedAt: new Date().toISOString(),
        };

        await saveOrganizationFundTransaction(settings.supabaseUrl, settings.supabaseKey, next);
        await refresh();
        setDepositAmount('');
        setDepositSubmittedBy('');
        setDepositNote('');
    };

    const addWithdrawalRequest = async () => {
        if (!canWrite || !canUseCloud) return;
        const amount = Number.parseFloat(requestAmount);
        if (!selectedOrg) return alert('Select an organization first.');
        if (!Number.isFinite(amount) || amount <= 0) return alert('Enter a valid request amount.');
        if (!requestBy.trim()) return alert('Enter who is requesting the money.');

        const availableBalance = getOrganizationBalance(entries, selectedOrg.id);
        if (amount > availableBalance) {
            return alert(`Request amount exceeds available balance (${formatCurrency(availableBalance, settings.currency)}).`);
        }

        const next: OrganizationFundTransaction = {
            id: crypto.randomUUID(),
            organizationId: selectedOrg.id,
            organizationNameSnapshot: selectedOrg.name,
            type: 'withdrawal',
            status: 'pending',
            amount,
            date: requestDate || new Date().toISOString().slice(0, 10),
            submittedBy: requestBy.trim(),
            enteredBy: currentUser.username,
            note: requestPurpose.trim(),
            updatedAt: new Date().toISOString(),
        };

        await saveOrganizationFundTransaction(settings.supabaseUrl, settings.supabaseKey, next);
        await refresh();
        setRequestAmount('');
        setRequestBy('');
        setRequestPurpose('');
    };

    const approveRequest = async (request: OrganizationFundTransaction) => {
        if (!canWrite || !canUseCloud) return;
        const signature = (approvalSignatures[request.id] || '').trim();
        if (!signature) return alert('Signature name is required for approval.');

        const requester = request.submittedBy.toLowerCase();
        const enteredBy = request.enteredBy.toLowerCase();
        const approver = currentUser.username.toLowerCase();
        if (approver === requester || approver === enteredBy) {
            return alert('Another user must approve this request. Requester/entry user cannot self-approve.');
        }

        const availableBalance = getOrganizationBalance(entries, request.organizationId);
        if (request.amount > availableBalance) {
            return alert(`Cannot approve. Available balance is ${formatCurrency(availableBalance, settings.currency)}.`);
        }

        const updated: OrganizationFundTransaction = {
            ...request,
            status: 'approved',
            approvedBy: currentUser.username,
            approverSignatureName: signature,
            approvedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        await saveOrganizationFundTransaction(settings.supabaseUrl, settings.supabaseKey, updated);
        await refresh();
    };

    const rejectRequest = async (request: OrganizationFundTransaction) => {
        if (!canWrite || !canUseCloud) return;
        const signature = (approvalSignatures[request.id] || '').trim();
        if (!signature) return alert('Signature name is required to reject the request.');

        const updated: OrganizationFundTransaction = {
            ...request,
            status: 'rejected',
            approvedBy: currentUser.username,
            approverSignatureName: signature,
            approvedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        await saveOrganizationFundTransaction(settings.supabaseUrl, settings.supabaseKey, updated);
        await refresh();
    };

    const openEditEntry = (entry: OrganizationFundTransaction) => {
        setEditingEntry(entry);
        setEditingAmount(String(entry.amount));
    };

    const closeEditEntry = () => {
        if (isSavingEdit) return;
        setEditingEntry(null);
        setEditingAmount('');
    };

    const saveEditedEntry = async () => {
        if (!editingEntry || !canWrite || !canUseCloud) return;
        const amount = Number.parseFloat(editingAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            alert('Enter a valid positive amount.');
            return;
        }

        if (editingEntry.type === 'withdrawal' && editingEntry.status === 'approved') {
            const balanceExcludingEntry = getOrganizationBalance(entries, editingEntry.organizationId) + editingEntry.amount;
            if (amount > balanceExcludingEntry) {
                alert(`Amount exceeds the available balance (${formatCurrency(balanceExcludingEntry, settings.currency)}).`);
                return;
            }
        }

        setIsSavingEdit(true);
        try {
            await saveOrganizationFundTransaction(settings.supabaseUrl, settings.supabaseKey, {
                ...editingEntry,
                amount,
                updatedAt: new Date().toISOString(),
            });
            await refresh();
            setEditingEntry(null);
            setEditingAmount('');
        } catch (err: any) {
            alert(err?.message || 'Failed to update transaction.');
        } finally {
            setIsSavingEdit(false);
        }
    };

    const deleteEntry = async (entry: OrganizationFundTransaction) => {
        if (!canWrite || !canUseCloud) return;
        const description = `${entry.type === 'deposit' ? 'deposit' : 'withdrawal'} of ${formatCurrency(entry.amount, settings.currency)} on ${entry.date}`;
        showConfirm(`Delete this ${description}? This cannot be undone.`, async () => {
            try {
                await deleteOrganizationFundTransaction(settings.supabaseUrl, settings.supabaseKey, entry.id);
                await refresh();
            } catch (err: any) {
                alert(err?.message || 'Failed to delete transaction.');
            }
        });
    };

    const addOrganization = async () => {
        if (!canWrite || !canManageOrganizations || !canUseCloud) return;
        const normalized = newOrganizationName.trim();
        if (!normalized) return;
        const exists = organizations.some((org) => org.name.toLowerCase() === normalized.toLowerCase());
        if (exists) return alert('Organization already exists.');

        await saveOrganizationFundOrganization(settings.supabaseUrl, settings.supabaseKey, {
            id: crypto.randomUUID(),
            name: normalized,
            isActive: true,
            createdBy: currentUser.username,
            updatedBy: currentUser.username,
        });
        await refresh();
        setNewOrganizationName('');
    };

    const removeOrganization = async (organization: OrganizationFundOrganization) => {
        if (!canWrite || !canManageOrganizations || !canUseCloud) return;
        const inUse = entries.some((entry) => entry.organizationId === organization.id);
        const confirmation = inUse
            ? 'This organization has transactions. It will be removed from the list but history remains in reports. Continue?'
            : `Remove ${organization.name} from organization list?`;
        if (!window.confirm(confirmation)) return;

        await setOrganizationFundOrganizationActive(
            settings.supabaseUrl,
            settings.supabaseKey,
            organization.id,
            false,
            currentUser.username
        );
        await refresh();
        if (selectedOrg && selectedOrg.id === organization.id) {
            const next = organizations.find((org) => org.id !== organization.id);
            if (next) setSelectedOrganizationId(next.id);
        }
    };

    const panelClass = 'rounded-3xl border border-slate-200/70 bg-white/95 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-sm';
    const sectionTitleClass = 'text-xl font-black text-slate-900 tracking-tight';

    return (
        <div className="mx-auto max-w-7xl space-y-6 rounded-[2rem] p-4 sm:p-6 lg:p-8 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.10),transparent_40%)]">
            <div className="relative overflow-hidden rounded-3xl border border-slate-700/20 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-7 shadow-[0_16px_45px_rgba(15,23,42,0.35)]">
                <div className="pointer-events-none absolute -top-16 -right-14 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-16 -left-12 h-52 w-52 rounded-full bg-blue-400/20 blur-3xl" />
                <div className="relative">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-cyan-100 border border-white/20">Finance Workspace</div>
                    <h2 className="mt-3 text-3xl sm:text-4xl font-black text-white tracking-tight">Organization Funds</h2>
                    <p className="text-blue-100/90 font-medium mt-2 max-w-3xl">Track organization deposits, withdrawal requests, and approvals with signatures.</p>
                </div>
                {isLoading && (
                    <div className="mt-4 inline-flex items-center rounded-full border border-white/30 bg-white/20 px-4 py-1.5 text-sm font-semibold text-white">
                        Loading organization funds data...
                    </div>
                )}
                {errorMessage && (
                    <div className="mt-4 rounded-xl border border-rose-300 bg-rose-50/95 px-4 py-3 text-rose-800 text-sm font-semibold">{errorMessage}</div>
                )}
                {!canWrite && (
                    <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50/95 px-4 py-3 text-amber-900 font-semibold text-sm">
                        Writes are disabled until cloud sync is connected.
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className={`${panelClass} p-4 sm:p-5` }>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Selected Organization</label>
                    <select
                        value={selectedOrg?.id || ''}
                        onChange={(e) => setSelectedOrganizationId(e.target.value)}
                        className="mt-2 block w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 font-semibold text-slate-800 outline-none transition focus:border-cyan-400"
                    >
                        {organizations.map((org) => (
                            <option key={org.id} value={org.id}>{org.name}</option>
                        ))}
                    </select>
                </div>
                <div className="rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-100 to-teal-100 p-4 sm:p-5 shadow-[0_10px_24px_rgba(5,150,105,0.2)]">
                    <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">Available Balance</div>
                    <div className="text-3xl font-black text-emerald-800 mt-1 tracking-tight">{formatCurrency(selectedOrgBalance, settings.currency)}</div>
                </div>
                <div className="rounded-3xl border border-indigo-200/80 bg-gradient-to-br from-indigo-100 to-blue-100 p-4 sm:p-5 shadow-[0_10px_24px_rgba(79,70,229,0.2)]">
                    <div className="text-xs font-bold uppercase tracking-wider text-indigo-700">Pending Requests</div>
                    <div className="text-3xl font-black text-indigo-900 mt-1 tracking-tight">
                        {pendingRequests.filter((req) => selectedOrg && req.organizationId === selectedOrg.id).length}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className={`${panelClass} p-5 sm:p-6 space-y-3 bg-gradient-to-br from-white to-emerald-50/40`}>
                    <h3 className={sectionTitleClass}>Record Deposit</h3>
                    <input value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} type="number" min="0" step="0.01" placeholder="Amount" className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 outline-none transition focus:border-emerald-400" />
                    <input value={depositDate} onChange={(e) => setDepositDate(e.target.value)} type="date" className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 outline-none transition focus:border-emerald-400" />
                    <input value={depositSubmittedBy} onChange={(e) => setDepositSubmittedBy(e.target.value)} placeholder="Who submitted" className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 outline-none transition focus:border-emerald-400" />
                    <input value={depositNote} onChange={(e) => setDepositNote(e.target.value)} placeholder="Note (optional)" className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 outline-none transition focus:border-emerald-400" />
                    <button onClick={addDeposit} disabled={!canWrite} className={`w-full font-bold py-3 rounded-xl text-white transition ${canWrite ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md hover:shadow-lg' : 'bg-slate-400 cursor-not-allowed'}`}>
                        Save Deposit
                    </button>
                </div>

                <div className={`${panelClass} p-5 sm:p-6 space-y-3 bg-gradient-to-br from-white to-indigo-50/40`}>
                    <h3 className={sectionTitleClass}>Request Withdrawal</h3>
                    <input value={requestAmount} onChange={(e) => setRequestAmount(e.target.value)} type="number" min="0" step="0.01" placeholder="Amount" className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 outline-none transition focus:border-indigo-400" />
                    <input value={requestDate} onChange={(e) => setRequestDate(e.target.value)} type="date" className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 outline-none transition focus:border-indigo-400" />
                    <input value={requestBy} onChange={(e) => setRequestBy(e.target.value)} placeholder="Requested by" className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 outline-none transition focus:border-indigo-400" />
                    <input value={requestPurpose} onChange={(e) => setRequestPurpose(e.target.value)} placeholder="Purpose" className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 outline-none transition focus:border-indigo-400" />
                    <button onClick={addWithdrawalRequest} disabled={!canWrite} className={`w-full font-bold py-3 rounded-xl text-white transition ${canWrite ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-md hover:shadow-lg' : 'bg-slate-400 cursor-not-allowed'}`}>
                        Submit Request
                    </button>
                </div>
            </div>

            <div className="rounded-3xl border border-blue-200/80 bg-gradient-to-br from-blue-100/80 to-indigo-100/80 p-5 sm:p-6 shadow-[0_10px_24px_rgba(59,130,246,0.16)]">
                <h3 className="text-lg font-extrabold text-blue-900 mb-3">How Approval Works</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-blue-900">
                    <div className="bg-white/85 rounded-xl border border-blue-100 p-3 font-medium">1. Select organization and submit a withdrawal request.</div>
                    <div className="bg-white/85 rounded-xl border border-blue-100 p-3 font-medium">2. Request stays Pending and does not reduce balance yet.</div>
                    <div className="bg-white/85 rounded-xl border border-blue-100 p-3 font-medium">3. Another authorized user enters signature name and approves.</div>
                    <div className="bg-white/85 rounded-xl border border-blue-100 p-3 font-medium">4. Once approved, amount is deducted and appears in history.</div>
                </div>
            </div>

            <div className={`${panelClass} p-5 sm:p-6`}>
                <button
                    type="button"
                    onClick={() => setIsOrgSummaryCollapsed((prev) => !prev)}
                    className="w-full flex items-center justify-between text-left"
                >
                    <h3 className={sectionTitleClass}>Organization Contribution Summary</h3>
                    <span className="text-sm font-bold text-slate-600">{isOrgSummaryCollapsed ? 'Show' : 'Hide'}</span>
                </button>
                {!isOrgSummaryCollapsed && (
                    <div className="mt-4">
                        <p className="text-sm text-slate-500 mb-3">Click a column header to sort and quickly see how much each organization has contributed.</p>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 text-left text-slate-600">
                                        <th className="py-2 pr-3">
                                            <button onClick={() => handleOrganizationSort('name')} className="font-bold hover:text-slate-900">Organization</button>
                                        </th>
                                        <th className="py-2 pr-3">
                                            <button onClick={() => handleOrganizationSort('deposited')} className="font-bold hover:text-slate-900">Contributed</button>
                                        </th>
                                        <th className="py-2 pr-3">
                                            <button onClick={() => handleOrganizationSort('withdrawn')} className="font-bold hover:text-slate-900">Approved Outflow</button>
                                        </th>
                                        <th className="py-2 pr-3">
                                            <button onClick={() => handleOrganizationSort('pending')} className="font-bold hover:text-slate-900">Pending</button>
                                        </th>
                                        <th className="py-2 pr-3">
                                            <button onClick={() => handleOrganizationSort('net')} className="font-bold hover:text-slate-900">Net Balance</button>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {organizationContributionSummary.map((row) => (
                                        <tr key={row.id} className="border-b border-slate-100">
                                            <td className="py-2 pr-3 font-semibold">{row.name}</td>
                                            <td className="py-2 pr-3">{formatCurrency(row.deposited, settings.currency)}</td>
                                            <td className="py-2 pr-3">{formatCurrency(row.withdrawn, settings.currency)}</td>
                                            <td className="py-2 pr-3">{formatCurrency(row.pending, settings.currency)}</td>
                                            <td className="py-2 pr-3 font-bold">{formatCurrency(row.net, settings.currency)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            <div className={`${panelClass} p-5 sm:p-6`}>
                <h3 className={`${sectionTitleClass} mb-4`}>Approval Queue</h3>
                {pendingRequests.length === 0 ? (
                    <p className="text-slate-500">No pending requests.</p>
                ) : (
                    <div className="space-y-3">
                        {pendingRequests.map((req) => {
                            const orgBalance = getOrganizationBalance(entries, req.organizationId);
                            return (
                                <div key={req.id} className="rounded-2xl border border-slate-200 p-4 bg-gradient-to-br from-white to-slate-50 shadow-sm">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="font-bold text-slate-800">{req.organizationNameSnapshot} - {formatCurrency(req.amount, settings.currency)}</div>
                                        <span className={`text-xs font-bold px-2 py-1 rounded border ${statusBadgeClass(req.status)}`}>{req.status.toUpperCase()}</span>
                                    </div>
                                    <div className="text-sm text-slate-600 mt-1">Requested by: {req.submittedBy} | Entered by: {req.enteredBy} | Available: {formatCurrency(orgBalance, settings.currency)}</div>
                                    {req.note && <div className="text-sm text-slate-600 mt-1">Purpose: {req.note}</div>}
                                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                                        <input
                                            value={approvalSignatures[req.id] || ''}
                                            onChange={(e) => setApprovalSignatures((prev) => ({ ...prev, [req.id]: e.target.value }))}
                                            placeholder="Approver signature name"
                                            className="md:col-span-1 rounded-xl border-2 border-slate-200 px-3 py-2 outline-none transition focus:border-indigo-400"
                                        />
                                        <button onClick={() => approveRequest(req)} disabled={!canWrite} className={`font-bold py-2 rounded-xl text-white transition ${canWrite ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700' : 'bg-slate-400 cursor-not-allowed'}`}>Approve</button>
                                        <button onClick={() => rejectRequest(req)} disabled={!canWrite} className={`font-bold py-2 rounded-xl text-white transition ${canWrite ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700' : 'bg-slate-400 cursor-not-allowed'}`}>Reject</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className={`${panelClass} p-5 sm:p-6`}>
                <button
                    type="button"
                    onClick={() => setIsYearlySummaryCollapsed((prev) => !prev)}
                    className="w-full flex items-center justify-between text-left"
                >
                    <h3 className={sectionTitleClass}>Yearly Summary ({selectedOrg?.name || '-'})</h3>
                    <span className="text-sm font-bold text-slate-600">{isYearlySummaryCollapsed ? 'Show' : 'Hide'}</span>
                </button>
                {!isYearlySummaryCollapsed && (
                    <div className="mt-4">
                        {selectedOrgSummaryByYear.length === 0 ? (
                            <p className="text-slate-500">No transactions for this organization yet.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200 text-left text-slate-600">
                                            <th className="py-2 pr-4">Year</th>
                                            <th className="py-2 pr-4">Deposited</th>
                                            <th className="py-2 pr-4">Withdrawn</th>
                                            <th className="py-2 pr-4">Pending</th>
                                            <th className="py-2 pr-4">Net</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedOrgSummaryByYear.map((row) => (
                                            <tr key={row.year} className="border-b border-slate-100">
                                                <td className="py-2 pr-4 font-semibold">{row.year}</td>
                                                <td className="py-2 pr-4">{formatCurrency(row.deposited, settings.currency)}</td>
                                                <td className="py-2 pr-4">{formatCurrency(row.withdrawn, settings.currency)}</td>
                                                <td className="py-2 pr-4">{formatCurrency(row.pending, settings.currency)}</td>
                                                <td className="py-2 pr-4 font-bold">{formatCurrency(row.net, settings.currency)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className={`${panelClass} p-5 sm:p-6`}>
                <button
                    type="button"
                    onClick={() => setIsHistoryCollapsed((prev) => !prev)}
                    className="w-full flex items-center justify-between text-left"
                >
                    <h3 className={sectionTitleClass}>Transaction History ({selectedOrg?.name || '-'})</h3>
                    <span className="text-sm font-bold text-slate-600">{isHistoryCollapsed ? 'Show' : 'Hide'}</span>
                </button>
                {!isHistoryCollapsed && (
                    <div className="mt-4">
                        {selectedOrgEntries.length === 0 ? (
                            <p className="text-slate-500">No entries yet.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200 text-left text-slate-600">
                                            <th className="py-2 pr-3">Date</th>
                                            <th className="py-2 pr-3">Type</th>
                                            <th className="py-2 pr-3">Amount</th>
                                            <th className="py-2 pr-3">Submitted By</th>
                                            <th className="py-2 pr-3">Entered By</th>
                                            <th className="py-2 pr-3">Approved By</th>
                                            <th className="py-2 pr-3">Signature</th>
                                            <th className="py-2 pr-3">Status</th>
                                            <th className="py-2 pr-3">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedOrgEntries.map((entry) => (
                                            <tr key={entry.id} className="border-b border-slate-100">
                                                <td className="py-2 pr-3">{entry.date}</td>
                                                <td className="py-2 pr-3 font-medium">{entry.type === 'deposit' ? 'Deposit' : 'Withdrawal'}</td>
                                                <td className="py-2 pr-3">{formatCurrency(entry.amount, settings.currency)}</td>
                                                <td className="py-2 pr-3">{entry.submittedBy || '-'}</td>
                                                <td className="py-2 pr-3">{entry.enteredBy || '-'}</td>
                                                <td className="py-2 pr-3">{entry.approvedBy || '-'}</td>
                                                <td className="py-2 pr-3">{entry.approverSignatureName || '-'}</td>
                                                <td className="py-2 pr-3">
                                                    <span className={`text-xs font-bold px-2 py-1 rounded border ${statusBadgeClass(entry.status)}`}>
                                                        {entry.status.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td className="py-2 pr-3">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => openEditEntry(entry)}
                                                            disabled={!canWrite}
                                                            className={`rounded-lg px-2.5 py-1.5 text-xs font-bold text-white ${canWrite ? 'bg-amber-500 hover:bg-amber-600' : 'cursor-not-allowed bg-slate-400'}`}
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => deleteEntry(entry)}
                                                            disabled={!canWrite}
                                                            className={`rounded-lg px-2.5 py-1.5 text-xs font-bold text-white ${canWrite ? 'bg-rose-500 hover:bg-rose-600' : 'cursor-not-allowed bg-slate-400'}`}
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className={`${panelClass} p-5 sm:p-6`}>
                <button
                    type="button"
                    onClick={() => setIsManageOrganizationsCollapsed((prev) => !prev)}
                    className="w-full flex items-center justify-between text-left"
                >
                    <h3 className={sectionTitleClass}>Manage Organizations</h3>
                    <span className="text-sm font-bold text-slate-600">{isManageOrganizationsCollapsed ? 'Show' : 'Hide'}</span>
                </button>
                {!isManageOrganizationsCollapsed && (
                    <div className="mt-4">
                        {!canManageOrganizations ? (
                            <p className="text-slate-500">Only Admin and Finance Chair can add or remove organizations.</p>
                        ) : (
                            <>
                                <div className="flex flex-col md:flex-row gap-3 mb-4">
                                    <input
                                        value={newOrganizationName}
                                        onChange={(e) => setNewOrganizationName(e.target.value)}
                                        placeholder="New organization name"
                                        className="flex-1 rounded-xl border-2 border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-500"
                                    />
                                    <button onClick={addOrganization} disabled={!canWrite} className={`font-bold text-white px-5 py-2.5 rounded-xl transition ${canWrite ? 'bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-900 hover:to-slate-800' : 'bg-slate-400 cursor-not-allowed'}`}>
                                        Add Organization
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                                    {organizations.map((org) => (
                                        <div key={org.id} className="border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50/70 flex items-center justify-between">
                                            <span className="font-medium text-slate-700">{org.name}</span>
                                            <button
                                                onClick={() => removeOrganization(org)}
                                                disabled={!canWrite}
                                                className={`text-xs font-bold px-2 py-1 rounded ${canWrite ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {editingEntry && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" onClick={closeEditEntry}>
                    <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Edit Transaction</p>
                                <h3 className="mt-1 text-2xl font-black text-slate-900">{editingEntry.organizationNameSnapshot}</h3>
                                <p className="mt-1 text-sm text-slate-500">{editingEntry.type === 'deposit' ? 'Deposit' : 'Withdrawal'} on {editingEntry.date}</p>
                            </div>
                            <button type="button" onClick={closeEditEntry} className="rounded-full px-2 text-2xl font-bold text-slate-500 hover:bg-slate-100">×</button>
                        </div>
                        <label className="mt-6 block text-sm font-bold text-slate-700">Amount</label>
                        <input
                            autoFocus
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={editingAmount}
                            onChange={(event) => setEditingAmount(event.target.value)}
                            className="mt-2 w-full rounded-xl border-2 border-slate-200 px-3 py-3 text-lg font-bold outline-none focus:border-cyan-400"
                        />
                        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <button type="button" onClick={closeEditEntry} className="rounded-xl border-2 border-slate-200 px-5 py-3 font-bold text-slate-700 hover:bg-slate-50">Cancel</button>
                            <button type="button" onClick={saveEditedEntry} disabled={isSavingEdit} className={`rounded-xl px-5 py-3 font-bold text-white ${isSavingEdit ? 'cursor-not-allowed bg-slate-400' : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700'}`}>
                                {isSavingEdit ? 'Saving...' : 'Save Amount'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrganizationFunds;
