// components/FinancialControl.tsx
import React, { useState } from 'react';
import type { MonthLock, User, Settings } from '../types';
import { saveMonthLockToSupabase } from '../services/supabase';

interface FinancialControlProps {
    monthLocks: MonthLock[];
    setMonthLocks: React.Dispatch<React.SetStateAction<MonthLock[]>>;
    currentUser: User;
    settings: Settings;
}

const FinancialControl: React.FC<FinancialControlProps> = ({ monthLocks, setMonthLocks, currentUser, settings }) => {
    const [manageLockYear, setManageLockYear] = useState(new Date().getFullYear());

    const toggleMonthLock = async (monthStr: string) => {
        const locks = [...monthLocks];
        const index = locks.findIndex(l => l.month === monthStr);
        
        const updatedLock: MonthLock = index > -1
            ? {
                ...locks[index],
                isLocked: !locks[index].isLocked,
                lockedBy: currentUser.username,
                lockedAt: new Date().toISOString()
            }
            : {
                month: monthStr,
                isLocked: true,
                lockedBy: currentUser.username,
                lockedAt: new Date().toISOString()
            };

        if (index > -1) {
            locks[index] = updatedLock;
        } else {
            locks.push(updatedLock);
        }

        try {
            if (settings.supabaseUrl && settings.supabaseKey) {
                await saveMonthLockToSupabase(settings.supabaseUrl, settings.supabaseKey, updatedLock);
            }
            setMonthLocks(locks);
        } catch (error: any) {
            alert(`Failed to update month lock: ${error.message}`);
        }
    };

    const getLockStatus = (monthStr: string) => {
        return monthLocks.find(l => l.month === monthStr)?.isLocked || false;
    };

    const getLockInfo = (monthStr: string) => {
        return monthLocks.find(l => l.month === monthStr);
    };

    const totalLockedMonths = monthLocks.filter(l => l.isLocked).length;

    return (
        <div className="space-y-6 max-w-5xl">
            <div>
                <h2 className="inline-block text-3xl font-extrabold text-white bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-3 rounded-xl shadow-lg">🔐 Financial Control</h2>
                <p className="text-base text-slate-600 mt-3 font-medium">Lock and unlock months to restrict editing by finance team members.</p>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative overflow-hidden bg-gradient-to-br from-red-600 to-rose-600 p-5 rounded-xl shadow-lg border-2 border-red-300">
                    <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10"></div>
                    <h3 className="text-sm font-bold uppercase text-red-100">Locked Months</h3>
                    <p className="text-3xl font-extrabold text-white mt-1">{totalLockedMonths}</p>
                </div>
                <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 to-green-600 p-5 rounded-xl shadow-lg border-2 border-emerald-300">
                    <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10"></div>
                    <h3 className="text-sm font-bold uppercase text-emerald-100">Unlocked Months</h3>
                    <p className="text-3xl font-extrabold text-white mt-1">{12 - totalLockedMonths}</p>
                </div>
            </div>

            {/* Month Lock Controls */}
            <div className="bg-white rounded-xl shadow-lg border-2 border-slate-200 p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-800">Month Lock Status</h3>
                    <div className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                        Year:
                        <select 
                            value={manageLockYear} 
                            onChange={e => setManageLockYear(parseInt(e.target.value))} 
                            className="border-2 border-slate-300 rounded-lg py-1 px-3 font-bold"
                        >
                            {[0,1,2].map(i => <option key={i} value={new Date().getFullYear()-i}>{new Date().getFullYear()-i}</option>)}
                        </select>
                    </div>
                </div>

                <p className="text-sm text-slate-600 mb-6 font-medium">
                    🔒 <strong>Locked</strong> months cannot be edited by Finance Team or Data Entry staff. Only Admin and Finance Chair can edit locked months.
                </p>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {Array.from({ length: 12 }, (_, i) => {
                        const date = new Date(manageLockYear, i, 1);
                        const monthStr = date.toISOString().substring(0, 7);
                        const isLocked = getLockStatus(monthStr);
                        const isFuture = date > new Date();
                        const lockInfo = getLockInfo(monthStr);

                        return (
                            <button
                                key={monthStr}
                                onClick={() => toggleMonthLock(monthStr)}
                                disabled={isFuture}
                                title={lockInfo ? `${lockInfo.isLocked ? 'Locked' : 'Unlocked'} by ${lockInfo.lockedBy}` : ''}
                                className={`p-4 rounded-lg border-2 text-center transition-all font-bold ${
                                    isLocked 
                                        ? 'bg-gradient-to-br from-red-100 to-rose-100 border-red-400 text-red-800 hover:shadow-md hover:scale-105' 
                                        : 'bg-gradient-to-br from-green-100 to-emerald-100 border-green-400 text-green-800 hover:shadow-md hover:scale-105'
                                } ${isFuture ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                                <div className="text-sm">{date.toLocaleDateString('en-US', { month: 'short' })}</div>
                                <div className="text-xs uppercase font-extrabold mt-2">
                                    {isLocked ? '🔒 Locked' : '🔓 Open'}
                                </div>
                                {lockInfo && !isFuture && (
                                    <div className="text-[10px] mt-1 opacity-75">{lockInfo.lockedBy}</div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Information Panel */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg border-2 border-blue-200 p-6">
                <h4 className="text-lg font-bold text-blue-800 mb-3 flex items-center gap-2">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2z" clipRule="evenodd" />
                    </svg>
                    About Month Locking
                </h4>
                <ul className="space-y-2 text-sm text-blue-900 font-medium">
                    <li>✓ <strong>Admin & Finance Chair</strong> can lock/unlock any month and edit locked months.</li>
                    <li>✓ <strong>Finance Team & Data Entry</strong> cannot edit entries in locked months.</li>
                    <li>✓ Use locking to prevent accidental changes after month-end reconciliation.</li>
                    <li>✓ Each lock records who locked it and when for audit purposes.</li>
                </ul>
            </div>
        </div>
    );
};

export default FinancialControl;
