
// App.tsx
import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Header from './components/Header';
import EntryModal from './components/EntryModal';
import ConfirmationModal from './components/ConfirmationModal';
import KeyboardShortcuts from './components/KeyboardShortcuts';
import Login from './components/Login';
import EntryWindowBanner from './components/EntryWindowBanner';
import { ToastProvider } from './components/ToastProvider';
import PasswordChangeModal from './components/PasswordChangeModal';
import BulkChildrenMinistryModal from './components/BulkChildrenMinistryModal';

import { useLocalStorage } from './hooks/useLocalStorage';
import { useSupabaseAutoSync } from './hooks/useSupabaseAutoSync';
import { sanitizeEntry, sanitizeMember, sanitizeUser, sanitizeSettings, sanitizeWeeklyHistoryRecord, capitalize, sanitizeDevelopmentFundEntry, formatCurrency, isMonthLocked, sanitizeNoNameEntry, sanitizeHarvestEntry, getNowEST, getTodayEST, isEntryWindowOpen, formatMethod } from './utils';
import type { Entry, Member, Settings, User, UserRole, Tab, CloudState, WeeklyHistoryRecord, DevelopmentFundEntry, EntryType, MonthLock, NoNameEntry, HarvestEntry, ClassLeader, SundayLock, Requisition, ParkingReceipt, WesleyHallReceipt, Society } from './types';
import { DEFAULT_CURRENCY, DEFAULT_MAX_CLASSES, SUPABASE_URL, SUPABASE_KEY, CANADA_MISSION_SOCIETIES, DEFAULT_SOCIETY } from './constants';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { saveEntryToSupabase, saveHarvestPledgeToSupabase, saveHarvestPledgePayment, loadHarvestPledgesFromSupabase, loadMembersFromSupabase, loadEntriesFromSupabase, loadRequisitions, loadParkingReceipts, loadWesleyHallReceipts, saveUserToSupabase, checkEntryDuplicateInSupabase } from './services/supabase';
import type { HarvestPledge } from './services/supabase';
import ProfileModal from './components/ProfileModal';
import SocietySelector from './components/SocietySelector';

// Lazy-load heavier pages to keep the initial bundle smaller
const Dashboard = lazy(() => import('./components/Dashboard'));
const Members = lazy(() => import('./components/Members'));
const Insights = lazy(() => import('./components/Insights'));
const SettingsTab = lazy(() => import('./components/Settings'));
const UsersTab = lazy(() => import('./components/Users'));
const Utilities = lazy(() => import('./components/Utilities'));
const WeeklyHistory = lazy(() => import('./components/WeeklyHistory'));
const UpcomingBirthdays = lazy(() => import('./components/UpcomingBirthdays'));
const ETransfers = lazy(() => import('./components/ETransfers'));
const Requisitions = lazy(() => import('./components/Requisitions'));
const MyApprovals = lazy(() => import('./components/MyApprovals'));
const Reports = lazy(() => import('./components/Reports'));
const DevelopmentFund = lazy(() => import('./components/DevelopmentFund'));
const NoName = lazy(() => import('./components/NoName'));
const FinancialControl = lazy(() => import('./components/FinancialControl'));
const BibleClassAttendanceSummary = lazy(() => import('./components/BibleClassAttendanceSummary'));
const HarvestPledges = lazy(() => import('./components/HarvestPledges'));
const Harvest = lazy(() => import('./components/Harvest'));
const TaxReceipts = lazy(() => import('./components/TaxReceipts'));
const WesleyHall = lazy(() => import('./components/WesleyHall'));
const Parking = lazy(() => import('./components/Parking'));
const ClassAttendance = lazy(() => import('./components/ClassAttendance'));
const Assets = lazy(() => import('./components/Assets'));
const DayBorn = lazy(() => import('./components/DayBorn'));
const OrganizationFunds = lazy(() => import('./components/OrganizationFunds'));

// Initial Data
const INITIAL_USERS: User[] = [
    { username: 'Admin', password: 'GMCT', role: 'admin' },
    { username: 'FinanceTeam', password: 'GMCT', role: 'finance-team' },
    { username: 'Pastor', password: 'GMCT', role: 'pastor' },
    { username: 'DataEntry', password: 'GMCT', role: 'data-entry' },
    // Shared class-leader account (uses class access codes as password)
    { username: 'ClassLeader', role: 'class-leader' },
];
const INITIAL_SETTINGS: Settings = {
    currency: DEFAULT_CURRENCY,
    maxClasses: DEFAULT_MAX_CLASSES,
    enforceDirectory: true,
    supabaseUrl: SUPABASE_URL,
    supabaseKey: SUPABASE_KEY,
    orgName: '',
    orgAddress: '',
    orgPhone: '',
    orgEmail: '',
    charityNumber: '',
    signatureImage: undefined,
    logoUrl: undefined,
    requisitionApprovalLimits: {
        pastor: { min: 0, max: 500 },
        financeTeam: { min: 501, max: 2000 },
    },
    requisitionPastorLimits: [],
    requisitionFinanceApprovers: [],
};

type SortKey = 'date' | 'memberName' | 'type' | 'amount' | 'classNumber';
type LoginRequest = { username: string; password?: string; skipPassword?: boolean; role?: UserRole };

const normalizeEntryTypeKey = (value?: string): string => (value || '').toLowerCase().replace(/[^a-z]/g, '');
const toNumericAmount = (value: unknown): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
        const parsed = Number.parseFloat(value.replace(/[^0-9.,-]/g, '').replace(/,/g, ''));
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};
const isDeletedFlag = (deleted: unknown): boolean => deleted === true || deleted === 'true' || deleted === 1 || deleted === '1';
const FINANCIAL_ENTRY_TYPES: EntryType[] = [
    'tithe',
    'offering',
    'thanksgiving-offering',
    'pledge',
    'harvest-levy',
    'womens-harvest',
    'mens-harvest',
    'youth-harvest',
    'youth-harvest-levy',
    'organizational-anniversary',
    'day-born',
    'lent-donation',
    'covenant',
    'development-fund',
    'childrens-ministry',
    'other',
];

const App: React.FC = () => {
    // --- State Management (Database-Driven - No localStorage for data) ---
    const [entries, setEntries] = useState<Entry[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [users, setUsers] = useState<User[]>(INITIAL_USERS);
    const [classLeaders, setClassLeaders] = useState<ClassLeader[]>([]);
    const [settings, setSettings] = useLocalStorage<Settings>('gmct-settings', INITIAL_SETTINGS, sanitizeSettings);

    // Multi-tenant Canada Mission Society Selection
    const [selectedSocietyId, setSelectedSocietyId] = useLocalStorage<string>('canada-mission-society-id', 'gmct');
    const [isSelectingSociety, setIsSelectingSociety] = useState(false);

    const selectedSociety: Society = useMemo(() => {
        return CANADA_MISSION_SOCIETIES.find(s => s.id === selectedSocietyId) || DEFAULT_SOCIETY;
    }, [selectedSocietyId]);

    const [weeklyHistory, setWeeklyHistory] = useState<WeeklyHistoryRecord[]>([]);
    const [developmentFund, setDevelopmentFund] = useState<DevelopmentFundEntry[]>([]);
    const [noNameEntries, setNoNameEntries] = useState<NoNameEntry[]>([]);
    const [harvestEntries, setHarvestEntries] = useState<HarvestEntry[]>([]);
    const [harvestPledges, setHarvestPledges] = useState<HarvestPledge[]>([]);
    const [requisitions, setRequisitions] = useState<Requisition[]>([]);
    const [parkingReceipts, setParkingReceipts] = useState<ParkingReceipt[]>([]);
    const [wesleyHallReceipts, setWesleyHallReceipts] = useState<WesleyHallReceipt[]>([]);
    
    // New State for Month Locks
    const [monthLocks, setMonthLocks] = useState<MonthLock[]>([]);
    const [sundayLocks, setSundayLocks] = useState<SundayLock[]>([]);


    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loginError, setLoginError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('home');
    const [reportsTarget, setReportsTarget] = useState<'financial' | 'weekly' | 'birthdays' | null>(null);
        // Global navigation helper so child components can switch tabs without prop drilling
        React.useEffect(() => {
            (window as any).GMCTNavigateTab = (tab: Tab) => setActiveTab(tab);
            return () => { try { delete (window as any).GMCTNavigateTab; } catch {} };
        }, []);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [entryToDeleteId, setEntryToDeleteId] = useState<string | null>(null);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showChildrenMinistryModal, setShowChildrenMinistryModal] = useState(false);
    const [userNotes, setUserNotes] = useLocalStorage<Record<string, string>>('gmct-user-notes', {});
    
    // -- Sorting & Filtering State for Financial Records --
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
    const [searchFilter, setSearchFilter] = useState('');
    const [classFilter, setClassFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState<EntryType | 'all'>('all');
    const [dayBornFilter, setDayBornFilter] = useState<'all' | 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'>('all');
    const [startDateFilter, setStartDateFilter] = useState('');
    const [endDateFilter, setEndDateFilter] = useState('');
    const [balanceDateFilter, setBalanceDateFilter] = useState('');
    const [isBalancePanelCollapsed, setIsBalancePanelCollapsed] = useState(true);
    const [showDeleted, setShowDeleted] = useState(false);
    const [selectedDateForModal, setSelectedDateForModal] = useState<string | null>(null);
    const [modalClassFilter, setModalClassFilter] = useState<string>('all');
    const [modalTypeFilter, setModalTypeFilter] = useState<EntryType | 'all'>('all');
    const [modalDeletedFilter, setModalDeletedFilter] = useState<'all' | 'active' | 'deleted'>('all');
    
    // Financial Records year/month folder state
    const [finRecordsExpandedYears, setFinRecordsExpandedYears] = useState<Set<string>>(new Set());
    const [finRecordsExpandedMonths, setFinRecordsExpandedMonths] = useState<Set<string>>(new Set());

    // Navigation collapse state
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    // Password change modal state
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

    const [cloud, setCloud] = useState<CloudState>({ ready: false, message: "" });

    // Restrict statistician accounts to Weekly History only
    useEffect(() => {
        if (currentUser?.role === 'statistician' && activeTab !== 'weekly-history') {
            setActiveTab('weekly-history');
        }
    }, [currentUser?.role, activeTab]);

    // --- Live Sync Hook ---
    const syncStatus = useSupabaseAutoSync(settings, {
        entries, members, history: weeklyHistory, users, monthLocks, sundayLocks, classLeaders
    }, {
        setEntries, setMembers, setHistory: setWeeklyHistory, setUsers, setMonthLocks, setSundayLocks, setSettings, setClassLeaders
    });
    // Track whether we've ever reached a connected state; after that, don't block UI entirely
    const [hasConnected, setHasConnected] = useState(false);
    useEffect(() => {
        if (syncStatus.state === 'synced') setHasConnected(true);
    }, [syncStatus.state]);
    
    // --- Load All Data from Database on mount or when connection is ready ---
    useEffect(() => {
        if (!settings.supabaseUrl || !settings.supabaseKey) return;
        if (syncStatus.state !== 'synced') return; // Wait until synced
        
        // Load all data from database in parallel with fallback error handling
        Promise.all([
            loadMembersFromSupabase(settings.supabaseUrl, settings.supabaseKey).catch(err => { console.warn('Members load failed:', err); return []; }),
            loadEntriesFromSupabase(settings.supabaseUrl, settings.supabaseKey).catch(err => { console.warn('Entries load failed:', err); return []; }),
            loadHarvestPledgesFromSupabase(settings.supabaseUrl, settings.supabaseKey).catch(err => { console.warn('Harvest pledges load failed:', err); return []; }),
            loadRequisitions(settings.supabaseUrl, settings.supabaseKey).catch(err => { console.warn('Requisitions load failed:', err); return []; }),
            loadParkingReceipts(settings.supabaseUrl, settings.supabaseKey).catch(err => { console.warn('Parking receipts load failed:', err); return []; }),
            loadWesleyHallReceipts(settings.supabaseUrl, settings.supabaseKey).catch(err => { console.warn('Wesley Hall receipts load failed:', err); return []; })
        ]).then(([loadedMembers, loadedEntries, loadedPledges, loadedRequisitions, loadedParkingReceipts, loadedWesleyHallReceipts]) => {
            if (loadedMembers && loadedMembers.length > 0) {
                setMembers(loadedMembers);
            }
            if (loadedEntries && loadedEntries.length > 0) {
                setEntries(loadedEntries);
            }
            if (loadedPledges && loadedPledges.length > 0) {
                setHarvestPledges(loadedPledges);
            }
            if (loadedRequisitions && loadedRequisitions.length > 0) {
                setRequisitions(loadedRequisitions);
            }
            setParkingReceipts(loadedParkingReceipts || []);
            setWesleyHallReceipts(loadedWesleyHallReceipts || []);
        }).catch(err => console.error('Failed to load data from database:', err));
    }, [settings.supabaseUrl, settings.supabaseKey, syncStatus.state]);

    useEffect(() => {
        if (activeTab !== 'records' || !settings.supabaseUrl || !settings.supabaseKey || syncStatus.state !== 'synced') return;

        Promise.all([
            loadParkingReceipts(settings.supabaseUrl, settings.supabaseKey),
            loadWesleyHallReceipts(settings.supabaseUrl, settings.supabaseKey),
        ]).then(([loadedParkingReceipts, loadedWesleyHallReceipts]) => {
            setParkingReceipts(loadedParkingReceipts);
            setWesleyHallReceipts(loadedWesleyHallReceipts);
        }).catch(err => console.warn('Shared income receipts refresh failed:', err));
    }, [activeTab, settings.supabaseUrl, settings.supabaseKey, syncStatus.state]);

    // --- Seed ClassLeader user to database if it doesn't exist ---
    useEffect(() => {
        if (!settings.supabaseUrl || !settings.supabaseKey || syncStatus.state !== 'synced') return;
        if (users.length === 0) return; // Wait for users to load
        
        const hasClassLeader = users.some(u => u.username.toLowerCase() === 'classleader');
        if (!hasClassLeader) {
            const classLeaderUser: User = {
                username: 'ClassLeader',
                password: '',
                role: 'class-leader'
            };
            saveUserToSupabase(settings.supabaseUrl, settings.supabaseKey, classLeaderUser)
                .then(() => {
                    setUsers(prev => [...prev, classLeaderUser]);
                    console.log('ClassLeader user seeded to database');
                })
                .catch(err => console.warn('Failed to seed ClassLeader:', err));
        }
    }, [settings.supabaseUrl, settings.supabaseKey, syncStatus.state, users]);
    
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

    // --- Idle Auto Logout (15 minutes default) ---
    useEffect(() => {
        if (!currentUser) return; // No logout needed if not logged in

        const IDLE_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds
        let timeoutId: NodeJS.Timeout | null = null;
        let activityListenerCount = 0;

        const resetIdleTimer = () => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                handleLogout();
                alert('Your session has expired due to inactivity. Please log back in.');
            }, IDLE_TIMEOUT);
        };

        const handleActivity = () => {
            resetIdleTimer();
        };

        // Track user activity: click, keypress, and mouse move
        const events = ['click', 'keypress', 'mousemove', 'scroll', 'touchstart'];
        events.forEach(event => {
            window.addEventListener(event, handleActivity, true);
        });

        // Initialize the timer
        resetIdleTimer();

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            events.forEach(event => {
                window.removeEventListener(event, handleActivity, true);
            });
        };
    }, [currentUser]);

    // --- Load Harvest Pledges from Supabase on startup ---
    useEffect(() => {
        if (!settings.supabaseUrl || !settings.supabaseKey) return;
        if (harvestPledges.length > 0) return; // Only load if empty
        
        loadHarvestPledgesFromSupabase(settings.supabaseUrl, settings.supabaseKey)
            .then(pledges => {
                if (pledges && pledges.length > 0) {
                    setHarvestPledges(pledges);
                }
            })
            .catch(err => console.error('Failed to load harvest pledges:', err));
    }, [settings.supabaseUrl, settings.supabaseKey]);
    
    // --- Derived State ---
    const membersMap = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);
    const membersByNameMap = useMemo(() => {
        const map = new Map<string, Member>();
        members.forEach(member => {
            const key = (member.name || '').trim().toLowerCase();
            if (key && !map.has(key)) map.set(key, member);
        });
        return map;
    }, [members]);

    // Keep Day Born filter aligned with type selection
    useEffect(() => {
        if (typeFilter !== 'day-born' && dayBornFilter !== 'all') {
            setDayBornFilter('all');
        }
    }, [typeFilter, dayBornFilter]);

    // Lock date filters to today for data-entry role
    useEffect(() => {
        if (currentUser?.role === 'data-entry') {
            const today = getTodayEST();
            setStartDateFilter(today);
            setEndDateFilter(today);
        }
    }, [currentUser]);

    const filteredAndSortedEntries = useMemo(() => {
        const matchesTypeFilter = (entryType: string, filter: EntryType | 'all') => {
            if (filter === 'all') return true;
            if (filter === 'day-born') return normalizeEntryTypeKey(entryType) === 'dayborn';
            return entryType === filter;
        };

        const getMemberDayBorn = (member?: Member) => {
            if (!member) return undefined;
            if (member.dayBorn) return member.dayBorn.toLowerCase().trim();
            if (member.dateOfBirth) {
                const dob = new Date(`${member.dateOfBirth}T00:00:00`);
                if (!Number.isNaN(dob.getTime())) {
                    return dob.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                }
            }
            return undefined;
        };

        const filtered = entries.filter(entry => {
            // Soft Delete check
            if (isDeletedFlag(entry.deleted) && !showDeleted) return false;
            
            if (searchFilter && !entry.memberName.toLowerCase().includes(searchFilter.toLowerCase())) return false;
            if (!matchesTypeFilter(entry.type, typeFilter)) return false;

            const entryDate = (entry.date || '').slice(0, 10);
            if (startDateFilter && entryDate < startDateFilter) return false;
            if (endDateFilter && entryDate > endDateFilter) return false;
            
            const member = membersMap.get(entry.memberID) || membersByNameMap.get((entry.memberName || '').trim().toLowerCase());
            const entryClass = entry.classNumber || member?.classNumber;
            
            if (classFilter !== 'all' && entryClass !== classFilter) return false;
            const memberDayBorn = getMemberDayBorn(member);
            if (typeFilter === 'day-born' && dayBornFilter !== 'all' && memberDayBorn !== dayBornFilter) return false;
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
    }, [entries, sortConfig, membersMap, membersByNameMap, searchFilter, classFilter, typeFilter, startDateFilter, endDateFilter, showDeleted, dayBornFilter]);

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

    // Group dates by year and month for folder structure
    const entriesByYearMonth = useMemo(() => {
        const groups: { [year: string]: { [month: string]: string[] } } = {};
        
        sortedDates.forEach(date => {
            const dateObj = new Date(date + 'T00:00:00');
            const year = dateObj.getFullYear().toString();
            const month = dateObj.toLocaleString('default', { month: 'long' });
            
            if (!groups[year]) groups[year] = {};
            if (!groups[year][month]) groups[year][month] = [];
            groups[year][month].push(date);
        });
        
        return groups;
    }, [sortedDates]);

    // Auto-expand most recent year and month for financial records
    useEffect(() => {
        const years = Object.keys(entriesByYearMonth).sort((a, b) => parseInt(b) - parseInt(a));
        if (years.length > 0 && finRecordsExpandedYears.size === 0) {
            const mostRecentYear = years[0];
            setFinRecordsExpandedYears(new Set([mostRecentYear]));
            
            const months = Object.keys(entriesByYearMonth[mostRecentYear]);
            if (months.length > 0) {
                const monthOrder = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                const sortedMonths = months.sort((a, b) => monthOrder.indexOf(b) - monthOrder.indexOf(a));
                setFinRecordsExpandedMonths(new Set([`${mostRecentYear}-${sortedMonths[0]}`]));
            }
        }
    }, [entriesByYearMonth]);

    const toggleFinRecordsYear = (year: string) => {
        const newExpanded = new Set(finRecordsExpandedYears);
        if (newExpanded.has(year)) {
            newExpanded.delete(year);
        } else {
            newExpanded.add(year);
        }
        setFinRecordsExpandedYears(newExpanded);
    };

    const toggleFinRecordsMonth = (yearMonth: string) => {
        const newExpanded = new Set(finRecordsExpandedMonths);
        if (newExpanded.has(yearMonth)) {
            newExpanded.delete(yearMonth);
        } else {
            newExpanded.add(yearMonth);
        }
        setFinRecordsExpandedMonths(newExpanded);
    };

    // Financial Mini Dashboard Data
    const financialSummary = useMemo(() => {
        // Only calculate based on non-deleted entries for accuracy
        const activeEntries = filteredAndSortedEntries.filter(e => !isDeletedFlag(e.deleted));
        const matchesSharedReceiptFilters = (receipt: ParkingReceipt | WesleyHallReceipt) => {
            const receiptDate = (receipt.date || '').slice(0, 10);
            if (startDateFilter && receiptDate < startDateFilter) return false;
            if (endDateFilter && receiptDate > endDateFilter) return false;
            return searchFilter.trim() === '' && classFilter === 'all' && typeFilter === 'all';
        };
        const activeParkingReceipts = parkingReceipts.filter(receipt => !isDeletedFlag(receipt.deleted) && matchesSharedReceiptFilters(receipt));
        const activeWesleyHallReceipts = wesleyHallReceipts.filter(receipt => !isDeletedFlag(receipt.deleted) && matchesSharedReceiptFilters(receipt));
        const parkingTotal = activeParkingReceipts.reduce((sum, receipt) => sum + toNumericAmount(receipt.amount), 0);
        const wesleyHallTotal = activeWesleyHallReceipts.reduce((sum, receipt) => sum + toNumericAmount(receipt.amount), 0);
        const total = activeEntries.reduce((sum, e) => sum + toNumericAmount(e.amount), 0) + parkingTotal + wesleyHallTotal;
        const count = activeEntries.length + activeParkingReceipts.length + activeWesleyHallReceipts.length;
        
        const typeDistribution: Record<string, number> = {};
        FINANCIAL_ENTRY_TYPES.forEach(type => {
            typeDistribution[type] = 0;
        });

        activeEntries.forEach(e => {
            const typeKey = normalizeEntryTypeKey(e.type) === 'dayborn' ? 'day-born' : e.type;
            typeDistribution[typeKey] = (typeDistribution[typeKey] || 0) + toNumericAmount(e.amount);
        });
        typeDistribution.parking = parkingTotal;
        typeDistribution['wesley-hall'] = wesleyHallTotal;
        
        const chartData = Object.entries(typeDistribution).map(([name, value]) => ({
            name: capitalize(name.replace(/-/g, ' ')),
            value
        })).sort((a, b) => b.value - a.value);

        return { total, count, chartData };
    }, [filteredAndSortedEntries, parkingReceipts, wesleyHallReceipts, searchFilter, classFilter, typeFilter, startDateFilter, endDateFilter]);

    const dailyMethodBreakdown = useMemo(() => {
        const normalizeMethodForBalance = (method?: string): 'cash' | 'check' | 'e-transfer' | 'other' => {
            const normalized = (method || '').toLowerCase().trim();
            if (normalized === 'cash') return 'cash';
            if (normalized === 'check' || normalized === 'cheque') return 'check';
            if (normalized === 'e-transfer' || normalized === 'etransfer' || normalized === 'transfer') return 'e-transfer';
            return 'other';
        };

        const sourceDate = currentUser?.role === 'data-entry' ? getTodayEST() : balanceDateFilter;
        const selectedDate = sourceDate || (startDateFilter && startDateFilter === endDateFilter ? startDateFilter : '');
        const activeEntries = filteredAndSortedEntries.filter(e => !isDeletedFlag(e.deleted));
        const dateEntries = selectedDate
            ? activeEntries.filter(e => (e.date || '').slice(0, 10) === selectedDate)
            : [];

        const byMethod = {
            cash: { amount: 0, count: 0 },
            'e-transfer': { amount: 0, count: 0 },
            check: { amount: 0, count: 0 },
        };

        dateEntries.forEach(entry => {
            const method = normalizeMethodForBalance(entry.method);
            const amount = toNumericAmount(entry.amount);
            if (method === 'cash' || method === 'e-transfer' || method === 'check') {
                byMethod[method].amount += amount;
                byMethod[method].count += 1;
            }
        });

        return {
            selectedDate,
            total: dateEntries.reduce((sum, e) => sum + toNumericAmount(e.amount), 0),
            totalCount: dateEntries.length,
            ...byMethod,
        };
    }, [filteredAndSortedEntries, balanceDateFilter, startDateFilter, endDateFilter, currentUser?.role]);

    const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#f43f5e', '#0ea5e9', '#8b5cf6'];

    // --- Handlers ---
    const handleLogin = ({ username, password = '', skipPassword = false }: LoginRequest) => {
        console.log('🔐 Login attempt:', { username, role: 'checking...' });
        console.log('  classLeaders in state:', classLeaders.length, classLeaders);
        const normalize = (val: string | undefined) => (val || '').trim().toLowerCase();
        const foundUser = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        const classLeaderFallback = username.trim().toLowerCase() === 'classleader'
            ? ({ username: 'ClassLeader', role: 'class-leader' as UserRole })
            : null;
        const user = foundUser || classLeaderFallback;

        if (!user) {
            setLoginError('Invalid username or password.');
            return;
        }

        // Special handling for class leaders: authenticate using class_leaders table (preferred)
        if (user.role === 'class-leader') {
            const raw = (password || '').trim();
            const lower = normalize(raw);

            // 0) If the username matches a specific class leader, validate their password and use their class
            const matchedLeaderByUsername = classLeaders.find(cl => (cl.username || '').toLowerCase() === username.trim().toLowerCase());
            if (matchedLeaderByUsername) {
                if (!matchedLeaderByUsername.password || matchedLeaderByUsername.password !== raw) {
                    setLoginError('Invalid password for class leader account.');
                    return;
                }
                const assignedClass = matchedLeaderByUsername.classNumber;
                if (!assignedClass) {
                    setLoginError('Class leader has no assigned class. Contact admin.');
                    return;
                }
                const sessionUser = { username: matchedLeaderByUsername.username, role: 'class-leader' as UserRole, assignedClass } as User;
                setCurrentUser(sessionUser);
                setLoginError(null);
                setActiveTab('attendance');
                return;
            }

            // 1) Shared "ClassLeader" login: resolve class by matching an access code from class_leaders table
            const matchedLeaderByAccessCode = classLeaders.find(cl => normalize(cl.accessCode) === lower);

            let assignedClass = (user as User).assignedClass || (user as User).classLed;

            // Admin override: exact password match on stored app user keeps assigned class
            if (!(user as User).password || (user as User).password !== raw) {
                if (matchedLeaderByAccessCode?.classNumber) {
                    assignedClass = matchedLeaderByAccessCode.classNumber;
                } else {
                    // 2) Fallback patterns like "class1", "class 3", "class-7"
                    const classMatch = lower.match(/class\s*-?\s*(\d{1,2})/);
                    if (classMatch) {
                        const clsNum = parseInt(classMatch[1], 10);
                        if (clsNum >= 1 && clsNum <= settings.maxClasses) assignedClass = String(clsNum);
                    } else {
                        // 3) Accept direct numeric passwords (e.g., "1", "07")
                        const numMatch = lower.match(/^(\d{1,2})$/);
                        if (numMatch) {
                            const clsNum = parseInt(numMatch[1], 10);
                            if (clsNum >= 1 && clsNum <= settings.maxClasses) assignedClass = String(clsNum);
                        }
                    }
                }
            }

            if (!assignedClass) {
                setLoginError('Invalid class access code. Contact admin for your class code.');
                return;
            }

            const sessionUser = { ...user, assignedClass, role: 'class-leader' as UserRole } as User;
            setCurrentUser(sessionUser);
            setLoginError(null);
            setActiveTab('attendance');
            return;
        }

        // All other roles: require exact password match
        if (!foundUser) {
            setLoginError('Invalid username or password.');
            return;
        }

        const skipAllowed = foundUser.role === 'data-entry';
        if (!skipPassword && foundUser.password !== password) {
            setLoginError('Invalid username or password.');
            return;
        }
        if (skipPassword && !skipAllowed) {
            setLoginError('Password required for this role.');
            return;
        }

        setCurrentUser(foundUser);
        setLoginError(null);
        // Intelligent Redirect based on Role
        if (foundUser.role === 'admin' || foundUser.role === 'finance-chair' || foundUser.role === 'pastor') setActiveTab('home');
        else if (foundUser.role === 'finance-team') setActiveTab('records');
        else if (foundUser.role === 'data-entry') setActiveTab('records');
        else if (foundUser.role === 'statistician') setActiveTab('weekly-history');
        else setActiveTab('home');
    };

    // Show profile modal automatically for finance-team and class-leader roles
    useEffect(() => {
        if (currentUser && (currentUser.role === 'finance-team' || currentUser.role === 'class-leader')) {
            setShowProfileModal(true);
        }
    }, [currentUser]);

    const handleLogout = () => setCurrentUser(null);

    // Keyboard shortcut navigation
    const handleNavigate = (page: string) => {
        const tabMap: { [key: string]: Tab } = {
            'dashboard': 'home',
            'members': 'members',

            'records': 'records',
            'insights': 'insights',
            'history': 'reports'
        };
        const tab = tabMap[page];
        if (tab) setActiveTab(tab);
    };

    const getMemberKey = (entry: Entry) => {
        if (entry.memberID && entry.memberID.trim() !== '') return `id:${entry.memberID.trim().toLowerCase()}`;
        if (entry.type === 'childrens-ministry') return 'childrens-ministry-collection';
        const normalizedName = (entry.memberName || '').trim().toLowerCase();
        return normalizedName ? `name:${normalizedName}` : 'name:';
    };

    const isDuplicateEntry = (entry: Entry) => {
        const targetMemberKey = getMemberKey(entry);
        return entries.some(e =>
            e.id !== entry.id &&
            !e.deleted &&
            e.date === entry.date &&
            e.type === entry.type &&
            getMemberKey(e) === targetMemberKey
        );
    };

    const handleSaveEntry = async (entry: Entry) => {
        if (!settings.supabaseUrl || !settings.supabaseKey || syncStatus.state !== 'synced') {
            alert('Writes are disabled until connected to the cloud. Please ensure Supabase is configured and the app shows Connected.');
            return;
        }

        if (isDuplicateEntry(entry)) {
            alert(`Duplicate entry detected: a ${entry.type.replace(/-/g, ' ')} record already exists for this member on ${entry.date}.`);
            return;
        }

        try {
            const hasCloudDuplicate = await checkEntryDuplicateInSupabase(settings.supabaseUrl, settings.supabaseKey, entry);
            if (hasCloudDuplicate) {
                alert(`Duplicate entry blocked by cloud check: a ${entry.type.replace(/-/g, ' ')} record already exists for this member on ${entry.date}.`);
                const refreshedEntries = await loadEntriesFromSupabase(settings.supabaseUrl, settings.supabaseKey);
                setEntries(refreshedEntries);
                return;
            }

            await saveEntryToSupabase(settings.supabaseUrl, settings.supabaseKey, entry);
            // Reload entries from database
            const updatedEntries = await loadEntriesFromSupabase(settings.supabaseUrl, settings.supabaseKey);
            setEntries(updatedEntries);
            setIsModalOpen(false);
        } catch (error: any) {
            alert(`Failed to save entry: ${error.message}`);
        }
    };

    const handleSaveAndNew = async (entry: Entry) => {
        if (!settings.supabaseUrl || !settings.supabaseKey || syncStatus.state !== 'synced') {
            alert('Writes are disabled until connected to the cloud. Please ensure Supabase is configured and the app shows Connected.');
            return;
        }

        if (isDuplicateEntry(entry)) {
            alert(`Duplicate entry detected: a ${entry.type.replace(/-/g, ' ')} record already exists for this member on ${entry.date}.`);
            return;
        }

        try {
            const hasCloudDuplicate = await checkEntryDuplicateInSupabase(settings.supabaseUrl, settings.supabaseKey, entry);
            if (hasCloudDuplicate) {
                alert(`Duplicate entry blocked by cloud check: a ${entry.type.replace(/-/g, ' ')} record already exists for this member on ${entry.date}.`);
                const refreshedEntries = await loadEntriesFromSupabase(settings.supabaseUrl, settings.supabaseKey);
                setEntries(refreshedEntries);
                return;
            }

            await saveEntryToSupabase(settings.supabaseUrl, settings.supabaseKey, entry);
            // Reload entries from database
            const updatedEntries = await loadEntriesFromSupabase(settings.supabaseUrl, settings.supabaseKey);
            setEntries(updatedEntries);
        } catch (error: any) {
            alert(`Failed to save entry: ${error.message}`);
        }
    };
    
    const handleDeleteEntry = async (id: string) => {
        // EntryModal already confirms and writes soft-delete to Supabase.
        // Here we keep UI in sync immediately and then refresh from server.
        setEntries(prev => prev.map(e => e.id === id ? { ...e, deleted: true } : e));

        if (!settings.supabaseUrl || !settings.supabaseKey || syncStatus.state !== 'synced') {
            return;
        }

        try {
            const updatedEntries = await loadEntriesFromSupabase(settings.supabaseUrl, settings.supabaseKey);
            setEntries(updatedEntries);
        } catch (error) {
            console.error('Failed to refresh entries after delete:', error);
        }
    };

    // Soft Delete Logic
    const confirmDeleteEntry = async () => {
        const canDelete = currentUser && ['admin', 'finance-chair', 'finance-team'].includes(currentUser.role);
        if (!canDelete) {
            alert('Only Admin, Finance Chair, or Finance Team can delete entries.');
            setIsConfirmModalOpen(false);
            setEntryToDeleteId(null);
            return;
        }
        if (!settings.supabaseUrl || !settings.supabaseKey || syncStatus.state !== 'synced') {
            alert('Deletes are disabled until connected to the cloud. Please ensure Supabase is configured and the app shows Connected.');
            setIsConfirmModalOpen(false);
            setEntryToDeleteId(null);
            return;
        }
        if (entryToDeleteId) {
            const entryIndex = entries.findIndex(e => e.id === entryToDeleteId);
            if (entryIndex > -1) {
                const entryToDelete = {
                    ...entries[entryIndex],
                    deleted: true,
                    updatedBy: currentUser?.username || 'Unknown',
                    lastUpdated: getNowEST()
                };

                try {
                    await saveEntryToSupabase(settings.supabaseUrl, settings.supabaseKey, entryToDelete);
                    // Reload entries from database
                    const updatedEntries = await loadEntriesFromSupabase(settings.supabaseUrl, settings.supabaseKey);
                    setEntries(updatedEntries);
                } catch (error: any) {
                    alert(`Failed to delete entry: ${error.message}`);
                }
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
    
    // --- Connection Gate: require cloud connection before using the app ---
    const isConfigured = !!settings.supabaseUrl && settings.supabaseUrl.trim() !== '' && !!settings.supabaseKey && settings.supabaseKey.trim() !== '';

    if (!isConfigured) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 p-6">
                <div className="bg-white border-2 border-slate-200 rounded-2xl p-8 shadow-xl max-w-xl w-full text-center">
                    <h1 className="text-2xl font-extrabold text-slate-800 mb-2">Supabase Not Configured</h1>
                    <p className="text-slate-600 mb-6">Please set your Supabase URL and Key in Settings or via defaults in constants. The app requires a cloud connection to operate.</p>
                    <div className="text-sm text-slate-500">Tip: Edit constants in <span className="font-mono">constants.ts</span> to pre-fill credentials.</div>
                </div>
            </div>
        );
    }

    if (!hasConnected && syncStatus.state !== 'synced') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 p-6">
                <div className="bg-white border-2 border-indigo-200 rounded-2xl p-8 shadow-xl max-w-xl w-full text-center">
                    <div className="flex items-center justify-center mb-4">
                        {syncStatus.state === 'error' ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-rose-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                        ) : (
                            <svg className="animate-spin h-10 w-10 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        )}
                    </div>
                    <h1 className="text-2xl font-extrabold text-slate-800 mb-2">{syncStatus.state === 'error' ? 'Connection Failed' : 'Connecting to Cloud...'}</h1>
                    <p className="text-slate-600 mb-6">{syncStatus.state === 'error' ? (syncStatus.errorMessage || 'Unable to connect to Supabase.') : 'Please wait while we connect and sync your data.'}</p>
                    {syncStatus.state === 'error' && (
                        <button onClick={() => window.location.reload()} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-2 px-6 rounded-lg shadow-md">Retry</button>
                    )}
                </div>
            </div>
        );
    }

    if (!currentUser) {
        if (isSelectingSociety) {
            return (
                <SocietySelector
                    currentSocietyId={selectedSocietyId}
                    onSelectSociety={(soc) => {
                        setSelectedSocietyId(soc.id);
                        setIsSelectingSociety(false);
                    }}
                />
            );
        }
        return (
            <Login
                users={users}
                onLogin={handleLogin}
                error={loginError}
                settings={settings}
                selectedSociety={selectedSociety}
                onChangeSociety={() => setIsSelectingSociety(true)}
            />
        );
    }

    const ENTRY_TYPES: EntryType[] = ["tithe", "offering", "thanksgiving-offering", "pledge", "harvest-levy", "womens-harvest", "mens-harvest", "youth-harvest", "youth-harvest-levy", "organizational-anniversary", "day-born", "lent-donation", "covenant", "development-fund", "childrens-ministry", "other"];

    const renderTabContent = () => {
        // Class leaders are restricted to attendance only
        if (currentUser.role === 'class-leader' && activeTab !== 'attendance') {
            return <div className="p-8 text-center text-slate-500">Access Denied. Class Leaders can only take attendance for their class.</div>;
        }
        // Double check access before rendering restrictive tabs
        if (activeTab === 'utilities' && currentUser.role !== 'admin') {
            return <div className="p-8 text-center text-slate-500">Access Denied. Administrator privileges required.</div>;
        }
        if (activeTab === 'users' && currentUser.role !== 'admin') {
             return <div className="p-8 text-center text-slate-500">Access Denied. Administrator privileges required.</div>;
        }
        if (activeTab === 'settings' && currentUser.role !== 'admin') {
            return <div className="p-8 text-center text-slate-500">Access Denied. Only Admin can access Settings.</div>;
        }
        if (activeTab === 'tax-receipts' && !(currentUser.role === 'admin' || currentUser.role === 'finance-chair')) {
            return <div className="p-8 text-center text-slate-500">Access Denied. Only Admin and Finance Chair can issue receipts.</div>;
        }
        if (activeTab === 'requisitions' && currentUser.role === 'data-entry') {
            return <div className="p-8 text-center text-slate-500">Access Denied. Requisitions are not available for Data Entry role.</div>;
        }
        if (activeTab === 'wesley-hall' && currentUser.role === 'data-entry') {
            return <div className="p-8 text-center text-slate-500">Access Denied. Wesley Hall is not available for Data Entry role.</div>;
        }
        if (activeTab === 'parking' && currentUser.role === 'data-entry') {
            return <div className="p-8 text-center text-slate-500">Access Denied. Parking is not available for Data Entry role.</div>;
        }
        if (activeTab === 'organization-funds' && !['admin', 'finance-chair', 'finance-team', 'pastor'].includes(currentUser.role)) {
            return <div className="p-8 text-center text-slate-500">Access Denied. Organization Funds is available only to Admin, Finance, and Pastor roles.</div>;
        }

        const canWrite = syncStatus.state === 'synced';
        const canViewFilteredTotals = currentUser.role !== 'data-entry';

        const handlePayPledge = (pledge: HarvestPledge, amount: number, paymentDate: string) => {
            if (!settings.supabaseUrl || !settings.supabaseKey || syncStatus.state !== 'synced') {
                alert('Writes are disabled until connected to the cloud. Please ensure Supabase is configured and the app shows Connected.');
                return;
            }
            if (amount <= 0 || amount > pledge.remaining) return;

            // Create a financial entry for the payment
            const paymentEntry: Entry = {
                id: crypto.randomUUID(),
                date: paymentDate,
                memberID: pledge.memberID,
                memberName: pledge.memberName,
                classNumber: pledge.classNumber,
                type: 'harvest-levy',
                fund: 'harvest',
                method: 'cash',
                amount: amount,
                note: `Harvest pledge payment (Pledge ID: ${pledge.id.substring(0, 8)})`,
                createdBy: currentUser?.username,
                createdAt: getNowEST(),
            };

            // Update pledge remaining amount
            const updatedPledge: HarvestPledge = {
                ...pledge,
                remaining: Math.max(0, pledge.remaining - amount),
                updatedBy: currentUser?.username,
                lastUpdated: getNowEST()
            };

            // Save to Supabase and reload data
            if (settings.supabaseUrl && settings.supabaseKey) {
                Promise.all([
                    saveHarvestPledgeToSupabase(settings.supabaseUrl, settings.supabaseKey, updatedPledge),
                    saveEntryToSupabase(settings.supabaseUrl, settings.supabaseKey, paymentEntry),
                    saveHarvestPledgePayment(settings.supabaseUrl, settings.supabaseKey, pledge.id, paymentEntry.id, amount, paymentDate, currentUser?.username)
                ]).then(() => {
                    // Reload data from database
                    return Promise.all([
                        loadHarvestPledgesFromSupabase(settings.supabaseUrl!, settings.supabaseKey!),
                        loadEntriesFromSupabase(settings.supabaseUrl!, settings.supabaseKey!)
                    ]);
                }).then(([updatedPledges, updatedEntries]) => {
                    setHarvestPledges(updatedPledges);
                    setEntries(updatedEntries);
                }).catch(err => console.error("Error saving pledge payment:", err));
            }
        };
        switch (activeTab) {
            case 'home': return <Dashboard entries={entries} members={members} settings={settings} currentUser={currentUser} monthLocks={monthLocks} sundayLocks={sundayLocks} requisitions={requisitions} parkingReceipts={parkingReceipts} wesleyHallReceipts={wesleyHallReceipts}/>;
            case 'harvest':
                return (
                    <Harvest 
                        members={members}
                        entries={entries.filter(e => {
                            const type = (e.type || '').toLowerCase();
                            const note = (e.note || '').toLowerCase();
                            const group = (e.groupName || '').toLowerCase();
                            const combined = `${type} ${note} ${group}`;
                            return ['harvest-levy', 'harvest', 'harvest-pledge', 'harvest-launch', 'womens-harvest', 'mens-harvest', 'youth-harvest', 'youth-harvest-levy'].includes(type)
                                || ['harvest', 'levy', 'pledge', 'launch', 'men', 'women', 'youth'].some(keyword => combined.includes(keyword));
                        })}
                        setEntries={setEntries}
                        settings={settings}
                        currentUser={currentUser}
                        syncStatus={syncStatus}
                        onCreatePledges={async (newPledges) => {
                            // Reload entries from database after pledges are created
                            if (settings.supabaseUrl && settings.supabaseKey) {
                                const updatedEntries = await loadEntriesFromSupabase(settings.supabaseUrl, settings.supabaseKey);
                                setEntries(updatedEntries);
                            }
                        }}
                    />
                );
            case 'reports':
                return (
                    <Reports 
                        entries={entries}
                        harvestEntries={harvestEntries}
                        members={members}
                        settings={settings}
                        history={weeklyHistory}
                        setHistory={setWeeklyHistory}
                        setEntries={setEntries}
                    />
                );
            case 'requisitions':
                return (
                    <Requisitions settings={settings} currentUser={currentUser} />
                );
            case 'my-approvals':
                return (
                    <MyApprovals settings={settings} currentUser={currentUser} onDecisionSaved={refreshRequisitions} />
                );
            case 'organization-funds':
                return (
                    <OrganizationFunds settings={settings} currentUser={currentUser} canWrite={canWrite} />
                );
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
                                {(() => {
                                    const allowedRoles = ['admin','finance-chair','finance-team','data-entry'];
                                    const canSee = currentUser && allowedRoles.includes(currentUser.role);
                                    const windowStatus = isEntryWindowOpen(settings.entryWindow);
                                    const canOverride = currentUser?.role === 'admin' || currentUser?.role === 'finance-chair';
                                    const disabled = !canWrite || (!windowStatus.isOpen && !canOverride);
                                    const title = !canWrite ? 'Requires cloud connection' : (!windowStatus.isOpen && !canOverride ? `${windowStatus.reason}. ${windowStatus.nextOpenTime}` : undefined);
                                    return canSee ? (
                                        <button onClick={() => { setSelectedEntry(null); setIsModalOpen(true); }} disabled={disabled} title={title} className={`bg-gradient-to-br from-green-500 to-emerald-600 text-white font-bold py-4 px-8 rounded-xl shadow-lg text-base flex items-center gap-3 group transition-all ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:from-green-600 hover:to-emerald-700 hover:scale-105'}`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 group-hover:rotate-90 transition-transform" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                        </svg>
                                        Record Contribution
                                        </button>
                                    ) : null;
                                })()}
                                <button onClick={() => setShowChildrenMinistryModal(true)} disabled={!canWrite} title={!canWrite ? 'Requires cloud connection' : undefined} className={`bg-gradient-to-br from-yellow-500 to-amber-500 text-white font-bold py-4 px-8 rounded-xl shadow-lg text-base flex items-center gap-3 group transition-all ${!canWrite ? 'opacity-60 cursor-not-allowed' : 'hover:from-yellow-600 hover:to-amber-600 hover:scale-105'}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 group-hover:rotate-12 transition-transform" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M10.5 1.5H5.75A2.75 2.75 0 003 4.25v11.5A2.75 2.75 0 005.75 18.5h8.5A2.75 2.75 0 0017 15.75V8M10.5 1.5v4.5M10.5 1.5L17 8M6 10h5M6 13h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                </svg>
                                Children's Ministry Collection
                                </button>
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
                            {currentUser?.role === 'data-entry' ? (
                                <div className="lg:col-span-2 flex items-end">
                                    <div className="w-full bg-blue-100 border-2 border-blue-400 rounded-lg px-4 py-3 flex items-center gap-3">
                                        <span className="text-2xl">📅</span>
                                        <div>
                                            <div className="text-xs font-bold uppercase text-blue-600">Viewing Today Only</div>
                                            <div className="text-base font-bold text-blue-900">{getTodayEST()}</div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
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
                            )}
                            <div className="lg:col-span-1">
                                <label className="block text-sm font-bold uppercase text-blue-700 mb-1 flex items-center gap-2">🧬 Day Born <span className="text-[11px] font-semibold text-blue-500">(active when Type is Day Born)</span></label>
                                <select
                                    value={dayBornFilter}
                                    onChange={e => setDayBornFilter(e.target.value as any)}
                                    disabled={typeFilter !== 'day-born'}
                                    className={`block w-full border-2 rounded-lg shadow-sm py-3 font-medium focus:ring-blue-400 focus:border-blue-400 ${typeFilter !== 'day-born' ? 'border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed' : 'border-blue-300'}`}
                                >
                                    <option value="all">All</option>
                                    <option value="sunday">Sunday</option>
                                    <option value="monday">Monday</option>
                                    <option value="tuesday">Tuesday</option>
                                    <option value="wednesday">Wednesday</option>
                                    <option value="thursday">Thursday</option>
                                    <option value="friday">Friday</option>
                                    <option value="saturday">Saturday</option>
                                </select>
                            </div>
                        </div>

                        {canViewFilteredTotals && (
                            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-5 rounded-xl shadow-lg border-2 border-emerald-200 space-y-4">
                                <button
                                    onClick={() => setIsBalancePanelCollapsed(prev => !prev)}
                                    className="w-full flex items-center justify-between rounded-lg bg-white/70 border border-emerald-200 px-4 py-3 text-left hover:bg-white transition"
                                >
                                    <div>
                                        <div className="text-sm font-bold uppercase text-emerald-700">🧮 Daily Balancing Breakdown</div>
                                        <div className="text-xs text-emerald-700/80 mt-1">Cash, E-Transfer, Cheque totals for a selected date</div>
                                    </div>
                                    <span className="text-emerald-700 font-bold text-lg">{isBalancePanelCollapsed ? '▼' : '▲'}</span>
                                </button>

                                {!isBalancePanelCollapsed && (
                                    <>
                                        <div className="flex flex-wrap items-end gap-4">
                                            <div>
                                                <label className="block text-sm font-bold uppercase text-emerald-700 mb-1">Balancing Date</label>
                                                <input
                                                    type="date"
                                                    value={currentUser?.role === 'data-entry' ? getTodayEST() : balanceDateFilter}
                                                    onChange={e => setBalanceDateFilter(e.target.value)}
                                                    disabled={currentUser?.role === 'data-entry'}
                                                    className={`block border-2 rounded-lg shadow-sm py-2.5 px-3 font-medium ${currentUser?.role === 'data-entry' ? 'border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed' : 'border-emerald-300 focus:ring-emerald-400 focus:border-emerald-400'}`}
                                                />
                                            </div>
                                            <div className="text-sm text-emerald-700 font-semibold">
                                                {dailyMethodBreakdown.selectedDate
                                                    ? `Showing breakdown for ${dailyMethodBreakdown.selectedDate}`
                                                    : 'Select a balancing date (or set Start Date = End Date)'}
                                            </div>
                                        </div>

                                        {dailyMethodBreakdown.selectedDate && (
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                                <div className="bg-white rounded-lg border border-emerald-200 p-3">
                                                    <div className="text-xs font-bold uppercase text-slate-500">Total Entries</div>
                                                    <div className="text-xl font-extrabold text-emerald-700">{dailyMethodBreakdown.totalCount}</div>
                                                    <div className="text-xs text-slate-600">{formatCurrency(dailyMethodBreakdown.total, settings.currency)}</div>
                                                </div>
                                                <div className="bg-white rounded-lg border border-emerald-200 p-3">
                                                    <div className="text-xs font-bold uppercase text-slate-500">Cash</div>
                                                    <div className="text-xl font-extrabold text-emerald-700">{dailyMethodBreakdown.cash.count}</div>
                                                    <div className="text-xs text-slate-600">{formatCurrency(dailyMethodBreakdown.cash.amount, settings.currency)}</div>
                                                </div>
                                                <div className="bg-white rounded-lg border border-emerald-200 p-3">
                                                    <div className="text-xs font-bold uppercase text-slate-500">E-Transfer</div>
                                                    <div className="text-xl font-extrabold text-emerald-700">{dailyMethodBreakdown['e-transfer'].count}</div>
                                                    <div className="text-xs text-slate-600">{formatCurrency(dailyMethodBreakdown['e-transfer'].amount, settings.currency)}</div>
                                                </div>
                                                <div className="bg-white rounded-lg border border-emerald-200 p-3">
                                                    <div className="text-xs font-bold uppercase text-slate-500">Cheque</div>
                                                    <div className="text-xl font-extrabold text-emerald-700">{dailyMethodBreakdown.check.count}</div>
                                                    <div className="text-xs text-slate-600">{formatCurrency(dailyMethodBreakdown.check.amount, settings.currency)}</div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {/* Mini Dashboard */}
                        {canViewFilteredTotals && financialSummary.total > 0 && (
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
                            {(currentUser.role === 'admin' || currentUser.role === 'finance-chair' || currentUser.role === 'finance-team') && (
                                <div className="bg-gradient-to-r from-red-100 to-pink-100 px-4 py-2 border-b-2 border-red-300 flex justify-end">
                                    <label className="flex items-center gap-2 text-xs font-bold uppercase text-red-700 cursor-pointer">
                                        <input type="checkbox" checked={showDeleted} onChange={e => setShowDeleted(e.target.checked)} className="rounded border-red-300 text-red-600 focus:ring-red-500"/>
                                        🗑️ Show Deleted Records
                                    </label>
                                </div>
                            )}
                           <div className="max-h-[75vh] overflow-y-auto p-6 space-y-4">
                               {sortedDates.length === 0 ? (
                                   <div className="text-center py-16 text-slate-400">
                                       <div className="text-6xl mb-4">📭</div>
                                       <p className="text-xl font-bold">No records found</p>
                                       <p className="text-sm mt-2">{currentUser?.role === 'data-entry' ? 'No entries have been recorded for today.' : 'Try adjusting your filters'}</p>
                                   </div>
                               ) : currentUser?.role === 'data-entry' ? (
                                   /* Data-entry: flat list showing only today's entries — no year/month folder tree */
                                   <div className="space-y-3">
                                       {sortedDates.map(date => {
                                           const dateEntries = entriesByDate[date];
                                           const activeEntries = dateEntries.filter(e => !isDeletedFlag(e.deleted));
                                           const activeTotal = activeEntries.reduce((sum, e) => sum + toNumericAmount(e.amount), 0);
                                           return (
                                               <div key={date} className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border-2 border-blue-200 shadow-md hover:shadow-lg transition-all overflow-hidden">
                                                   <button
                                                       onClick={() => {
                                                           setSelectedDateForModal(date);
                                                           setModalClassFilter('all');
                                                           setModalTypeFilter('all');
                                                       }}
                                                       className="w-full p-4 flex items-center justify-between hover:bg-blue-100 transition-colors text-left"
                                                   >
                                                       <div className="flex items-center gap-3">
                                                           <div className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white rounded-lg p-3 shadow-md">
                                                               <div className="text-xs font-bold uppercase">{new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}</div>
                                                               <div className="text-xl font-bold">{new Date(date + 'T00:00:00').getDate()}</div>
                                                           </div>
                                                           <div>
                                                               <h3 className="text-lg font-bold text-slate-800">{new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', day: 'numeric' })}</h3>
                                                               <p className="text-xs text-slate-600 mt-0.5 font-medium">{activeEntries.length} contribution{activeEntries.length !== 1 ? 's' : ''}</p>
                                                           </div>
                                                       </div>
                                                       <div className="text-right">
                                                           <div className="text-xl font-bold text-green-600">{formatCurrency(activeTotal, settings.currency)}</div>
                                                           <div className="text-xs text-blue-600 font-semibold mt-1 flex items-center gap-1">
                                                               Click to view
                                                               <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                                                   <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                                               </svg>
                                                           </div>
                                                       </div>
                                                   </button>
                                               </div>
                                           );
                                       })}
                                   </div>
                               ) : (
                                   Object.keys(entriesByYearMonth).sort((a, b) => parseInt(b) - parseInt(a)).map(year => (
                                       <div key={year} className="mb-4">
                                           {/* Year Folder */}
                                           <button
                                               onClick={() => toggleFinRecordsYear(year)}
                                               className="w-full flex items-center gap-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl px-6 py-3 shadow-lg hover:shadow-xl transition-all mb-3"
                                           >
                                               <span className="text-2xl">{finRecordsExpandedYears.has(year) ? '📂' : '📁'}</span>
                                               <span className="text-xl font-bold">{year}</span>
                                               <span className="ml-auto text-base font-semibold bg-white/20 px-3 py-1 rounded-full">
                                                   {Object.values(entriesByYearMonth[year]).flat().length} dates
                                               </span>
                                               <span className="text-xl">{finRecordsExpandedYears.has(year) ? '▼' : '▶'}</span>
                                           </button>

                                           {/* Months within Year */}
                                           {finRecordsExpandedYears.has(year) && Object.keys(entriesByYearMonth[year]).map(month => {
                                               const monthKey = `${year}-${month}`;
                                               const dates = entriesByYearMonth[year][month];
                                               
                                               return (
                                                   <div key={monthKey} className="ml-8 mb-3">
                                                       {/* Month Folder */}
                                                       <button
                                                           onClick={() => toggleFinRecordsMonth(monthKey)}
                                                           className="w-full flex items-center gap-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl px-5 py-2.5 shadow-md hover:shadow-lg transition-all mb-2"
                                                       >
                                                           <span className="text-xl">{finRecordsExpandedMonths.has(monthKey) ? '📂' : '📁'}</span>
                                                           <span className="text-lg font-bold">{month}</span>
                                                           <span className="ml-auto text-sm font-semibold bg-white/20 px-2.5 py-0.5 rounded-full">
                                                               {dates.length} dates
                                                           </span>
                                                           <span className="text-lg">{finRecordsExpandedMonths.has(monthKey) ? '▼' : '▶'}</span>
                                                       </button>

                                                       {/* Dates in Month */}
                                                       {finRecordsExpandedMonths.has(monthKey) && (
                                                           <div className="ml-8 space-y-3">
                                                               {dates.map(date => {
                                                                   const dateEntries = entriesByDate[date];
                                                                   const activeEntries = dateEntries.filter(e => !isDeletedFlag(e.deleted));
                                                                   const deletedEntries = dateEntries.filter(e => isDeletedFlag(e.deleted));
                                                                   const activeTotal = activeEntries.reduce((sum, e) => sum + toNumericAmount(e.amount), 0);
                                                                   const deletedTotal = deletedEntries.reduce((sum, e) => sum + toNumericAmount(e.amount), 0);
                                                                   
                                                                   return (
                                                                       <div key={date} className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border-2 border-blue-200 shadow-md hover:shadow-lg transition-all overflow-hidden">
                                                                           <button 
                                                                               onClick={() => {
                                                                                   setSelectedDateForModal(date);
                                                                                   setModalClassFilter('all');
                                                                                   setModalTypeFilter('all');
                                                                               }}
                                                                               className="w-full p-4 flex items-center justify-between hover:bg-blue-100 transition-colors text-left"
                                                                           >
                                                                               <div className="flex items-center gap-3">
                                                                                   <div className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white rounded-lg p-3 shadow-md">
                                                                                       <div className="text-xs font-bold uppercase">{new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}</div>
                                                                                       <div className="text-xl font-bold">{new Date(date + 'T00:00:00').getDate()}</div>
                                                                                   </div>
                                                                                   <div>
                                                                                       <div className="flex items-center gap-2">
                                                                                           <h3 className="text-lg font-bold text-slate-800">{new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', day: 'numeric' })}</h3>
                                                                                           {deletedEntries.length > 0 && showDeleted && <span className="text-xs bg-red-200 text-red-800 px-2 py-0.5 rounded-full font-bold">{deletedEntries.length} Deleted</span>}
                                                                                       </div>
                                                                                       <p className="text-xs text-slate-600 mt-0.5 font-medium">
                                                                                           {activeEntries.length} active{deletedEntries.length > 0 && showDeleted ? ` + ${deletedEntries.length} deleted` : ''}
                                                                                       </p>
                                                                                   </div>
                                                                               </div>
                                                                               <div className="text-right">
                                                                                   <div className="text-xl font-bold text-green-600">{formatCurrency(activeTotal, settings.currency)}</div>
                                                                                   {deletedEntries.length > 0 && showDeleted && (
                                                                                       <div className="text-xs text-red-600 font-semibold line-through">{formatCurrency(deletedTotal, settings.currency)} deleted</div>
                                                                                   )}
                                                                                   <div className="text-xs text-blue-600 font-semibold mt-1 flex items-center gap-1">
                                                                                       Click to view
                                                                                       <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                                                                           <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                                                                       </svg>
                                                                                   </div>
                                                                               </div>
                                                                           </button>
                                                                       </div>
                                                                   );
                                                               })}
                                                           </div>
                                                       )}
                                                   </div>
                                               );
                                           })}
                                       </div>
                                   ))
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
                                                <p className="text-blue-100 mt-1">{entriesByDate[selectedDateForModal].filter(e => !isDeletedFlag(e.deleted)).length} active contribution{entriesByDate[selectedDateForModal].filter(e => !isDeletedFlag(e.deleted)).length !== 1 ? 's' : ''} • Active Total: {formatCurrency(entriesByDate[selectedDateForModal].filter(e => !isDeletedFlag(e.deleted)).reduce((sum, e) => sum + toNumericAmount(e.amount), 0), settings.currency)}</p>
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
                                            {showDeleted && (
                                                <div className="flex items-center gap-3">
                                                    <label className="text-sm font-bold text-blue-100">Show:</label>
                                                    <select 
                                                        value={modalDeletedFilter} 
                                                        onChange={e => setModalDeletedFilter(e.target.value as 'all' | 'active' | 'deleted')}
                                                        className="border-2 border-blue-400 bg-white/95 text-slate-800 rounded-lg px-4 py-2 font-semibold focus:ring-2 focus:ring-white focus:border-white transition-all"
                                                    >
                                                        <option value="all">All Entries</option>
                                                        <option value="active">Active Only</option>
                                                        <option value="deleted">Deleted Only</option>
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Modal Body - Scrollable */}
                                    <div className="flex-1 overflow-y-auto p-6">
                                        {(() => {
                                            const modalEntries = entriesByDate[selectedDateForModal]
                                                .filter(entry => {
                                                    // Filter by class
                                                    if (modalClassFilter !== 'all') {
                                                        const member = membersMap.get(entry.memberID);
                                                        const entryClass = entry.classNumber || member?.classNumber;
                                                        if (entryClass !== modalClassFilter) return false;
                                                    }
                                                    // Filter by type
                                                    if (modalTypeFilter !== 'all' && entry.type !== modalTypeFilter) return false;
                                                    // Filter by deleted status
                                                    if (modalDeletedFilter === 'active' && isDeletedFlag(entry.deleted)) return false;
                                                    if (modalDeletedFilter === 'deleted' && !isDeletedFlag(entry.deleted)) return false;
                                                    return true;
                                                });
                                            const filteredTotal = modalEntries.filter(e => !isDeletedFlag(e.deleted)).reduce((sum, e) => sum + toNumericAmount(e.amount), 0);
                                            const filteredCount = modalEntries.length;
                                            
                                            const activeEntries = modalEntries.filter(e => !isDeletedFlag(e.deleted));
                                            const deletedEntries = modalEntries.filter(e => isDeletedFlag(e.deleted));
                                            
                                            return (
                                                <>
                                                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                                        {canViewFilteredTotals && (
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-xs font-bold uppercase text-slate-500">Filtered Total</span>
                                                                <span className="text-2xl font-extrabold text-green-600">{formatCurrency(filteredTotal, settings.currency)}</span>
                                                            </div>
                                                        )}
                                                        <span className="text-sm font-semibold text-slate-600">{filteredCount} entr{filteredCount === 1 ? 'y' : 'ies'}</span>
                                                    </div>
                                                    {/* Active Entries Section */}
                                                    {activeEntries.length > 0 && (
                                                        <div className="space-y-3 mb-6">
                                                            {activeEntries.map((entry, idx) => {
                                                                const member = membersMap.get(entry.memberID);
                                                                const displayClass = entry.classNumber || member?.classNumber || '-';
                                                                const isLocked = isMonthLocked(entry.date, monthLocks);
                                                                const canEdit = currentUser.role !== 'pastor' && (!isLocked || currentUser.role === 'admin' || currentUser.role === 'finance-chair' || currentUser.role === 'finance-team') && canWrite;
                                                                
                                                                return (
                                                                    <div key={entry.id} className="rounded-xl border-2 p-5 transition-all bg-gradient-to-r from-slate-50 to-blue-50 border-slate-200 hover:shadow-md">
                                                                        <div className="flex justify-between items-start">
                                                                            <div className="flex-1">
                                                                                <div className="flex items-center gap-3 mb-2">
                                                                                    <h3 className="text-lg font-bold text-slate-800">{entry.memberName}</h3>
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
                                                                                        <span className="ml-1 font-semibold text-slate-700 capitalize">{formatMethod(entry.method)}</span>
                                                                                    </div>
                                                                                </div>
                                                                                {entry.note && (
                                                                                    <div className="mt-2 text-sm text-slate-600 italic">
                                                                                        <span className="font-medium">Note:</span> {entry.note}
                                                                                    </div>
                                                                                )}
                                                                                <div className="mt-3 text-xs text-slate-700 bg-slate-100 p-2 rounded border border-slate-200">
                                                                                    <span className="font-semibold">Last edited by:</span> {entry.updatedBy || entry.createdBy || 'Unknown'}
                                                                                    <span className="mx-2 text-slate-400">•</span>
                                                                                    <span className="font-semibold">Updated:</span> {entry.lastUpdated ? new Date(entry.lastUpdated).toLocaleString() : '—'}
                                                                                </div>
                                                                            </div>
                                                                            <div className="text-right ml-4">
                                                                                <div className="text-2xl font-bold text-green-600">{formatCurrency(toNumericAmount(entry.amount), settings.currency)}</div>
                                                                                {(() => {
                                                                                    if (!canEdit) return null;
                                                                                    // Data-entry cannot edit at all
                                                                                    if (currentUser?.role === 'data-entry') return null;
                                                                                    // Check window status for edits
                                                                                    const windowStatus = isEntryWindowOpen(settings.entryWindow);
                                                                                    const canOverride = currentUser?.role === 'admin' || currentUser?.role === 'finance-chair' || currentUser?.role === 'finance-team';
                                                                                    const disabled = !canWrite || (!windowStatus.isOpen && !canOverride);
                                                                                    const title = !canWrite ? 'Requires cloud connection' : (!windowStatus.isOpen && !canOverride ? `Editing is locked. ${windowStatus.reason}` : undefined);
                                                                                    return (
                                                                                        <button 
                                                                                            onClick={() => { 
                                                                                                setSelectedEntry(entry); 
                                                                                                setIsModalOpen(true); 
                                                                                                setSelectedDateForModal(null);
                                                                                            }} 
                                                                                            disabled={disabled}
                                                                                            title={title}
                                                                                            className={`mt-2 font-bold text-sm ${disabled ? 'text-blue-300 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800 hover:underline'}`}
                                                                                        >
                                                                                            Edit
                                                                                        </button>
                                                                                    );
                                                                                })()}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                    
                                                    {/* Deleted Entries Section */}
                                                    {deletedEntries.length > 0 && showDeleted && (
                                                        <div className="border-t-4 border-red-300 pt-4">
                                                            <div className="bg-gradient-to-r from-red-100 to-pink-100 px-4 py-3 rounded-lg mb-3 flex items-center justify-between">
                                                                <span className="text-red-700 font-bold text-sm uppercase flex items-center gap-2">
                                                                    🗑️ Deleted Entries ({deletedEntries.length})
                                                                </span>
                                                                <span className="text-red-600 text-sm font-semibold">
                                                                    Total: {formatCurrency(deletedEntries.reduce((s,e)=>s+toNumericAmount(e.amount),0), settings.currency)}
                                                                </span>
                                                            </div>
                                                            <div className="space-y-3">
                                                                {deletedEntries.map((entry) => {
                                                                    const member = membersMap.get(entry.memberID);
                                                                    const displayClass = entry.classNumber || member?.classNumber || '-';
                                                                    
                                                                    return (
                                                                        <div key={entry.id} className="rounded-xl border-2 p-5 transition-all bg-red-50 border-red-200 opacity-75">
                                                                            <div className="flex justify-between items-start">
                                                                                <div className="flex-1">
                                                                                    <div className="flex items-center gap-3 mb-2">
                                                                                        <h3 className="text-lg font-bold text-red-500 line-through">{entry.memberName}</h3>
                                                                                        <span className="text-xs bg-red-200 text-red-800 px-2 py-1 rounded-full font-bold">DELETED</span>
                                                                                    </div>
                                                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                                                                        <div>
                                                                                            <span className="text-red-400 font-medium">Member #:</span>
                                                                                            <span className="ml-1 font-bold text-red-500 line-through">{member?.memberNumber || '-'}</span>
                                                                                        </div>
                                                                                        <div>
                                                                                            <span className="text-red-400 font-medium">Class:</span>
                                                                                            <span className="ml-1 font-bold text-red-500 line-through">{displayClass}</span>
                                                                                        </div>
                                                                                        <div>
                                                                                            <span className="text-red-400 font-medium">Type:</span>
                                                                                            <span className="ml-1 px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold capitalize line-through">{entry.type.replace(/-/g, ' ')}</span>
                                                                                        </div>
                                                                                        <div>
                                                                                            <span className="text-red-400 font-medium">Method:</span>
                                                                                            <span className="ml-1 font-semibold text-red-500 capitalize line-through">{formatMethod(entry.method)}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                    {entry.note && (
                                                                                        <div className="mt-2 text-sm text-red-600 italic line-through">
                                                                                            <span className="font-medium">Note:</span> {entry.note}
                                                                                        </div>
                                                                                    )}
                                                                                    <div className="mt-3 text-xs text-red-700 bg-red-100 p-2 rounded">
                                                                                        <div className="font-semibold">Deleted by: {entry.deletedBy || 'Unknown'}</div>
                                                                                        <div className="italic">Reason: "{entry.deletedReason || 'No reason provided'}"</div>
                                                                                    </div>
                                                                                    <div className="mt-2 text-xs text-red-700 bg-red-100 p-2 rounded border border-red-200">
                                                                                        <span className="font-semibold">Last edited by:</span> {entry.updatedBy || entry.createdBy || 'Unknown'}
                                                                                        <span className="mx-2 text-red-300">•</span>
                                                                                        <span className="font-semibold">Updated:</span> {entry.lastUpdated ? new Date(entry.lastUpdated).toLocaleString() : '—'}
                                                                                    </div>
                                                                                </div>
                                                                                <div className="text-right ml-4">
                                                                                    <div className="text-2xl font-bold text-red-500 line-through">{formatCurrency(toNumericAmount(entry.amount), settings.currency)}</div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                    
                                    {/* Modal Footer */}
                                    <div className="p-6 bg-slate-50 rounded-b-2xl border-t-2 border-slate-200 flex justify-between items-center">
                                        <div className="text-sm text-slate-600">
                                            <span className="font-bold">Active total for this date:</span> {formatCurrency(entriesByDate[selectedDateForModal].filter(e => !isDeletedFlag(e.deleted)).reduce((sum, e) => sum + toNumericAmount(e.amount), 0), settings.currency)}
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
            case 'development-fund': return <DevelopmentFund members={members} entries={entries} setEntries={setEntries} settings={settings} syncStatus={syncStatus} currentUser={currentUser} />;
            case 'harvest-pledges':
                return (
                    <HarvestPledges 
                        members={members}
                        pledges={harvestPledges}
                        setPledges={setHarvestPledges}
                        settings={settings}
                        onPayPledge={handlePayPledge}
                        currentUser={currentUser}
                    />
                );
            case 'no-name': return <NoName entries={noNameEntries} setEntries={setNoNameEntries} settings={settings} currentUser={currentUser} syncStatus={syncStatus} />;
            case 'financial-control': return <FinancialControl monthLocks={monthLocks} setMonthLocks={setMonthLocks} sundayLocks={sundayLocks} setSundayLocks={setSundayLocks} currentUser={currentUser} settings={settings} />;
            case 'members': return <Members members={members} setMembers={setMembers} settings={settings} entries={entries} developmentEntries={developmentFund} syncStatus={syncStatus} currentUser={currentUser} />;
            case 'day-born':
                return (
                    <DayBorn
                        members={members}
                        entries={entries}
                        setEntries={setEntries}
                        settings={settings}
                        currentUser={currentUser}
                        monthLocks={monthLocks}
                        syncStatus={syncStatus}
                    />
                );
            case 'insights':
                return (
                    <Insights
                        // Use the full active dataset (not the Records tab filters)
                        entries={entries.filter(e => !isDeletedFlag(e.deleted))}
                        harvestEntries={harvestEntries.filter(h => !h.deleted)}
                        settings={settings}
                    />
                );
            case 'tax-receipts':
                return (
                    <TaxReceipts
                        entries={entries.filter(e => !isDeletedFlag(e.deleted))}
                        harvestEntries={harvestEntries.filter(h => !h.deleted)}
                        members={members}
                        settings={settings}
                    />
                );
            case 'wesley-hall':
                return (
                    <WesleyHall
                        settings={settings}
                        currentUser={currentUser}
                        syncStatus={syncStatus}
                    />
                );
            case 'parking':
                return (
                    <Parking
                        settings={settings}
                        currentUser={currentUser}
                        syncStatus={syncStatus}
                    />
                );
            case 'attendance':
                return currentUser.role === 'class-leader' ? (
                    <ClassAttendance
                        members={members}
                        setMembers={setMembers}
                        settings={settings}
                        currentUser={currentUser}
                        syncStatus={syncStatus}
                    />
                ) : (
                    <Suspense fallback={<div className="p-8 text-slate-500">Loading Attendance Summary...</div>}>
                        <BibleClassAttendanceSummary settings={settings} syncStatus={syncStatus} />
                    </Suspense>
                );
            case 'assets':
                return (
                    <Assets
                        settings={settings}
                        currentUser={currentUser}
                        syncStatus={syncStatus}
                    />
                );
            case 'weekly-history':
                return (
                    <div className="space-y-6">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white rounded-xl shadow">
                            <h3 className="text-lg font-bold">📅 Weekly History</h3>
                        </div>
                        <WeeklyHistory history={weeklyHistory} setHistory={setWeeklyHistory} settings={settings} />
                    </div>
                );
            case 'bible-class-attendance':
                return (
                    <Suspense fallback={<div className="p-8 text-slate-500">Loading Bible Class Attendance...</div>}>
                        <BibleClassAttendanceSummary settings={settings} syncStatus={syncStatus} />
                    </Suspense>
                );
            case 'upcoming-birthdays':
                return (
                    <UpcomingBirthdays members={members} />
                );
            case 'e-transfers':
                return (
                    <ETransfers settings={settings} />
                );
            // 'history' moved under Reports tab
            case 'history': return <Reports entries={entries} harvestEntries={harvestEntries} members={members} settings={settings} history={weeklyHistory} setHistory={setWeeklyHistory} setEntries={setEntries} targetSection={reportsTarget} onConsumeTarget={() => setReportsTarget(null)} />;
            case 'users': return <UsersTab users={users} setUsers={setUsers} members={members} settings={settings} syncStatus={syncStatus} />;
            case 'settings': return <SettingsTab settings={settings} setSettings={setSettings} cloud={cloud} setCloud={setCloud} onExport={() => {}} onImport={() => {}} currentUser={currentUser} classLeaders={classLeaders} setClassLeaders={setClassLeaders} allData={{
                entries,
                members,
                weeklyHistory,
                users,
                developmentFund,
                monthLocks,
                setEntries: (d) => setEntries(d),
                setMembers: (d) => setMembers(d),
                setWeeklyHistory: (d) => setWeeklyHistory(d),
                setUsers: (d) => setUsers(d),
                setDevelopmentFund: (d) => setDevelopmentFund(d),
                setMonthLocks: (d) => setMonthLocks(d)
            }} />;
            case 'utilities': return <Utilities entries={entries} members={members} history={weeklyHistory} developmentFund={developmentFund} settings={settings} currentUser={currentUser} setEntries={setEntries} setMembers={setMembers} setSettings={setSettings} setDevelopmentFund={setDevelopmentFund} />;
            default: return <div>Select a tab</div>;
        }
    };

    const toggleSection = (sectionId: string) => {
        setCollapsedSections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(sectionId)) {
                newSet.delete(sectionId);
            } else {
                newSet.add(sectionId);
            }
            return newSet;
        });
    };

    const handleNavClick = (item: any) => {
        const targetTab = (item.tab || item.id) as Tab;
        setActiveTab(targetTab);

        if (item.targetSection) {
            if (targetTab === 'history') {
                if (item.targetSection === 'financial-report-section') setReportsTarget('financial');
                else if (item.targetSection === 'weekly-history-section') setReportsTarget('weekly');
                else if (item.targetSection === 'upcoming-birthdays-section') setReportsTarget('birthdays');
                // Defer scrolling to Reports component after section switches
            } else {
                setTimeout(() => {
                    const el = document.getElementById(item.targetSection);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, 150);
            }
        }
    };

    const refreshRequisitions = async () => {
        if (!settings.supabaseUrl || !settings.supabaseKey) return;
        try {
            const updatedRequisitions = await loadRequisitions(settings.supabaseUrl, settings.supabaseKey);
            setRequisitions(updatedRequisitions);
        } catch (err) {
            console.warn('Failed to refresh requisitions:', err);
        }
    };

    const navSections = [
        {
            id: 'financial',
            label: 'Financial Management',
            icon: '💰',
            roles: ['admin', 'finance-chair', 'finance-team', 'data-entry', 'pastor'],
            items: [
                { id: 'home', label: 'Home', roles: ['admin', 'finance-chair', 'finance-team', 'pastor'] },
                { id: 'records', label: 'Financial Records', roles: ['admin', 'finance-chair', 'finance-team', 'data-entry'] },
                { id: 'day-born', label: 'Day Born', roles: ['admin', 'finance-chair', 'finance-team', 'data-entry', 'pastor'] },
                { id: 'development-fund', label: 'Development Fund', roles: ['admin', 'finance-chair', 'finance-team', 'data-entry', 'pastor'] },
                { id: 'harvest', label: 'Harvest', roles: ['admin', 'finance-chair', 'finance-team', 'data-entry', 'pastor'] },
                { id: 'no-name', label: 'No Name', roles: ['admin', 'finance-chair', 'finance-team'] },
                { id: 'financial-control', label: 'Financial Control', roles: ['admin', 'finance-chair', 'finance-team'] },
                { id: 'wesley-hall', label: 'Wesley Hall', roles: ['admin', 'finance-chair', 'finance-team', 'pastor'] },
                { id: 'parking', label: 'Parking', roles: ['admin', 'finance-chair', 'finance-team', 'pastor'] },
                { id: 'tax-receipts', label: 'Tax Receipts', roles: ['admin', 'finance-chair'] },
                { id: 'organization-funds', label: 'Organization Funds', roles: ['admin', 'finance-chair', 'finance-team', 'pastor'] },
                { id: 'insights', label: 'Insights & Reports', roles: ['admin', 'finance-chair', 'finance-team', 'pastor'] },
                { id: 'requisitions', label: 'Requisitions', roles: ['admin', 'finance-chair', 'finance-team', 'pastor'] },
                { id: 'my-approvals', label: 'My Approvals', roles: ['admin', 'finance-chair', 'finance-team', 'pastor'] },
                { id: 'settings', label: 'Settings', roles: ['admin'] },
            ]
        },
        {
            id: 'members',
            label: 'Members & Attendance',
            icon: '👥',
            roles: ['admin', 'finance-chair', 'finance-team', 'pastor', 'class-leader'],
            items: [
                { id: 'members', label: 'Member Directory', roles: ['admin', 'finance-chair', 'finance-team', 'pastor'] },
                { id: 'attendance', label: 'Class Attendance', roles: ['admin', 'pastor', 'class-leader'] },
            ]
        },
        {
            id: 'reports',
            label: 'Reports',
            icon: '📊',
            roles: ['admin', 'finance-chair', 'finance-team', 'pastor', 'statistician'],
            items: [
                { id: 'reports', label: 'Financial Report', roles: ['admin', 'finance-chair', 'finance-team', 'pastor'], tab: 'history', targetSection: 'financial-report-section' },
                { id: 'reports-weekly', label: 'Weekly History', roles: ['admin', 'finance-chair', 'finance-team', 'pastor', 'statistician'], tab: 'weekly-history' },
                { id: 'reports-bible-class', label: 'Bible Class Attendance', roles: ['admin', 'finance-chair', 'finance-team', 'pastor', 'statistician'], tab: 'bible-class-attendance' },
                { id: 'reports-birthdays', label: 'Upcoming Birthdays', roles: ['admin', 'finance-chair', 'finance-team', 'pastor'], tab: 'upcoming-birthdays' },
                { id: 'reports-etransfers', label: 'E-Transfers', roles: ['admin', 'finance-chair', 'finance-team', 'pastor'], tab: 'e-transfers' },
            ]
        },
        {
            id: 'assets',
            label: 'Assets Management',
            icon: '🏛️',
            roles: ['admin', 'finance-chair', 'pastor'],
            items: [
                { id: 'assets', label: 'Asset Registry', roles: ['admin', 'finance-chair', 'pastor'] },
            ]
        },
        {
            id: 'admin',
            label: 'Administration',
            icon: '⚙️',
            roles: ['admin', 'finance-chair'],
            items: [
                { id: 'users', label: 'Manage Users', roles: ['admin'] },
                { id: 'settings', label: 'Settings', roles: ['admin', 'finance-chair'] },
                { id: 'utilities', label: 'Utilities', roles: ['admin'] },
            ]
        },
    ];

    const isFeatureEnabled = (itemId: string): boolean => {
        const features = selectedSociety.features || {};
        if (itemId === 'wesley-hall') return features.wesleyHall !== false;
        if (itemId === 'parking') return features.parking !== false;
        if (itemId === 'reports-etransfers' || itemId === 'e-transfers') return features.etransfers !== false;
        if (itemId === 'requisitions' || itemId === 'my-approvals') return features.requisitions !== false;
        if (itemId === 'harvest' || itemId === 'harvest-pledges') return features.harvest !== false;
        if (itemId === 'development-fund') return features.developmentFund !== false;
        if (itemId === 'tax-receipts') return features.taxReceipts !== false;
        if (itemId === 'assets') return features.assets !== false;
        if (itemId === 'organization-funds') return features.organizationFunds !== false;
        if (itemId === 'day-born') return features.dayBorn !== false;
        return true;
    };

    const visibleSections = navSections
        .map(section => ({
            ...section,
            items: section.items.filter(item => item.roles.includes(currentUser.role) && isFeatureEnabled(item.id))
        }))
        .filter(section => 
            section.items.length > 0 && section.roles.some(role => currentUser.role === role)
        );

    return (
        <div className="bg-slate-50 min-h-screen font-sans text-slate-900">
            <div className="w-full px-4 sm:px-6 lg:px-8">
                <Header entries={entries} onImport={handleImport} onExport={handleExport} currentUser={currentUser} onLogout={handleLogout} syncStatus={syncStatus} settings={settings} onPasswordChange={() => setIsPasswordModalOpen(true)} selectedSociety={selectedSociety} onSwitchSociety={() => { setCurrentUser(null); setIsSelectingSociety(true); }}/>
                {syncStatus.state !== 'synced' && (
                    <div className="no-print mt-2 mb-4 rounded-xl border-2 px-4 py-3 text-sm font-bold shadow-sm flex items-center gap-2"
                        style={{
                            borderColor: syncStatus.state === 'error' ? '#fecaca' : '#bfdbfe',
                            background: syncStatus.state === 'error' ? 'linear-gradient(to right, #fee2e2, #fecaca)' : 'linear-gradient(to right, #dbeafe, #e0e7ff)',
                            color: syncStatus.state === 'error' ? '#7f1d1d' : '#1e3a8a'
                        }}
                        title={syncStatus.errorMessage || undefined}
                    >
                        {syncStatus.state === 'syncing' && 'Sync in progress — writes are temporarily disabled.'}
                        {syncStatus.state === 'error' && 'Read-only — cloud connection required to make changes.'}
                        {syncStatus.state !== 'syncing' && syncStatus.state !== 'error' && 'Read-only — waiting for cloud connection.'}
                    </div>
                )}
                <main className={`grid grid-cols-1 ${isSidebarCollapsed ? 'lg:grid-cols-1' : 'lg:grid-cols-5'} gap-8`}>
                    <aside className={`no-print ${isSidebarCollapsed ? 'hidden lg:hidden' : 'lg:col-span-1'}`}>
                        <nav className="relative overflow-y-auto max-h-[80vh] rounded-2xl shadow-xl border border-slate-800/60 p-5 sticky top-6 bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-900 no-print">
                            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.15),transparent_40%),radial-gradient(ellipse_at_bottom_right,rgba(236,72,153,0.12),transparent_35%)]"></div>
                            <div className="relative space-y-4">
                                <div className="mb-4 flex items-center justify-between pb-3 border-b border-white/10">
                                    <span className="text-slate-300/80 font-bold tracking-wider uppercase text-sm">Navigation</span>
                                    <span className="px-3 py-1.5 rounded-full text-xs font-semibold text-indigo-100 bg-indigo-500/20 border border-indigo-400/30">
                                        {currentUser.role.replace(/-/g, ' ')}
                                    </span>
                                </div>
                                {visibleSections.map(section => {
                                    const isCollapsed = collapsedSections.has(section.id);
                                    
                                    return (
                                        <div key={section.id} className="space-y-2">
                                            {/* Section Header */}
                                            <button
                                                onClick={() => toggleSection(section.id)}
                                                className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xl">{section.icon}</span>
                                                    <span className="font-bold text-slate-200 text-sm uppercase tracking-wide">
                                                        {section.label}
                                                    </span>
                                                </div>
                                                <svg 
                                                    xmlns="http://www.w3.org/2000/svg" 
                                                    className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}
                                                    viewBox="0 0 20 20" 
                                                    fill="currentColor"
                                                >
                                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                                </svg>
                                            </button>

                                            {/* Section Items */}
                                            {!isCollapsed && (
                                                <div className="space-y-1 pl-2">
                                                    {section.items.map(item => {
                                                        const targetTab = (item.tab || item.id) as Tab;
                                                        const isReportsSubItem = targetTab === 'history' && !!(item as any).targetSection;
                                                        const currentReportsSectionId = reportsTarget === 'weekly'
                                                            ? 'weekly-history-section'
                                                            : reportsTarget === 'birthdays'
                                                                ? 'upcoming-birthdays-section'
                                                                : 'financial-report-section';
                                                        const isActive = isReportsSubItem
                                                            ? ((item as any).targetSection === currentReportsSectionId)
                                                            : (activeTab === targetTab);
                                                        
                                                        return (
                                                            <button
                                                                key={item.id}
                                                                onClick={() => handleNavClick(item)}
                                                                className={`group w-full text-left font-semibold px-5 py-3 rounded-lg transition-all duration-200 text-sm flex items-center justify-between border ${
                                                                    isActive
                                                                        ? 'bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white shadow-lg ring-1 ring-indigo-400/40 border-white/10'
                                                                        : 'text-slate-300/90 bg-white/0 hover:bg-white/[0.06] hover:text-indigo-200/90 border-transparent hover:border-white/10'
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <span className={`${isActive ? 'h-1.5 w-1.5 bg-white/90' : 'h-1.5 w-1.5 bg-slate-400/40 group-hover:bg-indigo-300/70'} rounded-full`}></span>
                                                                    <span>{item.label}</span>
                                                                </div>
                                                                {isActive && <span className="text-white/90">›</span>}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </nav>
                    </aside>
                    <section className={isSidebarCollapsed ? 'lg:col-span-1' : 'lg:col-span-4'}>
                        <div className="no-print sticky top-4 z-30 mb-4 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setIsSidebarCollapsed(prev => !prev)}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white/95 backdrop-blur text-slate-700 font-semibold shadow-sm hover:bg-slate-50 transition-colors"
                            >
                                <span>{isSidebarCollapsed ? '☰' : '⇤'}</span>
                                <span>{isSidebarCollapsed ? 'Show Navigation' : 'Collapse Navigation'}</span>
                            </button>
                        </div>
                        <Suspense fallback={<div className="p-10 text-center text-slate-500">Loading page...</div>}>
                                <div className="px-6 pt-4">
                                    <EntryWindowBanner settings={settings} currentUser={currentUser} />
                                </div>
                            {renderTabContent()}
                        </Suspense>
                    </section>
                </main>
                {isModalOpen && <EntryModal entry={selectedEntry} existingEntries={entries} members={members} settings={settings} currentUser={currentUser} monthLocks={monthLocks} onSave={handleSaveEntry} onSaveAndNew={handleSaveAndNew} onClose={() => setIsModalOpen(false)} onDelete={handleDeleteEntry} />}
                <ConfirmationModal isOpen={isConfirmModalOpen} onClose={() => { setIsConfirmModalOpen(false); setEntryToDeleteId(null); }} onConfirm={confirmDeleteEntry} title="Confirm Deletion" message="Are you sure you want to delete this financial entry? It will be marked as deleted in the system." confirmButtonText="Delete Entry" />
                {showChildrenMinistryModal && (
                    <BulkChildrenMinistryModal
                        settings={settings}
                        existingEntries={entries}
                        onSave={handleSaveEntry}
                        onClose={() => setShowChildrenMinistryModal(false)}
                    />
                )}
                {isPasswordModalOpen && currentUser && (
                    <PasswordChangeModal 
                        currentUser={currentUser}
                        users={users}
                        setUsers={setUsers}
                        settings={settings}
                        onClose={() => setIsPasswordModalOpen(false)}
                    />
                )}
                {showProfileModal && currentUser && (
                    <ProfileModal
                        currentUser={currentUser}
                        note={userNotes[currentUser.username.toLowerCase()] || ''}
                        onSaveNote={(val) => setUserNotes(prev => ({ ...prev, [currentUser.username.toLowerCase()]: val }))}
                        onChangePassword={() => { setShowProfileModal(false); setIsPasswordModalOpen(true); }}
                        onClose={() => setShowProfileModal(false)}
                    />
                )}
                <KeyboardShortcuts onNavigate={handleNavigate} />
            </div>
        </div>
    );
};

export default App;

// Wrap with ToastProvider for components that use toast notifications
export const AppWithToasts: React.FC = () => (
    <ToastProvider>
        <App />
    </ToastProvider>
);
