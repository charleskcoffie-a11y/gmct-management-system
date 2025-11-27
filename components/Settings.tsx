
// components/Settings.tsx
import React, { useState } from 'react';
import type { Settings, CloudState, Entry, Member, AttendanceRecord, WeeklyHistoryRecord, User, DevelopmentFundEntry, MonthLock } from '../types';
import { testSupabaseConnection, uploadDataToSupabase, downloadDataFromSupabase } from '../services/supabase';

interface SettingsProps {
    settings: Settings;
    setSettings: React.Dispatch<React.SetStateAction<Settings>>;
    cloud: CloudState;
    setCloud: React.Dispatch<React.SetStateAction<CloudState>>;
    onExport: (format: 'json_all') => void;
    onImport: (file: File) => void;
    currentUser: User;
    // Data props needed for sync and locking
    allData?: {
        entries: Entry[];
        members: Member[];
        attendance: AttendanceRecord[];
        weeklyHistory: WeeklyHistoryRecord[];
        users: User[];
        developmentFund: DevelopmentFundEntry[];
        monthLocks: MonthLock[];
        setEntries: (d: Entry[]) => void;
        setMembers: (d: Member[]) => void;
        setAttendance: (d: AttendanceRecord[]) => void;
        setWeeklyHistory: (d: WeeklyHistoryRecord[]) => void;
        setUsers: (d: User[]) => void;
        setDevelopmentFund: (d: DevelopmentFundEntry[]) => void;
        setMonthLocks: (d: MonthLock[]) => void;
    };
}

const SettingsTab: React.FC<SettingsProps> = ({ settings, setSettings, cloud, setCloud, onExport, onImport, allData, currentUser }) => {
    const [localSettings, setLocalSettings] = useState<Settings>(settings);
    const [testResult, setTestResult] = useState<{success: boolean, message: string} | null>(null);
    const [isTesting, setIsTesting] = useState(false);
    const [syncStatus, setSyncStatus] = useState<{type: 'success'|'error'|'info', message: string} | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);

    // Month Lock State
    const [manageLockYear, setManageLockYear] = useState(new Date().getFullYear());

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type, checked } = e.target as HTMLInputElement;
        setLocalSettings(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : type === 'number' ? parseInt(value, 10) : value
        }));
    };

    const handleSave = () => {
        setSettings(localSettings);
        alert('Settings saved successfully!');
    };

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            onImport(file);
        }
        event.target.value = ""; // Reset file input
    };

    const handleTestSupabase = async () => {
        setTestResult(null);
        setIsTesting(true);
        try {
            const result = await testSupabaseConnection(localSettings.supabaseUrl, localSettings.supabaseKey);
            setTestResult(result);
            if (result.success) setSettings(localSettings);
        } catch (e) {
            setTestResult({ success: false, message: "Test failed unexpectedly." });
        } finally {
            setIsTesting(false);
        }
    }

    const handlePushToCloud = async () => {
        if (!allData || !localSettings.supabaseUrl || !localSettings.supabaseKey) {
            setSyncStatus({ type: 'error', message: "Missing configuration or data." });
            return;
        }
        if (!window.confirm("This will OVERWRITE data in the cloud database with your local data. Continue?")) return;

        setIsSyncing(true);
        setSyncStatus({ type: 'info', message: "Uploading data..." });
        try {
            await uploadDataToSupabase(localSettings.supabaseUrl, localSettings.supabaseKey, {
                entries: allData.entries,
                members: allData.members,
                attendance: allData.attendance,
                history: allData.weeklyHistory,
                users: allData.users,
                developmentFund: allData.developmentFund,
                monthLocks: allData.monthLocks
            });
            setSyncStatus({ type: 'success', message: "Upload successful!" });
        } catch (e: any) {
            setSyncStatus({ type: 'error', message: e.message });
        } finally {
            setIsSyncing(false);
        }
    };

    const handlePullFromCloud = async () => {
         if (!allData || !localSettings.supabaseUrl || !localSettings.supabaseKey) {
            setSyncStatus({ type: 'error', message: "Missing configuration." });
            return;
        }
        if (!window.confirm("This will OVERWRITE your local data with data from the cloud. Continue?")) return;

        setIsSyncing(true);
        setSyncStatus({ type: 'info', message: "Downloading data..." });
        try {
            const data = await downloadDataFromSupabase(localSettings.supabaseUrl, localSettings.supabaseKey);
            
            allData.setMembers(data.members);
            allData.setEntries(data.entries);
            allData.setUsers(data.users);
            allData.setWeeklyHistory(data.history);
            allData.setAttendance(data.attendance);
            allData.setDevelopmentFund(data.developmentFund);
            if(data.monthLocks) allData.setMonthLocks(data.monthLocks);

            setSyncStatus({ type: 'success', message: "Download successful! Local data updated." });
        } catch (e: any) {
             setSyncStatus({ type: 'error', message: e.message });
        } finally {
            setIsSyncing(false);
        }
    };

    const toggleMonthLock = (monthStr: string) => {
        if (!allData) return;
        const locks = [...allData.monthLocks];
        const index = locks.findIndex(l => l.month === monthStr);
        
        if (index > -1) {
            // Toggle
            locks[index] = {
                ...locks[index],
                isLocked: !locks[index].isLocked,
                lockedBy: currentUser.username,
                lockedAt: new Date().toISOString()
            };
        } else {
            // Create New Lock
            locks.push({
                month: monthStr,
                isLocked: true,
                lockedBy: currentUser.username,
                lockedAt: new Date().toISOString()
            });
        }
        allData.setMonthLocks(locks);
    };

    const getLockStatus = (monthStr: string) => {
        return allData?.monthLocks.find(l => l.month === monthStr)?.isLocked || false;
    };

    return (
        <div className="space-y-8 max-w-4xl">
            
            {/* 1. Financial Controls (Admin & Finance Chair Only) */}
            {(currentUser.role === 'admin' || currentUser.role === 'finance-chair') && allData && (
                 <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200/80 border-l-4 border-l-amber-500">
                    <h3 className="text-xl font-bold text-slate-800 border-b pb-3 mb-4 flex justify-between items-center">
                        <span>Financial Controls (Month Locking)</span>
                        <div className="text-sm font-normal text-slate-500 flex items-center gap-2">
                            Year: 
                            <select value={manageLockYear} onChange={e => setManageLockYear(parseInt(e.target.value))} className="border-slate-300 rounded text-sm py-1">
                                {[0,1].map(i => <option key={i} value={new Date().getFullYear()-i}>{new Date().getFullYear()-i}</option>)}
                            </select>
                        </div>
                    </h3>
                    <p className="text-sm text-slate-600 mb-4">Locked months cannot be edited by standard Finance Teams or Data Entry staff.</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {Array.from({ length: 12 }, (_, i) => {
                            const date = new Date(manageLockYear, i, 1);
                            const monthStr = date.toISOString().substring(0, 7);
                            const isLocked = getLockStatus(monthStr);
                            const isFuture = date > new Date();

                            return (
                                <button
                                    key={monthStr}
                                    onClick={() => toggleMonthLock(monthStr)}
                                    disabled={isFuture}
                                    className={`p-3 rounded-lg border text-center transition-all ${
                                        isLocked 
                                        ? 'bg-red-50 border-red-200 text-red-800' 
                                        : 'bg-green-50 border-green-200 text-green-800'
                                    } ${isFuture ? 'opacity-40 cursor-not-allowed' : 'hover:shadow-md'}`}
                                >
                                    <div className="font-bold">{date.toLocaleDateString('en-US', { month: 'short' })}</div>
                                    <div className="text-xs uppercase font-bold mt-1">
                                        {isLocked ? 'Locked 🔒' : 'Open 🔓'}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 2. System Settings (Admin Only) */}
            {currentUser.role === 'admin' ? (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200/80">
                    <h3 className="text-xl font-bold text-slate-800 border-b pb-3 mb-4">System Configuration</h3>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="currency" className="block font-medium text-slate-700">Currency Symbol</label>
                            <input type="text" id="currency" name="currency" value={localSettings.currency} onChange={handleChange} className="mt-1 block w-full md:w-1/2 border-slate-300 rounded-md shadow-sm py-2 px-3" />
                        </div>
                        <div>
                            <label htmlFor="maxClasses" className="block font-medium text-slate-700">Number of Classes</label>
                            <input type="number" id="maxClasses" name="maxClasses" value={localSettings.maxClasses} onChange={handleChange} className="mt-1 block w-full md:w-1/2 border-slate-300 rounded-md shadow-sm py-2 px-3" />
                        </div>
                        <div className="flex items-center gap-3 mt-4">
                            <input type="checkbox" id="enforceDirectory" name="enforceDirectory" checked={localSettings.enforceDirectory} onChange={handleChange} className="h-5 w-5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" />
                            <label htmlFor="enforceDirectory" className="font-medium text-slate-700">Enforce Member Directory for new entries</label>
                        </div>
                        <div className="pt-4 flex justify-end">
                            <button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg shadow-md">
                                Save System Settings
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-center text-slate-500 italic">
                    Only Administrators can modify System Configuration.
                </div>
            )}
            
             {/* 3. Cloud Sync (Supabase) - Admin Only */}
             {currentUser.role === 'admin' && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200/80">
                    <div className="flex items-center gap-2 mb-4 border-b pb-3">
                        <h3 className="text-xl font-bold text-slate-800">Cloud Database (Supabase)</h3>
                    </div>
                    
                    <div className="space-y-5">
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700">Project URL</label>
                                <input 
                                    type="text" 
                                    name="supabaseUrl" 
                                    value={localSettings.supabaseUrl || ''} 
                                    onChange={handleChange} 
                                    className="mt-1 block w-full border-slate-300 rounded-md shadow-sm font-mono text-sm py-2 px-3 bg-slate-50" 
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700">API Key</label>
                                <input 
                                    type="password" 
                                    name="supabaseKey" 
                                    value={localSettings.supabaseKey || ''} 
                                    onChange={handleChange} 
                                    className="mt-1 block w-full border-slate-300 rounded-md shadow-sm font-mono text-sm py-2 px-3 bg-slate-50" 
                                />
                            </div>
                        </div>

                        <div className="pt-2 flex flex-wrap gap-4 items-center border-b pb-4 mb-4 border-slate-100">
                            <button onClick={handleTestSupabase} disabled={isTesting} className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-4 rounded-lg">
                                {isTesting ? "Testing..." : "Test Connection"}
                            </button>
                            {testResult && (
                                <span className={`text-sm font-medium ${testResult.success ? 'text-green-700' : 'text-red-600'}`}>
                                    {testResult.success ? "✓ Connected & Saved" : `✗ ${testResult.message}`}
                                </span>
                            )}
                        </div>
                        
                        {allData && (
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <h4 className="font-bold text-slate-700 mb-2">Manual Sync Actions</h4>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={handlePushToCloud} disabled={isSyncing} className="bg-indigo-600 text-white font-medium py-2 px-4 rounded-md shadow-sm">↑ Push to Cloud</button>
                                    <button onClick={handlePullFromCloud} disabled={isSyncing} className="bg-orange-600 text-white font-medium py-2 px-4 rounded-md shadow-sm">↓ Pull from Cloud</button>
                                </div>
                                {syncStatus && <p className="mt-2 text-sm font-medium text-blue-600">{syncStatus.message}</p>}
                            </div>
                        )}
                    </div>
                </div>
             )}

            {/* 4. Local Backup - Available to all with access to Settings tab */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200/80 mt-8">
                <h3 className="text-xl font-bold text-slate-800 border-b pb-3 mb-4">Local Backup & Restore</h3>
                <div className="flex flex-col md:flex-row gap-4 items-start">
                    <div className="flex-1">
                        <button onClick={() => onExport('json_all')} className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-lg w-full">Export Backup (JSON)</button>
                    </div>
                    {currentUser.role === 'admin' && (
                        <div className="flex-1 w-full">
                            <label className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-lg cursor-pointer flex justify-center w-full">
                            <span>Restore Backup (JSON)</span>
                            <input type="file" accept=".json" className="hidden" onChange={handleFileImport} />
                            </label>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
};

export default SettingsTab;
