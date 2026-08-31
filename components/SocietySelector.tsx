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
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProvince, setSelectedProvince] = useState<string>('all');

    // Extract unique provinces for filtering
    const provinces = useMemo(() => {
        const unique = Array.from(new Set(CANADA_MISSION_SOCIETIES.map(s => s.province)));
        return ['all', ...unique];
    }, []);

    // Filtered societies
    const filteredSocieties = useMemo(() => {
        return CANADA_MISSION_SOCIETIES.filter(society => {
            const matchesSearch =
                society.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                society.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
                society.province.toLowerCase().includes(searchQuery.toLowerCase()) ||
                society.societyCode.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesProvince = selectedProvince === 'all' || society.province === selectedProvince;

            return matchesSearch && matchesProvince;
        });
    }, [searchQuery, selectedProvince]);

    const primarySociety = CANADA_MISSION_SOCIETIES.find(s => s.isPrimary) || CANADA_MISSION_SOCIETIES[0];
    const otherSocieties = filteredSocieties.filter(s => !s.isPrimary);

    return (
        <div className="relative min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-6 md:p-8 selection:bg-indigo-500 selection:text-white">
            {/* Ambient Background Lights */}
            <div className="pointer-events-none absolute inset-0 opacity-40 bg-[radial-gradient(1200px_600px_at_-10%_-10%,rgba(99,102,241,0.25),transparent_60%),radial-gradient(800px_400px_at_120%_110%,rgba(236,72,153,0.18),transparent_55%)]" />

            <div className="relative max-w-7xl mx-auto w-full z-10 my-auto">
                {/* Header Section */}
                <div className="text-center max-w-3xl mx-auto mb-8 pt-4">
                    <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-400/30 text-indigo-300 text-xs sm:text-sm font-semibold tracking-wide uppercase shadow-inner mb-4">
                        <span className="text-base">🇨🇦</span> Canada Mission — The Methodist Church Ghana
                    </div>
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white drop-shadow-md">
                        Societies Management Portal
                    </h1>
                    <p className="mt-3 text-sm sm:text-base text-indigo-100/80">
                        Select your local society or parish to access administrative, member, and financial services.
                    </p>

                    {/* Search and Province Filters */}
                    <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                        <div className="relative w-full sm:w-80">
                            <input
                                type="text"
                                placeholder="Search by society or city..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-900/80 border border-white/20 rounded-xl px-4 py-2.5 pl-10 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent shadow-lg backdrop-blur-md"
                            />
                            <svg
                                className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-3 text-xs text-slate-400 hover:text-white"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {/* Province filter pills */}
                        <div className="flex flex-wrap items-center justify-center gap-1.5 w-full sm:w-auto">
                            {provinces.map(prov => (
                                <button
                                    key={prov}
                                    type="button"
                                    onClick={() => setSelectedProvince(prov)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${
                                        selectedProvince === prov
                                            ? 'bg-indigo-600 text-white shadow-indigo-500/30'
                                            : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800 border border-white/10'
                                    }`}
                                >
                                    {prov === 'all' ? 'All Provinces' : prov}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Primary Society Highlight (GMCT) */}
                {(!searchQuery || primarySociety.name.toLowerCase().includes(searchQuery.toLowerCase()) || primarySociety.city.toLowerCase().includes(searchQuery.toLowerCase())) && (
                    <div className="mb-6">
                        <div
                            onClick={() => onSelectSociety(primarySociety)}
                            className="group relative cursor-pointer overflow-hidden rounded-2xl border-2 border-indigo-400/50 bg-gradient-to-r from-indigo-900/60 via-purple-900/40 to-slate-900/80 p-5 sm:p-6 shadow-2xl backdrop-blur-lg transition-all duration-300 hover:scale-[1.01] hover:border-indigo-300 hover:shadow-indigo-500/20"
                        >
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg ring-4 ring-indigo-400/30">
                                        <ChurchIcon />
                                    </div>
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="text-xl sm:text-2xl font-black text-white group-hover:text-indigo-200 transition-colors">
                                                {primarySociety.name}
                                            </h2>
                                            <span className="rounded-full bg-amber-400/20 border border-amber-400/40 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
                                                ⭐ Primary Society & Head
                                            </span>
                                        </div>
                                        <p className="text-xs sm:text-sm text-indigo-200/90 mt-1">
                                            {primarySociety.city}, {primarySociety.province} • {primarySociety.address}
                                        </p>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            <span className="text-[11px] font-semibold text-indigo-300 bg-indigo-950/60 px-2.5 py-0.5 rounded-md border border-indigo-500/30">
                                                Full Suite (Wesley Hall, Parking, E-Transfers, Harvest, Requisitions)
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    className="self-stretch md:self-center shrink-0 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
                                >
                                    <span>Access GMCT Portal</span>
                                    <span>→</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Grid of Other Mission Societies */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {otherSocieties.map(society => (
                        <div
                            key={society.id}
                            onClick={() => onSelectSociety(society)}
                            className="group relative cursor-pointer rounded-xl border border-white/10 bg-slate-900/60 p-4 sm:p-5 shadow-lg backdrop-blur-md transition-all duration-200 hover:-translate-y-1 hover:border-indigo-400/50 hover:bg-slate-900/90 hover:shadow-xl hover:shadow-indigo-950/40"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 border border-white/10 text-indigo-300 font-bold text-xs group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                        {society.provinceCode}
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                                            {society.name}
                                        </h3>
                                        <p className="text-xs text-slate-400">
                                            {society.city}, {society.province}
                                        </p>
                                    </div>
                                </div>
                                <span className="text-xs text-indigo-400 group-hover:translate-x-1 transition-transform">
                                    →
                                </span>
                            </div>

                            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
                                <span className="font-mono text-[11px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-white/5">
                                    {society.societyCode}
                                </span>
                                <span className="text-[11px] text-indigo-300 group-hover:text-indigo-200">
                                    Enter Portal
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {filteredSocieties.length === 0 && (
                    <div className="text-center py-12 bg-slate-900/40 rounded-2xl border border-white/5">
                        <p className="text-slate-400 text-sm">No society matches "{searchQuery}".</p>
                        <button
                            type="button"
                            onClick={() => {
                                setSearchQuery('');
                                setSelectedProvince('all');
                            }}
                            className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 underline"
                        >
                            Reset filters
                        </button>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-slate-400 pt-6 z-10">
                Canada Mission Management System • The Methodist Church Ghana • 13 Active Societies
            </div>
        </div>
    );
};

export default SocietySelector;
