
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
import FinancialControl from './components/FinancialControl';

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
    const [startDateFilter, setStartDateFilter] = useState(new Date().toISOString().split('T')[0]);
    const [endDateFilter, setEndDateFilter] = useState(new Date().toISOString().split('T')[0]);
    const [showDeleted, setShowDeleted] = useState(false);
    const [selectedDateForModal, setSelectedDateForModal] = useState<string | null>(null);
    const [modalClassFilter, setModalClassFilter] = useState<string>('all');
    const [modalTypeFilter, setModalTypeFilter] = useState<EntryType | 'all'>('all');


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

    // Group entries by date
    const entriesByDate = useMemo(() => {
        const groups: Record<string, Entry[]> = {};
        filteredAndSortedEntries.forEach(entry => {
            if (!groups[entry.date]) {
                groups[entry.date] = [];
            }
            groups[entry.date].push(entry);
        });
        return groups;
    }, [filteredAndSortedEntries]);

    const sortedDates = useMemo(() => {
        return Object.keys(entriesByDate).sort((a, b) => b.localeCompare(a)); // Descending order
    }, [entriesByDate]);

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
                        <div className="bg-gradient-to-br from-slate-50 to-blue-50 p-8 rounded-2xl shadow-lg border-2 border-slate-200">
                            <div className="flex justify-between items-center">
                                <div>
                                    <div className="flex items-center gap-4 mb-3">
                                        <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-4 rounded-xl shadow-md">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                                                <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h2 className="text-3xl font-bold text-slate-800">Financial Records</h2>
                                            <p className="text-base text-slate-500 mt-1 font-medium">Track and manage church contributions</p>
                                        </div>
                                    </div>
                                </div>
                                {/* Hide Create Button for Pastor */}
                                {currentUser.role !== 'pastor' && (
                                    <button onClick={() => { setSelectedEntry(null); setIsModalOpen(true); }} className="bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg transition-all hover:scale-105 text-base flex items-center gap-3 group">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 group-hover:rotate-90 transition-transform" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                        </svg>
                                        Record Contribution
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Filter Controls */}
                        <div className="bg-gradient-to-br from-blue-50 via-cyan-50 to-indigo-50 p-6 rounded-xl shadow-lg border-2 border-blue-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 items-end">
                            <div className="lg:col-span-1">
                                <label className="block text-sm font-bold uppercase text-blue-700 mb-1">🔍 Search Member</label>
                                <input type="text" placeholder="Name..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)} className="block w-full border-2 border-blue-300 rounded-lg shadow-sm py-3 focus:ring-blue-400 focus:border-blue-400 font-medium"/>
                            </div>
                            <div className="lg:col-span-1">
                                <label className="block text-sm font-bold uppercase text-blue-700 mb-1">📚 Class</label>
                                <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="block w-full border-2 border-blue-300 rounded-lg shadow-sm py-3 focus:ring-blue-400 focus:border-blue-400 font-medium">
                                    <option value="all">All Classes</option>
                                    {Array.from({ length: settings.maxClasses }, (_, i) => String(i + 1)).map(num => (<option key={num} value={num}>Class {num}</option>))}
                                </select>
                            </div>
                            <div className="lg:col-span-1">
                                <label className="block text-sm font-bold uppercase text-blue-700 mb-1">💷 Type</label>
                                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as EntryType | 'all')} className="block w-full border-2 border-blue-300 rounded-lg shadow-sm py-3 focus:ring-blue-400 focus:border-blue-400 font-medium">
                                    <option value="all">All Types</option>
                                    {ENTRY_TYPES.map(t => <option key={t} value={t}>{t.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                                </select>
                            </div>
                            <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold uppercase text-blue-700 mb-1">📅 Start Date</label>
                                    <input type="date" value={startDateFilter} onChange={e => setStartDateFilter(e.target.value)} className="block w-full border-2 border-blue-300 rounded-lg shadow-sm py-3 focus:ring-blue-400 focus:border-blue-400 font-medium"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold uppercase text-blue-700 mb-1">📅 End Date</label>
                                    <input type="date" value={endDateFilter} onChange={e => setEndDateFilter(e.target.value)} className="block w-full border-2 border-blue-300 rounded-lg shadow-sm py-3 focus:ring-blue-400 focus:border-blue-400 font-medium"/>
                                </div>
                            </div>
                        </div>

                        {/* Mini Dashboard */}
                        {financialSummary.total > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="col-span-1 bg-gradient-to-br from-orange-300 to-amber-400 p-6 rounded-xl shadow-lg border-2 border-orange-300 flex flex-col justify-center transform hover:scale-105 transition">
                                    <h3 className="text-white font-bold text-sm uppercase tracking-wider">💰 Filtered Total</h3>
                                    <p className="text-4xl font-bold text-white mt-2 drop-shadow">{formatCurrency(financialSummary.total, settings.currency)}</p>
                                    <p className="text-orange-100 text-sm mt-1 font-semibold">{financialSummary.count} entries</p>
                                </div>
                                <div className="col-span-2 bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-xl shadow-lg border-2 border-purple-200 flex items-center">
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
                                            <div key={item.name} className="flex items-center text-sm bg-white bg-opacity-80 px-2 py-1 rounded border-l-4" style={{ borderLeftColor: COLORS[index % COLORS.length] }}>
                                                <span className="w-3 h-3 rounded-full mr-2 font-bold" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                                                <span className="text-slate-700 flex-grow font-medium">{item.name}</span>
                                                <span className="font-bold text-slate-900">{formatCurrency(item.value, settings.currency)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="bg-white rounded-xl shadow-lg border-2 border-slate-200 overflow-hidden">
                            {(currentUser.role === 'admin' || currentUser.role === 'finance-chair') && (
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
                                       <p className="text-xl font-bold">No records found</p>
                                       <p className="text-sm mt-2">Try adjusting your filters</p>
                                   </div>
                               ) : (
                                   sortedDates.map(date => {
                                       const dateEntries = entriesByDate[date];
                                       const dateTotal = dateEntries.reduce((sum, e) => sum + e.amount, 0);
                                       const hasDeleted = dateEntries.some(e => e.deleted);
                                       
                                       return (
                                           <div key={date} className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border-2 border-blue-200 shadow-md hover:shadow-lg transition-all overflow-hidden">
                                               <button 
                                                   onClick={() => {
                                                       setSelectedDateForModal(date);
                                                       setModalClassFilter('all');
                                                       setModalTypeFilter('all');
                                                   }}
                                                   className="w-full p-5 flex items-center justify-between hover:bg-blue-100 transition-colors text-left"
                                               >
                                                   <div className="flex items-center gap-4">
                                                       <div className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white rounded-xl p-4 shadow-md">
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
                                                       <div className="text-sm text-blue-600 font-semibold mt-1 flex items-center gap-1">
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
                                    {/* Modal Header */}
                                    <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 rounded-t-2xl text-white">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h2 className="text-2xl font-bold">{new Date(selectedDateForModal + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h2>
                                                <p className="text-blue-100 mt-1">{entriesByDate[selectedDateForModal].length} contribution{entriesByDate[selectedDateForModal].length !== 1 ? 's' : ''} • Total: {formatCurrency(entriesByDate[selectedDateForModal].reduce((sum, e) => sum + e.amount, 0), settings.currency)}</p>
                                            </div>
                                            <button onClick={() => setSelectedDateForModal(null)} className="text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-lg text-2xl font-bold transition-all">×</button>
                                        </div>
                                        
                                        {/* Filter by Class and Type */}
                                        <div className="flex items-center gap-4 flex-wrap">
                                            <div className="flex items-center gap-3">
                                                <label className="text-sm font-bold text-blue-100">Filter by Class:</label>
                                                <select 
                                                    value={modalClassFilter} 
                                                    onChange={e => setModalClassFilter(e.target.value)}
                                                    className="border-2 border-blue-400 bg-white/95 text-slate-800 rounded-lg px-4 py-2 font-semibold focus:ring-2 focus:ring-white focus:border-white transition-all"
                                                >
                                                    <option value="all">All Classes</option>
                                                    {Array.from({ length: settings.maxClasses }, (_, i) => String(i + 1)).map(num => (
                                                        <option key={num} value={num}>Class {num}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <label className="text-sm font-bold text-blue-100">Filter by Type:</label>
                                                <select 
                                                    value={modalTypeFilter} 
                                                    onChange={e => setModalTypeFilter(e.target.value as EntryType | 'all')}
                                                    className="border-2 border-blue-400 bg-white/95 text-slate-800 rounded-lg px-4 py-2 font-semibold focus:ring-2 focus:ring-white focus:border-white transition-all capitalize"
                                                >
                                                    <option value="all">All Types</option>
                                                    {ENTRY_TYPES.map(t => <option key={t} value={t}>{t.replace(/-/g, ' ')}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Modal Body - Scrollable */}
                                    <div className="flex-1 overflow-y-auto p-6">
                                        <div className="space-y-3">
                                            {entriesByDate[selectedDateForModal]
                                                .filter(entry => {
                                                    // Filter by class
                                                    if (modalClassFilter !== 'all') {
                                                        const member = membersMap.get(entry.memberID);
                                                        const entryClass = entry.classNumber || member?.classNumber;
                                                        if (entryClass !== modalClassFilter) return false;
                                                    }
                                                    // Filter by type
                                                    if (modalTypeFilter !== 'all' && entry.type !== modalTypeFilter) return false;
                                                    return true;
                                                })
                                                .map((entry, idx) => {
                                                const member = membersMap.get(entry.memberID);
                                                const displayClass = entry.classNumber || member?.classNumber || '-';
                                                const isLocked = isMonthLocked(entry.date, monthLocks);
                                                const canEdit = !entry.deleted && currentUser.role !== 'pastor' && (!isLocked || currentUser.role === 'admin' || currentUser.role === 'finance-chair');
                                                
                                                return (
                                                    <div key={entry.id} className={`rounded-xl border-2 p-5 transition-all ${entry.deleted ? 'bg-red-50 border-red-200' : 'bg-gradient-to-r from-slate-50 to-blue-50 border-slate-200 hover:shadow-md'}`}>
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-3 mb-2">
                                                                    <h3 className="text-lg font-bold text-slate-800">{entry.memberName}</h3>
                                                                    {entry.deleted && <span className="text-xs bg-red-200 text-red-800 px-2 py-1 rounded-full font-bold">DELETED</span>}
                                                                    {isLocked && <span title="Month Locked">🔒</span>}
                                                                </div>
                                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                                                    <div>
                                                                        <span className="text-slate-500 font-medium">Member #:</span>
                                                                        <span className="ml-1 font-bold text-slate-700">{member?.memberNumber || '-'}</span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-slate-500 font-medium">Class:</span>
                                                                        <span className="ml-1 font-bold text-slate-700">{displayClass}</span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-slate-500 font-medium">Type:</span>
                                                                        <span className="ml-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold capitalize">{entry.type.replace(/-/g, ' ')}</span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-slate-500 font-medium">Method:</span>
                                                                        <span className="ml-1 font-semibold text-slate-700 capitalize">{entry.method}</span>
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
                                                                            setSelectedEntry(entry); 
                                                                            setIsModalOpen(true); 
                                                                            setSelectedDateForModal(null);
                                                                        }} 
                                                                        className="mt-2 text-blue-600 hover:text-blue-800 font-bold text-sm hover:underline"
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
                                    
                                    {/* Modal Footer */}
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
                    </div>
                );
            case 'development-fund': return <DevelopmentFund members={members} entries={developmentFund} setEntries={setDevelopmentFund} settings={settings} />;
            case 'no-name': return <NoName entries={noNameEntries} setEntries={setNoNameEntries} settings={settings} currentUser={currentUser} />;
            case 'financial-control': return <FinancialControl monthLocks={monthLocks} setMonthLocks={setMonthLocks} currentUser={currentUser} />;
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
        { id: 'financial-control', label: 'Financial Control', roles: ['admin', 'finance-chair'] },
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
                        <nav className="relative overflow-hidden rounded-2xl shadow-xl border border-slate-800/60 p-4 sticky top-6 bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-900">
                            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.15),transparent_40%),radial-gradient(ellipse_at_bottom_right,rgba(236,72,153,0.12),transparent_35%)]"></div>
                            <div className="relative space-y-2">
                                <div className="mb-2 flex items-center justify-between">
                                    <span className="text-slate-300/80 font-bold tracking-wider uppercase text-xs">Navigation</span>
                                    <span className="px-2 py-1 rounded-full text-[10px] font-semibold text-indigo-100 bg-indigo-500/20 border border-indigo-400/30">
                                        {currentUser.role.replace(/-/g, ' ')}
                                    </span>
                                </div>
                                {navItems.map(item => {
                                const hasAccess = item.roles.includes(currentUser.role);
                                const isRestricted = !hasAccess;

                                return (
                                    <button 
                                        key={item.id} 
                                        onClick={() => hasAccess && setActiveTab(item.id as Tab)} 
                                        disabled={isRestricted}
                                        className={`group w-full text-left font-bold px-5 py-4 rounded-xl transition-all duration-200 text-base tracking-wide flex items-center justify-between border ${
                                            activeTab === item.id 
                                                ? 'bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white shadow-lg ring-2 ring-indigo-400/40 border-white/10' 
                                                : isRestricted 
                                                    ? 'text-slate-600/60 cursor-not-allowed opacity-50 bg-slate-900/50 border-white/5' 
                                                    : 'text-slate-300/90 bg-white/0 hover:bg-white/[0.04] hover:text-indigo-200/90 border-white/5'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className={`${activeTab === item.id ? 'h-2 w-2 bg-white/90' : 'h-2 w-2 bg-slate-400/40 group-hover:bg-indigo-300/70'} rounded-full`}></span>
                                            <span>{item.label}</span>
                                            {isRestricted && (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                        </div>
                                        {activeTab === item.id && <span className="text-white/90">›</span>}
                                    </button>
                                );
                             })}
                            </div>
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
