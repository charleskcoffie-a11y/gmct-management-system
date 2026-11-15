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
        <main className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 px-5 py-10 text-slate-100 flex items-center justify-center">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/95 p-7 shadow-2xl sm:p-8">
                <header className="mb-7">
                    <p className="text-xs font-semibold uppercase tracking-widest text-indigo-300">The Methodist Church Ghana</p>
                    <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Canada Mission</h1>
                    <p className="mt-2 text-sm text-slate-400">Choose your society to sign in.</p>
                </header>

                <div ref={dropdownRef} className="relative">
                    <label htmlFor="society-search" className="mb-2 block text-sm font-medium text-slate-200">Society</label>
                    <div className="relative">
                        <input id="society-search" type="search" value={searchQuery} autoComplete="off"
                            onFocus={() => setIsDropdownOpen(true)}
                            onChange={event => { setSearchQuery(event.target.value); setIsDropdownOpen(true); }}
                            onKeyDown={event => {
                                if (event.key === 'Escape') setIsDropdownOpen(false);
                                if (event.key === 'Enter' && filteredSocieties.length === 1) { event.preventDefault(); handleSelectSociety(filteredSocieties[0]); }
                            }}
                            placeholder="Search name or city"
                            className="w-full rounded-xl border border-slate-600 bg-slate-950 py-3.5 pl-4 pr-12 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20" />
                        <button type="button" aria-label={isDropdownOpen ? 'Close society list' : 'Show societies'} aria-expanded={isDropdownOpen}
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-indigo-300 hover:text-white">{isDropdownOpen ? '▴' : '▾'}</button>
                    </div>
                    {isDropdownOpen && <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-64 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-2 shadow-2xl">
                        {groupedByProvince.map(([province, list]) => <div key={province}>
                            <p className="px-3 pb-1 pt-3 text-xs font-semibold text-slate-500">{province}</p>
                            {list.map(society => <button key={society.id} type="button" onClick={() => handleSelectSociety(society)}
                                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left ${society.id === selectedId ? 'bg-indigo-600 text-white' : 'text-slate-200 hover:bg-slate-800'}`}>
                                <span><span className="block text-sm font-medium">{society.name}</span><span className="mt-0.5 block text-xs opacity-70">{society.city}</span></span>
                                {society.id === selectedId && <span aria-label="Selected">✓</span>}
                            </button>)}
                        </div>)}
                        {filteredSocieties.length === 0 && <p className="p-4 text-sm text-slate-400">No society matches your search.</p>}
                    </div>}
                </div>

                {activeSociety ? <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-700/70 bg-slate-800/40 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 p-2 text-indigo-300"><ChurchIcon /></div>
                    <div className="min-w-0"><h2 className="text-base font-semibold text-white">{activeSociety.name}</h2><p className="mt-1 text-xs text-slate-400">{[activeSociety.city, activeSociety.province].filter(Boolean).join(', ')}</p></div>
                </div> : <p className="mt-4 text-sm text-slate-400">No societies are available yet.</p>}

                <button type="button" disabled={!activeSociety} onClick={() => activeSociety && handleEnterPortal()}
                    className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl bg-indigo-500 px-5 py-3.5 text-sm font-bold text-white transition-colors hover:bg-indigo-400 disabled:opacity-50">
                    Continue <span aria-hidden="true">→</span>
                </button>
            </div>
        </main>
    );
};

export default SocietySelector;
