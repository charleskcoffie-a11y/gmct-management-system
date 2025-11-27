
import React from 'react';
import { sanitizeString } from '../utils';
import type { Entry, User, SyncStatus } from '../types';
import { ChurchIcon } from './icons';

interface HeaderProps {
    entries: Entry[];
    onImport: (entries: Entry[]) => void;
    onExport: (format: 'csv' | 'json') => void;
    currentUser: User | null;
    onLogout: () => void;
    syncStatus?: SyncStatus;
}

const Header: React.FC<HeaderProps> = ({ currentUser, onLogout, syncStatus }) => {
    
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
        <header className="no-print bg-gradient-to-r from-indigo-800 to-indigo-600 text-white rounded-xl p-5 mb-8 flex flex-col md:flex-row justify-between items-center gap-4 shadow-xl border border-indigo-500/30">
            <div className="flex items-center gap-4">
                <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm shadow-inner">
                    <ChurchIcon />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">GMCT Management System</h1>
                    <div className="flex items-center gap-4 mt-1">
                         <p className="text-sm text-indigo-100 font-medium opacity-80">Record Keeping Made Simple</p>
                         {getSyncBadge()}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-4">
                 {currentUser && (
                    <div className="flex items-center gap-3 bg-indigo-900/30 px-4 py-2 rounded-full border border-indigo-400/20 backdrop-blur-sm">
                        <div className="flex flex-col items-end">
                            <span className="text-xs text-indigo-200 uppercase tracking-wider font-semibold">Logged in as</span>
                            <span className="text-sm font-bold text-white">{sanitizeString(currentUser.username)}</span>
                        </div>
                        <div className="h-8 w-px bg-indigo-400/30 mx-1"></div>
                        <button onClick={onLogout} className="text-sm bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-all duration-200 font-medium">
                            Logout
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
};

export default Header;