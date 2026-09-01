import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Society } from '../types';
import { CANADA_MISSION_SOCIETIES } from '../constants';
import { ChurchIcon } from './icons';

interface SocietySelectorProps {
    onSelectSociety: (society: Society) => void;
    currentSocietyId?: string;
    societies?: Society[];
    logoUrl?: string;
}

export const SocietySelector: React.FC<SocietySelectorProps> = ({
    onSelectSociety,
    currentSocietyId = 'gmct',
    societies = CANADA_MISSION_SOCIETIES,
    logoUrl,
}) => {
    const [selectedId, setSelectedId] = useState<string>(currentSocietyId);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const activeSocieties = useMemo(() => societies.filter(society => society.status !== 'archived'), [societies]);

    const primarySociety = useMemo(
        () => activeSocieties.find(s => s.isPrimary) || activeSocieties[0],
        [activeSocieties]
    );

    const activeSociety = useMemo(
        () => activeSocieties.find(s => s.id === selectedId) || primarySociety,
        [selectedId, primarySociety, activeSocieties]
    );

    // Filter societies based on search input
    const filteredSocieties = useMemo(() => {
        if (!searchQuery.trim()) return activeSocieties;
        const q = searchQuery.toLowerCase().trim();
        return activeSocieties.filter(s =>
            s.name.toLowerCase().includes(q) ||
            s.city.toLowerCase().includes(q) ||
            s.province.toLowerCase().includes(q) ||
            s.provinceCode.toLowerCase().includes(q) ||
            s.societyCode.toLowerCase().includes(q) ||
            s.shortName.toLowerCase().includes(q)
        );
    }, [searchQuery, activeSocieties]);

    // Group filtered societies by province
    const groupedByProvince = useMemo(() => {
        const map = new Map<string, Society[]>();
        filteredSocieties.forEach(s => {
            const list = map.get(s.province) || [];
            list.push(s);
            map.set(s.province, list);
        });
        return Array.from(map.entries()).sort((a, b) => {
            if (a[0] === 'Ontario') return -1;
            if (b[0] === 'Ontario') return 1;
            return a[0].localeCompare(b[0]);
        });
    }, [filteredSocieties]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectSociety = (soc: Society) => {
        setSelectedId(soc.id);
        setIsDropdownOpen(false);
        setSearchQuery('');
    };

    const handleEnterPortal = () => {
        onSelectSociety(activeSociety);
    };

    return (
        <div className="relative min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-8">
            {/* Ambient Background Glow */}
            <div className="pointer-events-none absolute inset-0 opacity-40 bg-[radial-gradient(1200px_600px_at_-10%_-10%,rgba(99,102,241,0.25),transparent_60%),radial-gradient(800px_400px_at_120%_110%,rgba(236,72,153,0.18),transparent_55%)]" />

            <div className="relative w-full max-w-xl z-10 my-auto">
                {/* Modern Glass Card */}
                <div className="backdrop-blur-xl bg-slate-900/90 border border-white/10 rounded-3xl shadow-2xl overflow-visible p-6 sm:p-8 md:p-10">
                    
                    {/* Header */}
                    <div className="text-center mb-6">
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-400/30 text-indigo-300 text-xs font-semibold tracking-wider uppercase mb-3">
                            <span>🇨🇦</span> Canada Mission • The Methodist Church Ghana
                        </div>
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                            Canada Mission Management System
                        </h1>
                        <p className="text-xs sm:text-sm text-indigo-200/80 mt-1.5">
                            Search or select your society to access local church records and administration.
                        </p>
                    </div>

                    {/* Interactive Searchable Combobox */}
                    <div className="space-y-5">
                        <div ref={dropdownRef} className="relative">
                            <label className="block text-xs font-bold uppercase tracking-wider text-indigo-200 mb-2 flex items-center justify-between">
                                <span>Search & Select Society</span>
                                <span className="text-[11px] text-indigo-300/80 font-normal">
                                    {filteredSocieties.length} of {activeSocieties.length} societies
                                </span>
                            </label>

                            {/* Search Input Bar */}
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-indigo-400">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onFocus={() => setIsDropdownOpen(true)}
                                    onChange={e => {
                                        setSearchQuery(e.target.value);
                                        setIsDropdownOpen(true);
                                    }}
                                    placeholder="Type to search (e.g. Toronto, Hamilton, Wesley, Calgary)..."
                                    className="w-full bg-slate-950/95 border-2 border-indigo-400/40 hover:border-indigo-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/20 rounded-2xl pl-11 pr-20 py-3.5 text-sm sm:text-base font-semibold text-white shadow-inner placeholder-slate-400 outline-none transition-all"
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 gap-1">
                                    {searchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setSearchQuery('')}
                                            className="text-xs text-slate-400 hover:text-white px-1.5 py-1 rounded bg-slate-800/80"
                                            title="Clear search"
                                        >
                                            ✕
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                        className="text-indigo-300 hover:text-white p-1 text-base focus:outline-none"
                                        title="Toggle list"
                                    >
                                        {isDropdownOpen ? '▴' : '▾'}
                                    </button>
                                </div>
                            </div>

                            {/* Dropdown Menu Popup */}
                            {isDropdownOpen && (
                                <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-slate-950/95 border border-indigo-400/30 rounded-2xl shadow-2xl max-h-72 overflow-y-auto backdrop-blur-xl divide-y divide-white/5">
                                    {groupedByProvince.length > 0 ? (
                                        groupedByProvince.map(([prov, socs]) => (
                                            <div key={prov} className="p-2">
                                                <div className="px-3 py-1 text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
                                                    📍 {prov}
                                                </div>
                                                {socs.map(s => {
                                                    const isSelected = s.id === selectedId;
                                                    return (
                                                        <div
                                                            key={s.id}
                                                            onMouseDown={(e) => {
                                                                e.preventDefault();
                                                                handleSelectSociety(s);
                                                            }}
                                                            className={`px-3 py-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between ${
                                                                isSelected
                                                                    ? 'bg-indigo-600 text-white font-bold'
                                                                    : 'hover:bg-slate-800/80 text-slate-200'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-2.5 min-w-0">
                                                                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                                                    isSelected ? 'bg-indigo-800 text-white' : 'bg-slate-800 text-indigo-300 border border-white/5'
                                                                }`}>
                                                                    {s.provinceCode}
                                                                </span>
                                                                <div className="truncate">
                                                                    <div className="text-sm truncate">
                                                                        {s.name} {s.isPrimary && '⭐'}
                                                                    </div>
                                                                    <div className={`text-xs ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                                                                        {s.city}, {s.province} • [{s.societyCode}]
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            {isSelected && <span className="text-xs shrink-0">✓ Selected</span>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-6 text-center text-sm text-slate-400">
                                            No society matches "{searchQuery}".
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Selected Society Card Preview */}
                        <div className="bg-gradient-to-r from-indigo-950/70 via-purple-950/50 to-slate-950/80 border border-indigo-500/30 rounded-2xl p-4 sm:p-5 shadow-lg">
                            <div className="flex items-start gap-4">
                                <div className="h-12 w-12 rounded-xl bg-indigo-600/80 border border-indigo-400/40 flex items-center justify-center text-white shrink-0 shadow-md">
                                    {logoUrl ? <img src={logoUrl} alt="Canada Mission logo" className="h-10 w-10 object-contain bg-white rounded-lg p-1" /> : <ChurchIcon />}
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
