import React, { useState, useMemo } from 'react';
import type { Society } from '../types';
import { CANADA_MISSION_SOCIETIES } from '../constants';
import { ChurchIcon } from './icons';

interface SocietySelectorProps {
    onSelectSociety: (society: Society) => void;
    currentSocietyId?: string;
}

export const SocietySelector: React.FC<SocietySelectorProps> = ({
    onSelectSociety,
    currentSocietyId = 'gmct',
}) => {
    const [selectedId, setSelectedId] = useState<string>(currentSocietyId);

    const primarySociety = useMemo(
        () => CANADA_MISSION_SOCIETIES.find(s => s.isPrimary) || CANADA_MISSION_SOCIETIES[0],
        []
    );

    const activeSociety = useMemo(
        () => CANADA_MISSION_SOCIETIES.find(s => s.id === selectedId) || primarySociety,
        [selectedId, primarySociety]
    );

    // Group societies by province for clean dropdown organization
    const groupedByProvince = useMemo(() => {
        const map = new Map<string, Society[]>();
        CANADA_MISSION_SOCIETIES.forEach(s => {
            const list = map.get(s.province) || [];
            list.push(s);
            map.set(s.province, list);
        });
        return Array.from(map.entries()).sort((a, b) => {
            // Ontario first, then alphabetical
            if (a[0] === 'Ontario') return -1;
            if (b[0] === 'Ontario') return 1;
            return a[0].localeCompare(b[0]);
        });
    }, []);

    const handleEnterPortal = () => {
        onSelectSociety(activeSociety);
    };

    return (
        <div className="relative min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-8">
            {/* Ambient Background Glow */}
            <div className="pointer-events-none absolute inset-0 opacity-40 bg-[radial-gradient(1200px_600px_at_-10%_-10%,rgba(99,102,241,0.25),transparent_60%),radial-gradient(800px_400px_at_120%_110%,rgba(236,72,153,0.18),transparent_55%)]" />

            <div className="relative w-full max-w-xl z-10 my-auto">
                {/* Modern Glass Card */}
                <div className="backdrop-blur-xl bg-slate-900/85 border border-white/10 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8 md:p-10">
                    
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-400/30 text-indigo-300 text-xs font-semibold tracking-wider uppercase mb-3">
                            <span>🇨🇦</span> Canada Mission • The Methodist Church Ghana
                        </div>
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                            Mission Portal
                        </h1>
                        <p className="text-xs sm:text-sm text-indigo-200/80 mt-1.5">
                            Select your parish or society to access member and financial services.
                        </p>
                    </div>

                    {/* Modern Combobox */}
                    <div className="space-y-5">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-indigo-200 mb-2 flex items-center justify-between">
                                <span>Select Society</span>
                                <span className="text-[11px] text-indigo-300/80 font-normal">13 Active Branches</span>
                            </label>
                            
                            <div className="relative">
                                <select
                                    value={selectedId}
                                    onChange={e => setSelectedId(e.target.value)}
                                    className="w-full bg-slate-950/90 border-2 border-indigo-400/40 hover:border-indigo-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/20 rounded-2xl px-4 py-3.5 text-sm sm:text-base font-semibold text-white shadow-inner appearance-none cursor-pointer outline-none transition-all pr-12"
                                >
                                    {groupedByProvince.map(([prov, socs]) => (
                                        <optgroup key={prov} label={`📍 ${prov}`} className="bg-slate-900 text-indigo-300 font-bold py-1">
                                            {socs.map(s => (
                                                <option key={s.id} value={s.id} className="bg-slate-950 text-white font-medium py-1">
                                                    {s.name} ({s.city}, {s.provinceCode}) {s.isPrimary ? '⭐ [Head Office]' : `• [${s.societyCode}]`}
                                                </option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-indigo-300 text-lg">
                                    ▾
                                </div>
                            </div>
                        </div>

                        {/* Selected Society Card Preview */}
                        <div className="bg-gradient-to-r from-indigo-950/70 via-purple-950/50 to-slate-950/80 border border-indigo-500/30 rounded-2xl p-4 sm:p-5 shadow-lg">
                            <div className="flex items-start gap-4">
                                <div className="h-12 w-12 rounded-xl bg-indigo-600/80 border border-indigo-400/40 flex items-center justify-center text-white shrink-0 shadow-md">
                                    <ChurchIcon />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-base sm:text-lg font-bold text-white truncate">
                                            {activeSociety.name}
                                        </h3>
                                        {activeSociety.isPrimary ? (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40">
                                                ⭐ Primary Head Society
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/40 font-mono">
                                                {activeSociety.societyCode}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-indigo-200/90 mt-1">
                                        📍 {activeSociety.city}, {activeSociety.province} {activeSociety.address ? `• ${activeSociety.address}` : ''}
                                    </p>
                                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                                        <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/30">
                                            ✓ Member Directory
                                        </span>
                                        <span className="text-[10px] font-semibold text-blue-300 bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-500/30">
                                            ✓ Finance & Tithes
                                        </span>
                                        <span className="text-[10px] font-semibold text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded-md border border-purple-500/30">
                                            ✓ Class Attendance
                                        </span>
                                        {activeSociety.features?.taxReceipts && (
                                            <span className="text-[10px] font-semibold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-500/30">
                                                ✓ Tax Receipts
                                            </span>
                                        )}
                                        {activeSociety.isPrimary && (
                                            <span className="text-[10px] font-semibold text-rose-300 bg-rose-950/60 px-2 py-0.5 rounded-md border border-rose-500/30">
                                                ★ Wesley Hall & Parking
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Direct Action Button */}
                        <button
                            type="button"
                            onClick={handleEnterPortal}
                            className="w-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3.5 px-6 rounded-2xl shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:scale-[1.01] transition-all duration-200 text-sm sm:text-base flex items-center justify-center gap-2 group cursor-pointer"
                        >
                            <span>Enter {activeSociety.shortName} Portal</span>
                            <span className="text-lg group-hover:translate-x-1 transition-transform">→</span>
                        </button>

                        {/* Quick 1-Click GMCT Default Button */}
                        {!activeSociety.isPrimary && (
                            <div className="text-center pt-1">
                                <button
                                    type="button"
                                    onClick={() => onSelectSociety(primarySociety)}
                                    className="text-xs text-indigo-300/80 hover:text-white underline transition-colors"
                                >
                                    Looking for Ghana Methodist Church Toronto (GMCT)? Click here
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="mt-8 pt-5 border-t border-white/5 text-center text-[11px] text-slate-500">
                        Canada Mission Management System • Secure Multi-Tenant Access
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SocietySelector;
