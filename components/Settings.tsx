
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

    // Month Lock State removed - moved to Financial Control tab

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
            if(data.monthLocks) allData.setMonthLocks(data.monthLocks);

            setSyncStatus({ type: 'success', message: "Download successful! Local data updated." });
        } catch (e: any) {
             setSyncStatus({ type: 'error', message: e.message });
        } finally {
            setIsSyncing(false);
        }
    };

    const toggleMonthLock = (monthStr: string) => {
        // This function moved to FinancialControl component
    };

    const getLockStatus = (monthStr: string) => {
        // This function moved to FinancialControl component
        return false;
    };

    return (
        <div className="space-y-8 max-w-5xl">
            <div>
                <h2 className="inline-block text-3xl font-extrabold text-white bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3 rounded-xl shadow-lg">⚙️ Settings</h2>
                <p className="text-base text-slate-600 mt-3 font-medium">Configure system preferences, cloud sync, and data management.</p>
            </div>
            
            {/* 1. System Settings (Admin Only) */}
            {currentUser.role === 'admin' ? (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl shadow-lg border-2 border-blue-200">
                    <h3 className="text-xl font-bold text-blue-800 border-b-2 border-blue-100 pb-3 mb-4">System Configuration</h3>
                    <div className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="currency" className="block font-bold text-blue-800 text-sm uppercase mb-2">💷 Currency Symbol</label>
                                <input type="text" id="currency" name="currency" value={localSettings.currency} onChange={handleChange} className="w-full border-2 border-blue-300 rounded-lg py-2 px-3 font-mono text-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400" />
                            </div>
                            <div>
                                <label htmlFor="maxClasses" className="block font-bold text-blue-800 text-sm uppercase mb-2">📊 Number of Classes</label>
                                <input type="number" id="maxClasses" name="maxClasses" value={localSettings.maxClasses} onChange={handleChange} className="w-full border-2 border-blue-300 rounded-lg py-2 px-3 font-mono text-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400" />
                            </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-blue-200">
                            <label htmlFor="enforceDirectory" className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" id="enforceDirectory" name="enforceDirectory" checked={localSettings.enforceDirectory} onChange={handleChange} className="h-6 w-6 text-blue-600 border-2 border-blue-300 rounded focus:ring-blue-500" />
                                <span className="font-bold text-blue-800">Enforce Member Directory for new entries</span>
                            </label>
                        </div>
                        <div className="flex justify-end pt-4">
                            <button onClick={handleSave} className="bg-gradient-to-br from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-all hover:scale-105 border-2 border-blue-300">
                                ✓ Save System Settings
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-gradient-to-br from-slate-100 to-slate-200 p-6 rounded-xl border-2 border-slate-300 text-center text-slate-700 font-bold">
                    🔒 Only Administrators can modify System Configuration.
                </div>
            )}
            
             {/* 2. Cloud Sync (Supabase) - Admin Only */}
             {currentUser.role === 'admin' && (
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-6 rounded-xl shadow-lg border-2 border-purple-200">
                    <h3 className="text-xl font-bold text-purple-800 border-b-2 border-purple-100 pb-3 mb-4">☁️ Cloud Database (Supabase)</h3>
                    
                    <div className="space-y-5">
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-sm font-bold uppercase text-purple-800 mb-2">🔗 Project URL</label>
                                <input 
                                    type="text" 
                                    name="supabaseUrl" 
                                    value={localSettings.supabaseUrl || ''} 
                                    onChange={handleChange} 
                                    className="w-full border-2 border-purple-300 rounded-lg py-2 px-3 font-mono text-sm bg-white focus:ring-2 focus:ring-purple-400 focus:border-purple-400" 
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold uppercase text-purple-800 mb-2">🔐 API Key</label>
                                <input 
                                    type="password" 
                                    name="supabaseKey" 
                                    value={localSettings.supabaseKey || ''} 
                                    onChange={handleChange} 
                                    className="w-full border-2 border-purple-300 rounded-lg py-2 px-3 font-mono text-sm bg-white focus:ring-2 focus:ring-purple-400 focus:border-purple-400" 
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-4 items-center border-b-2 border-purple-100 pb-4">
                            <button onClick={handleTestSupabase} disabled={isTesting} className="bg-gradient-to-br from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white font-bold py-2 px-6 rounded-lg shadow-md transition-all">
                                {isTesting ? "🔄 Testing..." : "✓ Test Connection"}
                            </button>
                            {testResult && (
                                <span className={`text-sm font-bold ${testResult.success ? 'text-green-700' : 'text-red-600'}`}>
                                    {testResult.success ? "✓ Connected & Saved" : `✗ ${testResult.message}`}
                                </span>
                            )}
                        </div>
                        
                        {allData && (
                            <div className="bg-white rounded-lg border-2 border-purple-200 p-4">
                                <h4 className="font-bold text-purple-800 mb-3">Manual Sync Actions</h4>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={handlePushToCloud} disabled={isSyncing} className="bg-gradient-to-br from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-2 px-6 rounded-lg shadow-md transition-all">↑ Push to Cloud</button>
                                    <button onClick={handlePullFromCloud} disabled={isSyncing} className="bg-gradient-to-br from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold py-2 px-6 rounded-lg shadow-md transition-all">↓ Pull from Cloud</button>
                                </div>
                                {syncStatus && <p className="mt-3 text-sm font-bold text-indigo-700 bg-indigo-50 px-3 py-2 rounded-lg">{syncStatus.message}</p>}
                            </div>
                        )}
                    </div>
                </div>
             )}

            {/* 3. Local Backup - Available to all with access to Settings tab */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-xl shadow-lg border-2 border-amber-200">
                <h3 className="text-xl font-bold text-amber-800 border-b-2 border-amber-100 pb-3 mb-4">💾 Local Backup & Restore</h3>
                <p className="text-sm text-amber-900 bg-amber-100 border border-amber-200 rounded-lg p-3 mb-4 font-medium">
                    Use Export to download a complete backup of your local data (members, entries, attendance, weekly history, users, development fund, and locks) as a JSON file. Restore replaces your current local data with a previously exported backup. This does not touch cloud data; use Cloud Sync above for Supabase.
                </p>
                <div className="flex flex-col md:flex-row gap-4">
                    <button onClick={() => onExport('json_all')} className="flex-1 bg-gradient-to-br from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all hover:scale-105 border-2 border-slate-600">
                        📥 Export Backup (JSON)
                    </button>
                    {currentUser.role === 'admin' && (
                        <label className="flex-1 bg-gradient-to-br from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all hover:scale-105 border-2 border-slate-600 cursor-pointer flex justify-center">
                            <span>📤 Restore Backup (JSON)</span>
                            <input type="file" accept=".json" className="hidden" onChange={handleFileImport} />
                        </label>
                    )}
                </div>
            </div>

        </div>
    );
};

export default SettingsTab;
