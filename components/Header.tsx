
import React from 'react';
import { sanitizeString } from '../utils';
import type { Entry, User, SyncStatus, Settings } from '../types';
import { ChurchIcon } from './icons';

interface HeaderProps {
    entries: Entry[];
    onImport: (entries: Entry[]) => void;
    onExport: (format: 'csv' | 'json') => void;
    currentUser: User | null;
    onLogout: () => void;
    syncStatus?: SyncStatus;
    settings: Settings;
}

const Header: React.FC<HeaderProps> = ({ currentUser, onLogout, syncStatus, settings }) => {
    
    // Debug: Log logo status
    React.useEffect(() => {
        console.log('Header - Logo URL exists:', !!settings.logoUrl);
        if (settings.logoUrl) {
            console.log('Header - Logo URL length:', settings.logoUrl.length);
        }
    }, [settings.logoUrl]);
    
    const getSyncBadge = () => {
        // Default to Offline if no status provided
        if (!syncStatus || syncStatus.state === 'offline') {
             return (
                <div className="flex items-center gap-2 bg-slate-200/20 px-3 py-1.5 rounded-full border border-slate-300/30">
                    <div className="h-2 w-2 rounded-full bg-slate-400"></div>
                    <span className="text-xs font-semibold text-slate-100 opacity-80">Offline Mode</span>
                </div>
            );
        }
        
        switch (syncStatus.state) {
            case 'syncing':
                return (
                    <div className="flex items-center gap-2 bg-blue-500/30 px-3 py-1.5 rounded-full border border-blue-400/50 shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                        <svg className="animate-spin h-3 w-3 text-blue-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-xs font-bold text-blue-100 tracking-wide">Syncing...</span>
                    </div>
                );
            case 'synced':
                return (
                    <div className="flex items-center gap-2 bg-emerald-500/20 px-3 py-1.5 rounded-full border border-emerald-400/30">
                        <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
                        <span className="text-xs font-bold text-emerald-100 tracking-wide">Connected</span>
                    </div>
                );
            case 'error':
                 return (
                    <div className="flex items-center gap-2 bg-red-500/20 px-3 py-1.5 rounded-full border border-red-400/30 animate-pulse" title={syncStatus.errorMessage}>
                        <div className="h-2 w-2 rounded-full bg-red-400"></div>
                        <span className="text-xs font-bold text-red-100 tracking-wide">Sync Error</span>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <header className="no-print bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 text-white rounded-2xl p-6 mb-8 shadow-2xl border-2 border-slate-600/40 relative overflow-hidden">
            {/* Decorative background pattern */}
            <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1)_0%,transparent_50%),radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.08)_0%,transparent_50%)]"></div>
            </div>
            
            <div className="relative flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-5">
                    {/* Logo */}
                    {settings.logoUrl ? (
                        <div className="bg-white p-3 rounded-xl shadow-lg border-2 border-slate-300 flex items-center justify-center">
                            <img src={settings.logoUrl} alt="Organization Logo" className="h-16 w-16 object-contain" />
                        </div>
                    ) : (
                        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl shadow-lg border-2 border-blue-400/30">
                            <ChurchIcon />
                        </div>
                    )}
                    
                    {/* Title Section */}
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-sm">GMCT Management System</h1>
                        <div className="flex items-center gap-4 mt-2">
                            <p className="text-base text-slate-300 font-medium">Comprehensive Church Management Solution</p>
                            {getSyncBadge()}
                        </div>
                    </div>
                </div>
                
                {/* User Section */}
                <div className="flex items-center gap-4">
                    {currentUser && (
                        <>
                            <button 
                                onClick={() => {
                                    const event = new KeyboardEvent('keydown', {
                                        key: '?',
                                        ctrlKey: true,
                                        code: 'Slash'
                                    });
                                    window.dispatchEvent(event);
                                }}
                                className="bg-slate-700/50 hover:bg-slate-600 text-white px-4 py-3 rounded-lg transition-all duration-200 font-semibold shadow-md hover:shadow-lg flex items-center gap-2 text-base"
                                title="Press Ctrl+? for keyboard shortcuts"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Help
                            </button>
                            <div className="flex items-center gap-4 bg-slate-900/50 px-6 py-4 rounded-xl border-2 border-slate-600/40 backdrop-blur-sm shadow-lg">
                                <div className="flex flex-col items-end">
                                    <span className="text-sm text-slate-400 uppercase tracking-wider font-semibold">Logged in as</span>
                                    <span className="text-lg font-bold text-white">{sanitizeString(currentUser.username)}</span>
                                    <span className="text-sm text-blue-300 font-medium capitalize">{currentUser.role.replace('-', ' ')}</span>
                                </div>
                                <div className="h-12 w-px bg-slate-600"></div>
                                <button onClick={onLogout} className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-6 py-3 rounded-lg transition-all duration-200 font-semibold shadow-md hover:shadow-lg hover:scale-105 text-base">
                                    Logout
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;