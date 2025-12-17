// components/TaxReceipts.tsx
import React, { useMemo, useState } from 'react';
import type { Entry, HarvestEntry, Member, Settings } from '../types';
import { formatCurrency, sanitizeEntryType } from '../utils';

interface TaxReceiptsProps {
    entries: Entry[];
    harvestEntries: HarvestEntry[];
    members: Member[];
    settings: Settings;
}

interface MemberTotals {
    memberId: string;
    memberName: string;
    classNumber?: string;
    total: number;
    entries: Entry[];
    serial: string;
}

const hashString = (value: string) => {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = (hash << 5) - hash + value.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
};

const makeSerial = (memberId: string, year: string) => {
    const base = `${year}-${memberId}`;
    const hash = hashString(base).toString().padStart(8, '0');
    return `${year}-${memberId.slice(0, 4).toUpperCase()}-${hash.slice(-4)}`;
};

const Barcode: React.FC<{ serial: string }> = ({ serial }) => {
    const bars = useMemo(() => {
        const seed = serial + '-barcode';
        const codes = Array.from(seed).map(ch => ch.charCodeAt(0));
        return codes.map((code, idx) => ({
            width: 2 + (code % 4),
            height: 30 + (code % 20),
            odd: idx % 2 === 0,
        }));
    }, [serial]);

    let x = 0;
    const elements = bars.map((bar, idx) => {
        const rect = (
            <rect
                key={idx}
                x={x}
                y={50 - bar.height}
                width={bar.width}
                height={bar.height}
                fill={bar.odd ? '#111827' : '#4b5563'}
            />
        );
        x += bar.width + 1;
        return rect;
    });

    return (
        <svg width={x} height={60} aria-label={`Barcode ${serial}`} className="mt-2">
            {elements}
            <text x={x / 2} y={58} textAnchor="middle" fontSize="8" fill="#374151" fontFamily="monospace">{serial}</text>
        </svg>
    );
};

const TaxReceipts: React.FC<TaxReceiptsProps> = ({ entries, harvestEntries, members, settings }) => {
    const currentYear = new Date().getFullYear().toString();
    const [year, setYear] = useState(currentYear);
    const [selectedClass, setSelectedClass] = useState<string>('all');
    const [minAmount, setMinAmount] = useState<number>(20);

    const classOptions = useMemo(() => ['all', ...Array.from({ length: settings.maxClasses }, (_, i) => String(i + 1))], [settings.maxClasses]);

    const combinedEntries = useMemo(() => {
        const harvestAsEntries: Entry[] = harvestEntries.map(h => ({
            id: h.id,
            date: h.date,
            memberID: h.memberID,
            memberName: h.memberName,
            classNumber: h.classNumber,
            type: 'harvest-levy',
            fund: 'harvest levy',
            method: 'other',
            amount: h.amount,
            note: h.note,
            createdAt: h.createdAt,
            deleted: h.deleted,
        }));

        return [...entries, ...harvestAsEntries]
            .filter(e => !e.deleted)
            .map(e => ({ ...e, type: sanitizeEntryType(e.type) }));
    }, [entries, harvestEntries]);

    const availableYears = useMemo(() => {
        const years = new Set<string>();
        combinedEntries.forEach(e => {
            if (e.date) years.add(e.date.substring(0, 4));
        });
        if (!years.has(currentYear)) years.add(currentYear);
        return Array.from(years).sort((a, b) => b.localeCompare(a));
    }, [combinedEntries, currentYear]);

    const yearRangeLabel = useMemo(() => `${year}-01-01 to ${year}-12-31`, [year]);

    const membersById = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);

    const filteredTotals = useMemo<MemberTotals[]>(() => {
        const totals = new Map<string, MemberTotals>();

        for (const e of combinedEntries) {
            if (!e.date.startsWith(year)) continue;
            const member = membersById.get(e.memberID);
            const classNumber = member?.classNumber || e.classNumber;
            if (selectedClass !== 'all' && classNumber !== selectedClass) continue;

            const existing = totals.get(e.memberID) || {
                memberId: e.memberID,
                memberName: member?.name || e.memberName || 'Unknown Member',
                classNumber,
                total: 0,
                entries: [],
                serial: makeSerial(e.memberID, year),
            };

            existing.total += e.amount;
            existing.entries.push(e);
            totals.set(e.memberID, existing);
        }

        return Array.from(totals.values())
            .filter(t => t.total >= minAmount)
            .sort((a, b) => {
                if (a.classNumber && b.classNumber && a.classNumber !== b.classNumber) return a.classNumber.localeCompare(b.classNumber);
                return a.memberName.localeCompare(b.memberName);
            });
    }, [combinedEntries, membersById, minAmount, selectedClass, year]);

    const handlePrint = () => window.print();

    const orgName = settings.orgName || 'Church / Organization Name';
    const orgAddress = settings.orgAddress || 'Address';
    const orgPhone = settings.orgPhone || '';
    const orgEmail = settings.orgEmail || '';
    const charityNumber = settings.charityNumber || '';

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap justify-between gap-4 items-end">
                <div>
                    <h2 className="text-3xl font-extrabold text-slate-900">Annual Tax Receipts</h2>
                    <p className="text-slate-600">Generate CRA/charity receipts per member (≥ ${minAmount.toFixed(0)}) for {year}.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handlePrint} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow">Print / Save PDF</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-xl shadow border border-slate-200">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Year</label>
                    <select value={year} onChange={e => setYear(e.target.value)} className="w-full border-slate-300 rounded-lg shadow-sm">
                        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Class</label>
                    <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="w-full border-slate-300 rounded-lg shadow-sm">
                        {classOptions.map(c => <option key={c} value={c}>{c === 'all' ? 'All Classes' : `Class ${c}`}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Min Amount</label>
                    <input type="number" value={minAmount} onChange={e => setMinAmount(Number(e.target.value) || 0)} className="w-full border-slate-300 rounded-lg shadow-sm" min={0} step={5} />
                </div>
                <div className="text-sm text-slate-600 flex items-end">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 w-full">
                        <div className="font-bold text-slate-800">Ready Receipts</div>
                        <div className="text-lg font-extrabold text-indigo-700">{filteredTotals.length}</div>
                        <div className="text-xs text-slate-500">Members meeting threshold</div>
                    </div>
                </div>
            </div>

            {filteredTotals.length === 0 ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-500">
                    No members meet the criteria for {year}. Adjust filters or threshold.
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredTotals.map(member => (
                        <div key={member.memberId} className="bg-white rounded-xl shadow border border-slate-200 p-5 receipt-card">
                            <div className="flex flex-wrap items-start gap-4 justify-between border-b border-slate-200 pb-4">
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold text-slate-700">{orgName}</p>
                                    <p className="text-sm text-slate-600">{orgAddress}</p>
                                    {(orgPhone || orgEmail) && (
                                        <p className="text-xs text-slate-500">{orgPhone}{orgPhone && orgEmail ? ' • ' : ''}{orgEmail}</p>
                                    )}
                                    {charityNumber && <p className="text-xs text-slate-500">Charity # {charityNumber}</p>}
                                </div>
                                {settings.logoUrl && (
                                    <img src={settings.logoUrl} alt="Organization Logo" className="h-12 object-contain" />
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-4">
                                <div>
                                    <div className="text-xs uppercase text-slate-500 font-bold">Issued To</div>
                                    <div className="text-lg font-bold text-slate-900">{member.memberName}</div>
                                    <div className="text-sm text-slate-600">Class {member.classNumber || 'N/A'}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs uppercase text-slate-500 font-bold">Serial / Barcode</div>
                                    <div className="font-mono text-sm text-slate-800">{member.serial}</div>
                                    <Barcode serial={member.serial} />
                                </div>
                            </div>

                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-wrap gap-4 justify-between items-center">
                                <div>
                                    <div className="text-xs uppercase text-slate-500 font-bold">Period</div>
                                    <div className="text-sm text-slate-800">{yearRangeLabel}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase text-slate-500 font-bold">Total Eligible Amount</div>
                                    <div className="text-2xl font-extrabold text-indigo-700">{formatCurrency(member.total, settings.currency)}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs uppercase text-slate-500 font-bold">Entries Count</div>
                                    <div className="text-lg font-semibold text-slate-800">{member.entries.length}</div>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-4 mt-4 border-t border-slate-200 pt-3">
                                <div className="text-xs text-slate-500">Receipt auto-generated. Valid only if total ≥ {formatCurrency(minAmount, settings.currency)}.</div>
                                <div className="flex items-center gap-3">
                                    {settings.signatureImage && (
                                        <div className="text-center">
                                            <img src={settings.signatureImage} alt="Authorized Signature" className="h-12 object-contain" />
                                            <div className="text-[10px] text-slate-500 mt-1">Authorized Signature</div>
                                        </div>
                                    )}
                                    <div className="text-right text-xs text-slate-600">
                                        <div>Issued on: {new Date().toLocaleDateString()}</div>
                                        <div>Prepared by: System</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <style>
                {`@media print {
                    body { background: white; }
                    .receipt-card { page-break-inside: avoid; }
                    button, select, input { display: none !important; }
                }`}
            </style>
        </div>
    );
};

export default TaxReceipts;
