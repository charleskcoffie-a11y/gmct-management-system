
// App.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Members from './components/Members';
import Insights from './components/Insights';
import SettingsTab from './components/Settings';
import Login from './components/Login';
import UsersTab from './components/Users';
import Utilities from './components/Utilities';
import EntryModal from './components/EntryModal';
import WeeklyHistory from './components/WeeklyHistory';
import ConfirmationModal from './components/ConfirmationModal';
import DevelopmentFund from './components/DevelopmentFund';
import NoName from './components/NoName';

import { useLocalStorage } from './hooks/useLocalStorage';
import { useSupabaseAutoSync } from './hooks/useSupabaseAutoSync';
import { sanitizeEntry, sanitizeMember, sanitizeUser, sanitizeSettings, sanitizeWeeklyHistoryRecord, capitalize, sanitizeDevelopmentFundEntry, formatCurrency, isMonthLocked, sanitizeNoNameEntry } from './utils';
import type { Entry, Member, Settings, User, Tab, CloudState, AttendanceRecord, WeeklyHistoryRecord, DevelopmentFundEntry, EntryType, MonthLock, NoNameEntry } from './types';
import { DEFAULT_CURRENCY, DEFAULT_MAX_CLASSES, SUPABASE_URL, SUPABASE_KEY } from './constants';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

// Initial Data
const INITIAL_USERS: User[] = [
    { username: 'Admin', password: 'GMCT', role: 'admin' },
];
const INITIAL_SETTINGS: Settings = {
    currency: DEFAULT_CURRENCY,
    maxClasses: DEFAULT_MAX_CLASSES,
    enforceDirectory: true,
    supabaseUrl: SUPABASE_URL,
    supabaseKey: SUPABASE_KEY
};

type SortKey = 'date' | 'memberName' | 'type' | 'amount' | 'classNumber';

const App: React.FC = () => {
    // --- State Management ---
    const [entries, setEntries] = useLocalStorage<Entry[]>('gmct-entries', [], (data) => Array.isArray(data) ? data.map(sanitizeEntry) : []);
    const [members, setMembers] = useLocalStorage<Member[]>('gmct-members', [], (data) => Array.isArray(data) ? data.map(sanitizeMember) : []);
    const [users, setUsers] = useLocalStorage<User[]>('gmct-users', INITIAL_USERS, (data) => Array.isArray(data) && data.length > 0 ? data.map(sanitizeUser) : INITIAL_USERS);
    const [settings, setSettings] = useLocalStorage<Settings>('gmct-settings', INITIAL_SETTINGS, sanitizeSettings);
    const [attendance, setAttendance] = useLocalStorage<AttendanceRecord[]>('gmct-attendance', [], (data) => Array.isArray(data) ? data : []);
    const [weeklyHistory, setWeeklyHistory] = useLocalStorage<WeeklyHistoryRecord[]>('gmct-weekly-history', [], (data) => Array.isArray(data) ? data.map(sanitizeWeeklyHistoryRecord) : []);
    const [developmentFund, setDevelopmentFund] = useLocalStorage<DevelopmentFundEntry[]>('gmct-dev-fund', [], (data) => Array.isArray(data) ? data.map(sanitizeDevelopmentFundEntry) : []);
    const [noNameEntries, setNoNameEntries] = useLocalStorage<NoNameEntry[]>('gmct-no-name', [], (data) => Array.isArray(data) ? data.map(sanitizeNoNameEntry) : []);
    
    // New State for Month Locks
    const [monthLocks, setMonthLocks] = useLocalStorage<MonthLock[]>('gmct-locks', [], (data) => Array.isArray(data) ? data : []);

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loginError, setLoginError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('home');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [entryToDeleteId, setEntryToDeleteId] = useState<string | null>(null);
    
    // -- Sorting & Filtering State for Financial Records --
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
    const [searchFilter, setSearchFilter] = useState('');
    const [classFilter, setClassFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState<EntryType | 'all'>('all');
    const [startDateFilter, setStartDateFilter] = useState('');
    const [endDateFilter, setEndDateFilter] = useState('');
    const [showDeleted, setShowDeleted] = useState(false);


    const [cloud, setCloud] = useState<CloudState>({ ready: false, message: "" });

    // --- Live Sync Hook ---
    const syncStatus = useSupabaseAutoSync(settings, {
        entries, members, attendance, history: weeklyHistory, users, developmentFund, noName: noNameEntries
    }, {
        setEntries, setMembers, setAttendance, setHistory: setWeeklyHistory, setUsers, setDevelopmentFund, setNoName: setNoNameEntries
    });
    
    // --- Safe Close Protection ---
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (syncStatus.state === 'syncing' || syncStatus.state === 'error') {
                const msg = "Data is currently syncing or has failed to sync. Changes may be lost if you close now.";
                e.preventDefault();
                e.returnValue = msg;
                return msg;
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [syncStatus.state]);
    
    // --- Derived State ---
    const membersMap = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);

    const filteredAndSortedEntries = useMemo(() => {
        const filtered = entries.filter(entry => {
            // Soft Delete check
            if (entry.deleted && !showDeleted) return false;
            
            if (searchFilter && !entry.memberName.toLowerCase().includes(searchFilter.toLowerCase())) return false;
            if (typeFilter !== 'all' && entry.type !== typeFilter) return false;
            if (startDateFilter && entry.date < startDateFilter) return false;
            if (endDateFilter && entry.date > endDateFilter) return false;
            
            const member = membersMap.get(entry.memberID);
            const entryClass = entry.classNumber || member?.classNumber;
            
            if (classFilter !== 'all' && entryClass !== classFilter) return false;
            return true;
        });

        const sortableEntries = [...filtered];
        sortableEntries.sort((a, b) => {
            let aValue: any, bValue: any;
            if (sortConfig.key === 'classNumber') {
                const memberA = membersMap.get(a.memberID);
                const memberB = membersMap.get(b.memberID);
                aValue = parseInt(a.classNumber || memberA?.classNumber || '0', 10) || 0;
                bValue = parseInt(b.classNumber || memberB?.classNumber || '0', 10) || 0;
            } else {
                aValue = a[sortConfig.key as keyof Entry];
                bValue = b[sortConfig.key as keyof Entry];
            }
            
            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return sortableEntries;
    }, [entries, sortConfig, membersMap, searchFilter, classFilter, typeFilter, startDateFilter, endDateFilter, showDeleted]);

    // Financial Mini Dashboard Data
    const financialSummary = useMemo(() => {
        // Only calculate based on non-deleted entries for accuracy
        const activeEntries = filteredAndSortedEntries.filter(e => !e.deleted);
        const total = activeEntries.reduce((sum, e) => sum + e.amount, 0);
        const count = activeEntries.length;
        
        const typeDistribution: Record<string, number> = {};
        activeEntries.forEach(e => {
            typeDistribution[e.type] = (typeDistribution[e.type] || 0) + e.amount;
        });
        
        const chartData = Object.entries(typeDistribution).map(([name, value]) => ({
            name: capitalize(name.replace(/-/g, ' ')),
            value
        })).sort((a, b) => b.value - a.value);

        return { total, count, chartData };
    }, [filteredAndSortedEntries]);

    const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#f43f5e', '#0ea5e9', '#8b5cf6'];

    // --- Handlers ---
    const handleLogin = (username: string, password: string) => {
        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
        if (user) {
            setCurrentUser(user);
            setLoginError(null);
            // Intelligent Redirect based on Role
            if (user.role === 'admin' || user.role === 'finance-chair') setActiveTab('home');
            else if (user.role === 'finance-team') setActiveTab('records');
            else if (user.role === 'data-entry') setActiveTab('records');
            else if (user.role === 'pastor') setActiveTab('insights');
            else if (user.role === 'statistician') setActiveTab('history');
            else setActiveTab('home');
        } else {
            setLoginError('Invalid username or password.');
        }
    };

    const handleLogout = () => setCurrentUser(null);

    const handleSaveEntry = (entry: Entry) => {
        const newEntries = [...entries];
        const index = newEntries.findIndex(e => e.id === entry.id);
        if (index > -1) {
            newEntries[index] = entry;
        } else {
            newEntries.push(entry);
        }
        setEntries(newEntries);
        setIsModalOpen(false);
    };

    const handleSaveAndNew = (entry: Entry) => {
        const newEntries = [...entries];
        newEntries.push(entry);
        setEntries(newEntries);
    };
    
    const handleDeleteEntry = (id: string) => {
        setEntryToDeleteId(id);
        setIsConfirmModalOpen(true);
    };

    // Soft Delete Logic
    const confirmDeleteEntry = () => {
        if (entryToDeleteId) {
            const entryIndex = entries.findIndex(e => e.id === entryToDeleteId);
            if (entryIndex > -1) {
                const newEntries = [...entries];
                // Soft Delete: Mark as deleted, keep data
                newEntries[entryIndex] = {
                    ...newEntries[entryIndex],
                    deleted: true,
                    updatedBy: currentUser?.username || 'Unknown',
                    lastUpdated: new Date().toISOString()
                };
                setEntries(newEntries);
            }
            setIsModalOpen(false);
        }
        setIsConfirmModalOpen(false);
        setEntryToDeleteId(null);
    };

    const handleImport = (newEntries: Entry[]) => {
        setEntries(prev => [...prev, ...newEntries]);
    };
    const handleExport = (format: 'csv' | 'json') => {};
    const handleSort = (key: SortKey) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };
    
    if (!currentUser) {
        return <Login users={users} onLogin={handleLogin} error={loginError} />;
    }

    const ENTRY_TYPES: EntryType[] = ["tithe", "offering", "thanksgiving-offering", "pledge", "harvest-levy", "kofi-and-ama", "other"];

    const renderTabContent = () => {
        // Double check access before rendering restrictive tabs
        if (activeTab === 'utilities' && currentUser.role !== 'admin') {
            return <div className="p-8 text-center text-slate-500">Access Denied. Administrator privileges required.</div>;
        }
        if (activeTab === 'users' && currentUser.role !== 'admin') {
             return <div className="p-8 text-center text-slate-500">Access Denied. Administrator privileges required.</div>;
        }

        switch (activeTab) {
            case 'home': return <Dashboard entries={entries} members={members} settings={settings} currentUser={currentUser} monthLocks={monthLocks}/>;
            case 'records':
                return (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-3xl font-bold text-slate-800">Financial Records</h2>
                                <p className="text-base text-slate-500 mt-1">Manage tithes, offerings, and donations.</p>
                            </div>
                            {/* Hide Create Button for Pastor */}
                            {currentUser.role !== 'pastor' && (
                                <button onClick={() => { setSelectedEntry(null); setIsModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all hover:scale-105 text-lg">
                                    Record Contribution
                                </button>
                            )}
                        </div>

                        {/* Filter Controls */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 items-end">
                            <div className="lg:col-span-1">
                                <label className="block text-sm font-bold uppercase text-slate-500 mb-1">Search Member</label>
                                <input type="text" placeholder="Name..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)} className="block w-full border-slate-300 rounded-lg shadow-sm py-3"/>
                            </div>
                            <div className="lg:col-span-1">
                                <label className="block text-sm font-bold uppercase text-slate-500 mb-1">Class</label>
                                <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="block w-full border-slate-300 rounded-lg shadow-sm py-3">
                                    <option value="all">All Classes</option>
                                    {Array.from({ length: settings.maxClasses }, (_, i) => String(i + 1)).map(num => (<option key={num} value={num}>Class {num}</option>))}
                                </select>
                            </div>
                            <div className="lg:col-span-1">
                                <label className="block text-sm font-bold uppercase text-slate-500 mb-1">Type</label>
                                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as EntryType | 'all')} className="block w-full border-slate-300 rounded-lg shadow-sm py-3">
                                    <option value="all">All Types</option>
                                    {ENTRY_TYPES.map(t => <option key={t} value={t}>{t.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                                </select>
                            </div>
                            <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold uppercase text-slate-500 mb-1">Start Date</label>
                                    <input type="date" value={startDateFilter} onChange={e => setStartDateFilter(e.target.value)} className="block w-full border-slate-300 rounded-lg shadow-sm py-3"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold uppercase text-slate-500 mb-1">End Date</label>
                                    <input type="date" value={endDateFilter} onChange={e => setEndDateFilter(e.target.value)} className="block w-full border-slate-300 rounded-lg shadow-sm py-3"/>
                                </div>
                            </div>
                        </div>

                        {/* Mini Dashboard */}
                        {financialSummary.total > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="col-span-1 bg-gradient-to-br from-white to-slate-50 p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center">
                                    <h3 className="text-slate-500 font-medium text-sm uppercase tracking-wider">Filtered Total</h3>
                                    <p className="text-4xl font-bold text-slate-800 mt-2">{formatCurrency(financialSummary.total, settings.currency)}</p>
                                    <p className="text-slate-400 text-sm mt-1">{financialSummary.count} entries</p>
                                </div>
                                <div className="col-span-2 bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center">
                                    <div className="h-32 w-32 flex-shrink-0">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={financialSummary.chartData} cx="50%" cy="50%" innerRadius={25} outerRadius={50} paddingAngle={2} dataKey="value">
                                                    {financialSummary.chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                                </Pie>
                                                <RechartsTooltip formatter={(value: number) => formatCurrency(value, settings.currency)} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="ml-6 flex-grow grid grid-cols-2 gap-x-4 gap-y-2">
                                        {financialSummary.chartData.map((item, index) => (
                                            <div key={item.name} className="flex items-center text-sm">
                                                <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                                                <span className="text-slate-600 flex-grow">{item.name}</span>
                                                <span className="font-semibold text-slate-800">{formatCurrency(item.value, settings.currency)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            {(currentUser.role === 'admin' || currentUser.role === 'finance-chair') && (
                                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-end">
                                    <label className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500 cursor-pointer">
                                        <input type="checkbox" checked={showDeleted} onChange={e => setShowDeleted(e.target.checked)} className="rounded border-slate-300 text-red-600 focus:ring-red-500"/>
                                        Show Deleted Records
                                    </label>
                                </div>
                            )}
                           <div className="overflow-x-auto max-h-[60vh]">
                               <table className="w-full text-left text-slate-600">
                                    <thead className="text-sm text-slate-500 uppercase bg-slate-50 sticky top-0 z-10 font-bold tracking-wider">
                                        <tr>
                                            <th className="px-6 py-5 border-b cursor-pointer hover:bg-slate-100" onClick={() => handleSort('date')}>Date {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                                            <th className="px-6 py-5 border-b cursor-pointer hover:bg-slate-100" onClick={() => handleSort('memberName')}>Member {sortConfig.key === 'memberName' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                                            <th className="px-6 py-5 border-b">Class #</th>
                                            <th className="px-6 py-5 border-b text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort('classNumber')}>Class {sortConfig.key === 'classNumber' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                                            <th className="px-6 py-5 border-b cursor-pointer hover:bg-slate-100" onClick={() => handleSort('type')}>Type {sortConfig.key === 'type' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                                            <th className="px-6 py-5 border-b cursor-pointer hover:bg-slate-100" onClick={() => handleSort('amount')}>Amount {sortConfig.key === 'amount' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                                            <th className="px-6 py-5 border-b"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-lg">
                                        {filteredAndSortedEntries.map(entry => {
                                            const member = membersMap.get(entry.memberID);
                                            const displayClass = entry.classNumber || member?.classNumber || '-';
                                            const isLocked = isMonthLocked(entry.date, monthLocks);
                                            // Permission Logic
                                            const canEdit = !entry.deleted && currentUser.role !== 'pastor' && (!isLocked || currentUser.role === 'admin' || currentUser.role === 'finance-chair');

                                            return (
                                                <tr key={entry.id} className={`transition-colors ${entry.deleted ? 'bg-red-50 opacity-60' : 'bg-white hover:bg-slate-50'}`}>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        {entry.date}
                                                        {entry.deleted && <span className="ml-2 text-xs bg-red-200 text-red-800 px-2 py-0.5 rounded">DELETED</span>}
                                                        {isLocked && <span className="ml-2" title="Month Locked">🔒</span>}
                                                    </td>
                                                    <td className="px-6 py-4 font-medium text-slate-900">{entry.memberName}</td>
                                                    <td className="px-6 py-4 font-mono text-base text-slate-500">{member?.memberNumber || '-'}</td>
                                                    <td className="px-6 py-4 text-center">{displayClass}</td>
                                                    <td className="px-6 py-4 capitalize"><span className="px-3 py-1 rounded-full bg-slate-100 text-sm font-bold text-slate-600">{entry.type.replace(/-/g, ' ')}</span></td>
                                                    <td className="px-6 py-4 font-bold text-slate-800">{formatCurrency(entry.amount, settings.currency)}</td>
                                                    <td className="px-6 py-4 text-right">
                                                        {canEdit && (
                                                            <button onClick={() => { setSelectedEntry(entry); setIsModalOpen(true); }} className="text-indigo-600 hover:text-indigo-800 font-bold text-base">Edit</button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                               </table>
                           </div>
                        </div>
                    </div>
                );
            case 'development-fund': return <DevelopmentFund members={members} entries={developmentFund} setEntries={setDevelopmentFund} settings={settings} />;
            case 'no-name': return <NoName entries={noNameEntries} setEntries={setNoNameEntries} settings={settings} currentUser={currentUser} />;
            case 'members': return <Members members={members} setMembers={setMembers} settings={settings} entries={entries} developmentEntries={developmentFund} />;
            case 'insights': return <Insights entries={filteredAndSortedEntries.filter(e => !e.deleted)} settings={settings} />;
            case 'history': return <WeeklyHistory history={weeklyHistory} setHistory={setWeeklyHistory} />;
            case 'users': return <UsersTab users={users} setUsers={setUsers} members={members} />;
            case 'settings': return <SettingsTab settings={settings} setSettings={setSettings} cloud={cloud} setCloud={setCloud} onExport={() => {}} onImport={() => {}} currentUser={currentUser} allData={{entries, members, attendance, weeklyHistory, users, developmentFund, noName: noNameEntries, monthLocks, setEntries, setMembers, setAttendance, setWeeklyHistory, setUsers, setDevelopmentFund, setNoName: setNoNameEntries, setMonthLocks}}/>;
            case 'utilities': return <Utilities entries={entries} members={members} history={weeklyHistory} settings={settings} setEntries={setEntries} setMembers={setMembers} />;
            default: return <div>Select a tab</div>;
        }
    };

    const navItems = [
        { id: 'home', label: 'Home', roles: ['admin', 'finance-chair', 'finance-team', 'pastor'] },
        { id: 'records', label: 'Financial Records', roles: ['admin', 'finance-chair', 'finance-team', 'data-entry'] },
        { id: 'development-fund', label: 'Development Fund', roles: ['admin', 'finance-chair', 'finance-team', 'data-entry', 'pastor'] },
        { id: 'no-name', label: 'No Name', roles: ['admin', 'finance-chair', 'finance-team'] },
        { id: 'members', label: 'Member Directory', roles: ['admin', 'finance-chair', 'finance-team', 'statistician', 'pastor'] },
        { id: 'insights', label: 'Insights & Reports', roles: ['admin', 'finance-chair', 'finance-team', 'pastor'] },
        { id: 'history', label: 'Weekly History', roles: ['admin', 'statistician', 'pastor'] },
        { id: 'users', label: 'Manage Users', roles: ['admin'] },
        { id: 'utilities', label: 'Utilities', roles: ['admin'] },
        { id: 'settings', label: 'Settings', roles: ['admin', 'finance-chair'] },
    ].filter(item => {
        // Always show Utilities so we can gray it out for non-admins if desired, or just strictly hide based on role
        if (item.id === 'utilities') return true; 
        
        return item.roles.includes(currentUser.role);
    });

    return (
        <div className="bg-slate-50 min-h-screen font-sans text-slate-900">
            <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl">
                <Header entries={entries} onImport={handleImport} onExport={handleExport} currentUser={currentUser} onLogout={handleLogout} syncStatus={syncStatus}/>
                <main className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    <aside className="lg:col-span-1 no-print">
                        <nav className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-4 space-y-2 sticky top-6">
                             {navItems.map(item => {
                                const hasAccess = item.roles.includes(currentUser.role);
                                const isRestricted = !hasAccess;

                                return (
                                    <button 
                                        key={item.id} 
                                        onClick={() => hasAccess && setActiveTab(item.id as Tab)} 
                                        disabled={isRestricted}
                                        className={`w-full text-left font-bold px-5 py-5 rounded-xl transition-all duration-200 text-xl tracking-wider flex items-center justify-between ${
                                            activeTab === item.id 
                                                ? 'bg-indigo-600 text-white shadow-lg transform scale-[1.03] ring-2 ring-indigo-400/50' 
                                                : isRestricted 
                                                    ? 'text-slate-600 cursor-not-allowed opacity-50 bg-slate-900/50' 
                                                    : 'text-slate-400 hover:bg-slate-800 hover:text-indigo-300'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            {item.label}
                                            {isRestricted && (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                        </div>
                                        {activeTab === item.id && <span className="text-indigo-200">›</span>}
                                    </button>
                                );
                             })}
                        </nav>
                    </aside>
                    <section className="lg:col-span-3">{renderTabContent()}</section>
                </main>
                {isModalOpen && <EntryModal entry={selectedEntry} existingEntries={entries} members={members} settings={settings} currentUser={currentUser} monthLocks={monthLocks} onSave={handleSaveEntry} onSaveAndNew={handleSaveAndNew} onClose={() => setIsModalOpen(false)} onDelete={handleDeleteEntry} />}
                <ConfirmationModal isOpen={isConfirmModalOpen} onClose={() => { setIsConfirmModalOpen(false); setEntryToDeleteId(null); }} onConfirm={confirmDeleteEntry} title="Confirm Deletion" message="Are you sure you want to delete this financial entry? It will be marked as deleted in the system." confirmButtonText="Delete Entry" />
            </div>
        </div>
    );
};

export default App;
