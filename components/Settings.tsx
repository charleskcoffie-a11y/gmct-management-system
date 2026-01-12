
// components/Settings.tsx
import React, { useState } from 'react';
import type { Settings, CloudState, Entry, Member, WeeklyHistoryRecord, User, DevelopmentFundEntry, MonthLock } from '../types';
import { testSupabaseConnection, uploadDataToSupabase, downloadDataFromSupabase, saveSettingsToSupabase } from '../services/supabase';

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
        weeklyHistory: WeeklyHistoryRecord[];
        users: User[];
        developmentFund: DevelopmentFundEntry[];
        monthLocks: MonthLock[];
        setEntries: (d: Entry[]) => void;
        setMembers: (d: Member[]) => void;
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

    const handleSave = async () => {
        setSettings(localSettings);
        
        // Also save to Supabase if configured
        if (localSettings.supabaseUrl && localSettings.supabaseKey) {
            try {
                await saveSettingsToSupabase(localSettings.supabaseUrl, localSettings.supabaseKey, localSettings);
            } catch (e: any) {
                console.warn('Failed to sync settings to Supabase:', e.message);
            }
        }
        
        alert('Settings saved successfully!');
    };

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            onImport(file);
        }
        event.target.value = ""; // Reset file input
    };

    const handleSignatureUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = e.target?.result as string;
                setLocalSettings(prev => ({
                    ...prev,
                    signatureImage: base64
                }));
            };
            reader.readAsDataURL(file);
        }
        event.target.value = ""; // Reset file input
    };

    const handleRemoveSignature = () => {
        setLocalSettings(prev => ({
            ...prev,
            signatureImage: undefined
        }));
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
                history: allData.weeklyHistory,
                users: allData.users,
                monthLocks: allData.monthLocks,
                settings: localSettings
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
            if(data.monthLocks) allData.setMonthLocks(data.monthLocks);
            if(data.settings) {
                setSettings(data.settings);
                setLocalSettings(data.settings);
            }

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
            
            {/* 2. Organization Details - Admin Only */}
            {currentUser.role === 'admin' ? (
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl shadow-lg border-2 border-green-200">
                    <h3 className="text-xl font-bold text-green-800 border-b-2 border-green-100 pb-3 mb-4">🏛️ Organization Details</h3>
                    <div className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="orgName" className="block font-bold text-green-800 text-sm uppercase mb-2">Organization Name</label>
                                <input type="text" id="orgName" name="orgName" value={localSettings.orgName || ''} onChange={handleChange} className="w-full border-2 border-green-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-green-400 focus:border-green-400" placeholder="Ghana Methodist Church of Toronto" />
                            </div>
                            <div>
                                <label htmlFor="charityNumber" className="block font-bold text-green-800 text-sm uppercase mb-2">Charity Number</label>
                                <input type="text" id="charityNumber" name="charityNumber" value={localSettings.charityNumber || ''} onChange={handleChange} className="w-full border-2 border-green-300 rounded-lg py-2 px-3 font-mono focus:ring-2 focus:ring-green-400 focus:border-green-400" placeholder="873990964RP0001" />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="orgAddress" className="block font-bold text-green-800 text-sm uppercase mb-2">Address</label>
                            <input type="text" id="orgAddress" name="orgAddress" value={localSettings.orgAddress || ''} onChange={handleChange} className="w-full border-2 border-green-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-green-400 focus:border-green-400" placeholder="69 Milvan Drive, Toronto, ON M9L 1Y8, Canada" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="orgPhone" className="block font-bold text-green-800 text-sm uppercase mb-2">Phone Number</label>
                                <input type="text" id="orgPhone" name="orgPhone" value={localSettings.orgPhone || ''} onChange={handleChange} className="w-full border-2 border-green-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-green-400 focus:border-green-400" placeholder="416-901-5900" />
                            </div>
                            <div>
                                <label htmlFor="orgEmail" className="block font-bold text-green-800 text-sm uppercase mb-2">Email</label>
                                <input type="text" id="orgEmail" name="orgEmail" value={localSettings.orgEmail || ''} onChange={handleChange} className="w-full border-2 border-green-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-green-400 focus:border-green-400" placeholder="info@gmct-ca.org" />
                            </div>
                        </div>
                        
                        {/* Treasurer Signature Upload */}
                        <div className="bg-white rounded-lg p-4 border-2 border-green-200">
                            <label className="block font-bold text-green-800 text-sm uppercase mb-3">✍️ Treasurer Signature</label>
                            <p className="text-xs text-green-700 mb-3">Upload an image of the treasurer's signature for tax receipts. Recommended: PNG with transparent background.</p>
                            
                            {localSettings.signatureImage ? (
                                <div className="space-y-3">
                                    <div className="bg-slate-50 border-2 border-slate-200 rounded-lg p-4 flex justify-center">
                                        <img src={localSettings.signatureImage} alt="Treasurer Signature" className="h-20 object-contain" />
                                    </div>
                                    <div className="flex gap-2">
                                        <label className="flex-1 bg-gradient-to-br from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-all cursor-pointer text-center text-sm">
                                            📤 Replace Signature
                                            <input type="file" accept="image/*" className="hidden" onChange={handleSignatureUpload} />
                                        </label>
                                        <button onClick={handleRemoveSignature} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-all text-sm">
                                            🗑️ Remove
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <label className="block bg-gradient-to-br from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all cursor-pointer text-center">
                                    📤 Upload Signature Image
                                    <input type="file" accept="image/*" className="hidden" onChange={handleSignatureUpload} />
                                </label>
                            )}
                        </div>
                        
                        <div className="flex justify-end pt-4">
                            <button onClick={handleSave} className="bg-gradient-to-br from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-all hover:scale-105 border-2 border-green-300">
                                ✓ Save Organization Details
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-gradient-to-br from-slate-100 to-slate-200 p-6 rounded-xl border-2 border-slate-300 text-center text-slate-700 font-bold">
                    🔒 Only Administrators can modify Organization Details.
                </div>
            )}
            
            {/* 2b. Class Access Codes - Admin Only */}
            {currentUser.role === 'admin' ? (
                <div className="bg-gradient-to-br from-yellow-50 to-amber-50 p-6 rounded-xl shadow-lg border-2 border-yellow-200">
                    <h3 className="text-xl font-bold text-yellow-800 border-b-2 border-yellow-100 pb-3 mb-4">🔑 Class Leader Access Codes</h3>
                    <p className="text-sm text-yellow-900 bg-yellow-100 border border-yellow-200 rounded-lg p-3 mb-4 font-medium">
                        Set unique access codes for each class. Class leaders log in with username "ClassLeader" (or any class-leader role user) and the code for their class as the password.
                    </p>
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {Array.from({ length: localSettings.maxClasses }, (_, i) => {
                                const classNum = String(i + 1);
                                const currentCode = localSettings.classAccessCodes?.[classNum] || '';
                                return (
                                    <div key={classNum} className="bg-white rounded-lg p-3 border-2 border-yellow-200">
                                        <label className="block font-bold text-yellow-800 text-sm mb-1">Class {classNum}</label>
                                        <input
                                            type="text"
                                            value={currentCode}
                                            onChange={(e) => {
                                                const newCodes = { ...(localSettings.classAccessCodes || {}) };
                                                newCodes[classNum] = e.target.value;
                                                setLocalSettings(prev => ({ ...prev, classAccessCodes: newCodes }));
                                            }}
                                            placeholder="e.g., alpha, beta, omega"
                                            className="w-full border-2 border-yellow-300 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-end pt-4">
                            <button onClick={handleSave} className="bg-gradient-to-br from-yellow-600 to-amber-600 hover:from-yellow-700 hover:to-amber-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-all hover:scale-105 border-2 border-yellow-300">
                                ✓ Save Access Codes
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-gradient-to-br from-slate-100 to-slate-200 p-6 rounded-xl border-2 border-slate-300 text-center text-slate-700 font-bold">
                    🔒 Only Administrators can modify Class Access Codes.
                </div>
            )}

            {/* Entry Window Restrictions - Admin Only */}
            {currentUser.role === 'admin' && (
                <div className="bg-gradient-to-br from-red-50 to-orange-50 p-6 rounded-xl shadow-lg border-2 border-red-200">
                    <h3 className="text-xl font-bold text-red-800 border-b-2 border-red-100 pb-3 mb-4">🕐 Entry Window Restrictions</h3>
                    <p className="text-sm text-red-700 mb-4">Control when financial entries can be created or edited. Admins can always override these restrictions.</p>
                    
                    <div className="space-y-4">
                        {/* Enable/Disable */}
                        <div className="bg-white rounded-lg p-4 border-2 border-red-200">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={localSettings.entryWindow?.enabled || false}
                                    onChange={(e) => {
                                        setLocalSettings(prev => ({
                                            ...prev,
                                            entryWindow: {
                                                ...(prev.entryWindow || { days: ['Sunday'], startTime: '06:00', endTime: '18:00' }),
                                                enabled: e.target.checked
                                            }
                                        }));
                                    }}
                                    className="h-6 w-6 text-red-600 border-2 border-red-300 rounded focus:ring-red-500"
                                />
                                <span className="font-bold text-red-800">Enable Entry Window Restrictions</span>
                            </label>
                        </div>

                        {localSettings.entryWindow?.enabled && (
                            <>
                                {/* Days Selection */}
                                <div className="bg-white rounded-lg p-4 border-2 border-red-200">
                                    <label className="block font-bold text-red-800 text-sm uppercase mb-3">📅 Allowed Days</label>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                                            <label key={day} className="flex items-center gap-2 cursor-pointer">
                                                <input 
                                                    type="checkbox"
                                                    checked={localSettings.entryWindow?.days?.includes(day) || false}
                                                    onChange={(e) => {
                                                        const days = localSettings.entryWindow?.days || [];
                                                        const newDays = e.target.checked 
                                                            ? [...days, day] 
                                                            : days.filter(d => d !== day);
                                                        setLocalSettings(prev => ({
                                                            ...prev,
                                                            entryWindow: {
                                                                ...prev.entryWindow,
                                                                days: newDays
                                                            }
                                                        }));
                                                    }}
                                                    className="h-4 w-4 text-red-600 border-2 border-red-300 rounded"
                                                />
                                                <span className="text-sm font-medium text-red-700">{day}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Time Range */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-white rounded-lg p-4 border-2 border-red-200">
                                        <label className="block font-bold text-red-800 text-sm uppercase mb-2">⏰ Start Time (EST)</label>
                                        <input 
                                            type="time"
                                            value={localSettings.entryWindow?.startTime || '06:00'}
                                            onChange={(e) => {
                                                setLocalSettings(prev => ({
                                                    ...prev,
                                                    entryWindow: {
                                                        ...prev.entryWindow,
                                                        startTime: e.target.value
                                                    }
                                                }));
                                            }}
                                            className="w-full border-2 border-red-300 rounded-lg py-2 px-3 text-lg focus:ring-2 focus:ring-red-400 focus:border-red-400"
                                        />
                                    </div>
                                    <div className="bg-white rounded-lg p-4 border-2 border-red-200">
                                        <label className="block font-bold text-red-800 text-sm uppercase mb-2">⏰ End Time (EST)</label>
                                        <input 
                                            type="time"
                                            value={localSettings.entryWindow?.endTime || '18:00'}
                                            onChange={(e) => {
                                                setLocalSettings(prev => ({
                                                    ...prev,
                                                    entryWindow: {
                                                        ...prev.entryWindow,
                                                        endTime: e.target.value
                                                    }
                                                }));
                                            }}
                                            className="w-full border-2 border-red-300 rounded-lg py-2 px-3 text-lg focus:ring-2 focus:ring-red-400 focus:border-red-400"
                                        />
                                    </div>
                                </div>

                                {/* Info Box */}
                                <div className="bg-red-100 border-2 border-red-300 rounded-lg p-4">
                                    <p className="text-sm text-red-900 font-medium">
                                        <strong>Current settings:</strong> Entries allowed on {localSettings.entryWindow?.days?.join(', ') || 'No days selected'} from {localSettings.entryWindow?.startTime} to {localSettings.entryWindow?.endTime} EST.
                                    </p>
                                    <p className="text-xs text-red-800 mt-2">
                                        ✓ Admins and Finance Chairs can always add/edit entries and will be logged as overrides outside the window.
                                    </p>
                                </div>
                            </>
                        )}

                        <div className="flex justify-end pt-4">
                            <button onClick={handleSave} className="bg-gradient-to-br from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-all hover:scale-105 border-2 border-red-300">
                                ✓ Save Entry Window Settings
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
             {/* 3. Cloud Sync (Supabase) - Admin Only */}
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

            {/* 3b. E-Transfer Inbound Settings - Admin Only */}
            {currentUser.role === 'admin' && (
                <div className="bg-gradient-to-br from-cyan-50 to-sky-50 p-6 rounded-xl shadow-lg border-2 border-cyan-200">
                    <h3 className="text-xl font-bold text-cyan-800 border-b-2 border-cyan-100 pb-3 mb-4">💸 E-Transfer Notifications</h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-bold uppercase text-cyan-800 mb-2">Provider</label>
                                <select name="etransferProvider" value={localSettings.etransferProvider || 'generic'} onChange={handleChange} className="w-full border-2 border-cyan-300 rounded-lg py-2 px-3 bg-white">
                                    <option value="sendgrid">SendGrid</option>
                                    <option value="mailgun">Mailgun</option>
                                    <option value="resend">Resend (inbound)</option>
                                    <option value="generic">Generic</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold uppercase text-cyan-800 mb-2">Notification Email</label>
                                <input type="email" name="etransferNotificationEmail" value={localSettings.etransferNotificationEmail || ''} onChange={handleChange} placeholder="treasurer@gmct.org" className="w-full border-2 border-cyan-300 rounded-lg py-2 px-3" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold uppercase text-cyan-800 mb-2">Inbound Secret</label>
                                <input type="password" name="etransferInboundSecret" value={localSettings.etransferInboundSecret || ''} onChange={handleChange} placeholder="Set a shared secret" className="w-full border-2 border-cyan-300 rounded-lg py-2 px-3" />
                            </div>
                        </div>
                        <div className="text-sm text-cyan-900 bg-cyan-100 border border-cyan-200 rounded-lg p-3">
                            Point your provider webhook to your Supabase function URL: <span className="font-mono">/functions/v1/etransfer-inbound</span> and send the shared secret in header <span className="font-mono">x-inbound-secret</span>.
                        </div>
                        <div className="flex justify-end">
                            <button onClick={handleSave} className="bg-gradient-to-br from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-bold py-2 px-6 rounded-lg shadow-md transition-all">✓ Save E-Transfer Settings</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 4. Local Backup - Available to all with access to Settings tab */}
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
