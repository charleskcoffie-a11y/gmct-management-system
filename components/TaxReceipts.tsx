// components/TaxReceipts.tsx
import React, { useMemo, useState } from 'react';
import type { Entry, HarvestEntry, Member, Settings, Society } from '../types';
import { formatCurrency, sanitizeEntryType } from '../utils';

interface TaxReceiptsProps {
    entries: Entry[];
    harvestEntries: HarvestEntry[];
    members: Member[];
    settings: Settings;
    selectedSociety?: Society;
}

interface MemberTotals {
    memberId: string;
    memberName: string;
    memberNumber?: string;
    classNumber?: string;
    total: number;
    entries: Entry[];
    serial: string;
    quarterlyBreakdown: Record<string, number>;
    categoriesBreakdown: Record<string, number>;
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

const TaxReceipts: React.FC<TaxReceiptsProps> = ({ entries, harvestEntries, members, settings, selectedSociety }) => {
    const currentYear = new Date().getFullYear().toString();
    const [year, setYear] = useState(currentYear);
    const [selectedClass, setSelectedClass] = useState<string>('all');
    const [minAmount, setMinAmount] = useState<number>(20);

    // Society-specific charity configuration
    const [societyCharityNumber, setSocietyCharityNumber] = useState<string>(
        selectedSociety?.charityNumber || (selectedSociety?.isPrimary ? settings.charityNumber || '873990964RP0001' : '')
    );
    const [societySignature, setSocietySignature] = useState<string>(
        selectedSociety?.signatureImage || (selectedSociety?.isPrimary ? settings.signatureImage || '' : '')
    );
    const [isConfigOpen, setIsConfigOpen] = useState(false);

    const classOptions = useMemo(() => ['all', ...Array.from({ length: settings.maxClasses }, (_, i) => String(i + 1))], [settings.maxClasses]);

    const combinedEntries = useMemo(() => {
        const safeEntries = Array.isArray(entries) ? entries : [];
        const safeHarvestEntries = Array.isArray(harvestEntries) ? harvestEntries : [];

        const harvestAsEntries: Entry[] = safeHarvestEntries.map(h => ({
            id: h?.id || '',
            date: typeof h?.date === 'string' ? h.date : '',
            memberID: h?.memberID || '',
            memberName: h?.memberName || 'Unknown Member',
            classNumber: h?.classNumber || '',
            type: 'harvest-levy',
            fund: 'harvest levy',
            method: 'other',
            amount: Number(h?.amount) || 0,
            note: h?.note || '',
            createdAt: h?.createdAt || '',
            deleted: !!h?.deleted,
        }));

        return [...safeEntries, ...harvestAsEntries]
            .filter((e): e is Entry => !!e && typeof e === 'object' && typeof e.date === 'string' && e.date.length >= 8)
            .filter(e => !e.deleted)
            .map(e => ({ ...e, type: sanitizeEntryType(e.type) }));
    }, [entries, harvestEntries]);

    const availableYears = useMemo(() => {
        const years = new Set<string>();
        combinedEntries.forEach(e => {
            if (typeof e?.date === 'string' && e.date.length >= 4) {
                years.add(e.date.substring(0, 4));
            }
        });
        if (!years.has(currentYear)) years.add(currentYear);
        return Array.from(years).sort((a, b) => b.localeCompare(a));
    }, [combinedEntries, currentYear]);

    const yearRangeLabel = useMemo(() => `${year}-01-01 to ${year}-12-31`, [year]);

    const membersById = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);

    const filteredTotals = useMemo<MemberTotals[]>(() => {
        const totals = new Map<string, MemberTotals>();

        for (const e of combinedEntries) {
            if (!e?.date || typeof e.date !== 'string' || !e.date.startsWith(year)) continue;
            const memberId = e.memberID || '';
            if (!memberId) continue;

            const member = membersById.get(memberId);
            const classNumber = member?.classNumber || e.classNumber;
            if (selectedClass !== 'all' && classNumber !== selectedClass) continue;

            const existing = totals.get(memberId) || {
                memberId,
                memberName: member?.name || e.memberName || 'Unknown Member',
                memberNumber: member?.memberNumber,
                classNumber,
                total: 0,
                entries: [],
                serial: makeSerial(memberId, year),
                quarterlyBreakdown: { 'Jan-Mar': 0, 'Apr-Jun': 0, 'Jul-Sep': 0, 'Oct-Dec': 0 },
                categoriesBreakdown: {},
            };

            existing.total += e.amount;
            existing.entries.push(e);

            // Quarterly breakdown
            const month = parseInt(e.date.substring(5, 7), 10);
            if (month >= 1 && month <= 3) existing.quarterlyBreakdown['Jan-Mar'] += e.amount;
            else if (month >= 4 && month <= 6) existing.quarterlyBreakdown['Apr-Jun'] += e.amount;
            else if (month >= 7 && month <= 9) existing.quarterlyBreakdown['Jul-Sep'] += e.amount;
            else if (month >= 10 && month <= 12) existing.quarterlyBreakdown['Oct-Dec'] += e.amount;

            // Category breakdown
            const categoryKey = e.type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            existing.categoriesBreakdown[categoryKey] = (existing.categoriesBreakdown[categoryKey] || 0) + e.amount;

            totals.set(memberId, existing);
        }

        return Array.from(totals.values())
            .filter(t => t.total >= minAmount)
            .sort((a, b) => {
                if (a.classNumber && b.classNumber && a.classNumber !== b.classNumber) return a.classNumber.localeCompare(b.classNumber);
                return a.memberName.localeCompare(b.memberName);
            });
    }, [combinedEntries, membersById, minAmount, selectedClass, year]);

    const handlePrint = () => window.print();

    const orgName = selectedSociety?.name || settings.orgName || 'Ghana Methodist Church of Toronto';
    const orgAddress = selectedSociety?.address || settings.orgAddress || '69 Milvan Drive, Toronto, ON M9L 1Y8, Canada';
    const orgPhone = selectedSociety?.phone || settings.orgPhone || '416-901-5900';
    const orgEmail = selectedSociety?.email || settings.orgEmail || '';
    const orgWebsite = 'https://gmct-ca.org/';
    const charityNumber = societyCharityNumber || selectedSociety?.charityNumber || (selectedSociety?.isPrimary ? settings.charityNumber || '873990964RP0001' : 'Registration Pending');
    const signatureImage = societySignature || (selectedSociety?.isPrimary ? settings.signatureImage : undefined);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap justify-between gap-4 items-end no-print">
                <div>
                    <h2 className="text-3xl font-extrabold text-slate-900">Annual Tax Receipts</h2>
                    <p className="text-slate-600">
                        Generate CRA/charity receipts for {orgName} (≥ ${minAmount.toFixed(0)}) for {year}.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setIsConfigOpen(!isConfigOpen)}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white font-semibold rounded-lg shadow text-sm"
                    >
                        ⚙️ Receipt Details
                    </button>
                    <button onClick={handlePrint} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow">Print / Save PDF</button>
                </div>
            </div>

            {/* Society Tax Receipt Configuration Box */}
            {isConfigOpen && (
                <div className="bg-indigo-50 border-2 border-indigo-200 p-4 rounded-xl shadow-sm no-print space-y-3">
                    <h3 className="font-bold text-indigo-900 text-sm">Society Receipt Setup: {orgName}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">CRA / Charity Registration #</label>
                            <input
                                type="text"
                                value={societyCharityNumber}
                                onChange={e => setSocietyCharityNumber(e.target.value)}
                                placeholder="e.g. 123456789RR0001"
                                className="w-full border-slate-300 rounded-lg shadow-sm text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Authorized Signature (Image upload)</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onload = () => setSocietySignature(reader.result as string);
                                        reader.readAsDataURL(file);
                                    }
                                }}
                                className="w-full text-xs text-slate-600"
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-xl shadow border border-slate-200 no-print">
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
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-500 no-print">
                    No members meet the criteria for {year}. Adjust filters or threshold.
                </div>
            ) : (
                <div className="space-y-4 print-receipts">
                    {filteredTotals.map(member => {
                        const m = membersById.get(member.memberId);
                        const memberAddress = m?.address || '';
                        const hasOfficialAddress = Boolean(memberAddress && memberAddress.trim().length > 0);
                        const categoriesEntries = Object.entries(member.categoriesBreakdown).sort((a, b) => b[1] - a[1]);
                        const issueDate = new Date().toISOString().split('T')[0];
                        
                        // Reusable summary section component
                        const SummarySection = ({ copyLabel }: { copyLabel: string }) => (
                            <div className="p-2">
                                <div className="text-center mb-2 pb-1 border-b border-slate-300">
                                    <h2 className="text-sm font-extrabold text-slate-900">OFFICIAL RECEIPT FOR INCOME TAX PURPOSES</h2>
                                    <p className="text-[9px] text-slate-600">Receipt No: {member.serial} | Tax Year: {year}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-2 mb-2 text-[10px]">
                                    {/* Charity Info */}
                                    <div>
                                        <div className="font-bold text-[9px] uppercase text-slate-500 mb-0.5">Charity</div>
                                        <div className="text-[10px]">
                                            <p className="font-bold text-slate-900 text-sm">{orgName}</p>
                                            <p className="text-slate-700">{orgAddress}</p>
                                            <p className="text-slate-600">Phone: {orgPhone}</p>
                                            <p className="font-mono font-bold text-slate-800">BN: {charityNumber}</p>
                                        </div>
                                    </div>

                                    {/* Donor Info with Barcode */}
                                    <div>
                                        <div className="font-bold text-[9px] uppercase text-slate-500 mb-0.5">Donor</div>
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="text-[10px] flex-1">
                                                <p className="font-bold text-slate-900">{member.memberName.toUpperCase()}</p>
                                                <p className="text-slate-600">ID: {member.memberNumber || member.memberId.substring(0, 8)}</p>
                                                <p className={`text-[10px] ${hasOfficialAddress ? 'text-slate-700' : 'text-red-700 font-bold'}`}>
                                                    {hasOfficialAddress ? memberAddress : 'No official address on file — receipt is not official'}
                                                </p>
                                                <p className="text-slate-600">Issue Date: {issueDate}</p>
                                            </div>
                                            <div className="flex-shrink-0">
                                                <Barcode serial={member.serial} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Signature and Total Amount */}
                                <div className="mt-2 flex justify-between items-center">
                                    <div className="text-[9px]">
                                        {signatureImage ? (
                                            <img src={signatureImage} alt="Signature" className="h-8 object-contain mb-1" />
                                        ) : (
                                            <div className="h-8 flex items-end font-script italic text-slate-500">Authorized Officer</div>
                                        )}
                                        <div className="font-bold text-slate-900">
                                            {selectedSociety?.isPrimary ? 'Peggy Asary, Treasurer' : `${orgName} Authorized Officer`}
                                        </div>
                                    </div>
                                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-400 rounded p-2 text-center">
                                        <div className="text-[9px] text-slate-600 uppercase font-bold">Total Eligible Amount</div>
                                        <div className="text-2xl font-extrabold text-green-700">{formatCurrency(member.total, settings.currency || 'CAD')}</div>
                                        <div className="text-[9px] text-slate-600">{settings.currency || 'CAD'}</div>
                                    </div>
                                </div>
                            </div>
                        );
                        
                        return (
                        <div key={member.memberId} className={`bg-white rounded-lg shadow-lg border-2 p-2 receipt-card ${hasOfficialAddress ? 'border-slate-300' : 'border-red-300 bg-red-50/40'}`}>
                            {!hasOfficialAddress && (
                                <div className="mb-2 rounded border border-red-300 bg-red-50 text-red-700 text-[9px] font-extrabold uppercase tracking-wide px-2 py-1 text-center">
                                    NOTE: NOT OFFICIAL — Missing donor address. Update member profile with the official mailing address before issuing this receipt.
                                </div>
                            )}
                            {!hasOfficialAddress && (
                                <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-30 print:opacity-100">
                                    <span className="transform rotate-45 border-2 border-red-500 px-8 py-2 text-[28px] font-black uppercase tracking-[0.25em] text-red-500/90">
                                        Not Official
                                    </span>
                                </div>
                            )}
                            {/* SECTION 1 - CRA Copy */}
                            <SummarySection copyLabel="CRA Copy - Official Tax Receipt" />
                            
                            {/* Dotted Line Separator */}
                            <div className="border-t-2 border-dashed border-slate-400 my-2 relative">
                                <div className="absolute left-0 right-0 -top-2 text-center">
                                    <span className="bg-white px-2 text-[8px] text-slate-500">✂ Cut Here</span>
                                </div>
                            </div>

                            {/* SECTION 2 - Donor Copy */}
                            <SummarySection copyLabel="Donor Copy - Official Tax Receipt" />
                            
                            {/* Dotted Line Separator */}
                            <div className="border-t-2 border-dashed border-slate-400 my-2 relative">
                                <div className="absolute left-0 right-0 -top-2 text-center">
                                    <span className="bg-white px-2 text-[8px] text-slate-500">✂ Cut Here</span>
                                </div>
                            </div>

                            {/* SECTION 3 - Detailed Breakdown */}
                            <div className="p-2">
                                <div className="text-center mb-2 pb-1 border-b border-slate-300">
                                    <div className="bg-indigo-700 text-white font-bold text-[9px] uppercase tracking-widest py-0.5 px-2 inline-block rounded mb-0.5">
                                        Detailed Breakdown
                                    </div>
                                    <p className="text-[10px] text-slate-700">For: {member.memberName} | Receipt No: {member.serial}</p>
                                </div>

                                {/* Donation Categories Table */}
                                <div className="mb-2">
                                    <div className="text-[9px] uppercase text-slate-500 font-bold mb-1">Donation Categories</div>
                                    <div className="bg-white rounded border border-slate-300 overflow-hidden">
                                        <table className="w-full text-[10px]">
                                            <thead>
                                                <tr className="bg-slate-700 text-white">
                                                    <th className="text-left px-2 py-1 font-bold border-r border-slate-600">#</th>
                                                    <th className="text-left px-2 py-1 font-bold border-r border-slate-600">Category</th>
                                                    <th className="text-right px-2 py-1 font-bold">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {categoriesEntries.map(([category, total], index) => (
                                                    <tr key={category} className={index % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                                                        <td className="px-2 py-1 border-r border-slate-200 text-slate-600">{index + 1}</td>
                                                        <td className="px-2 py-1 border-r border-slate-200 text-slate-800">{category}</td>
                                                        <td className="px-2 py-1 text-right font-bold text-slate-900">{formatCurrency(total, settings.currency || 'CAD')}</td>
                                                    </tr>
                                                ))}
                                                <tr className="bg-green-100 border-t-2 border-green-400">
                                                    <td colSpan={2} className="px-2 py-1 font-bold text-slate-900 border-r border-green-300">TOTAL</td>
                                                    <td className="px-2 py-1 text-right font-extrabold text-green-800">{formatCurrency(member.total, settings.currency || 'CAD')}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="mt-2 text-center text-[8px] text-slate-400">
                                    <span>Auto-generated: {new Date().toISOString()}</span>
                                </div>
                            </div>
                        </div>
                        );
                    })}
                </div>
            )}

            <style>
                {`@media print {
                    @page {
                        size: letter;
                        margin: 0.3in 0.4in;
                    }
                    
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    
                    html, body {
                        background: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        height: auto !important;
                        overflow: visible !important;
                    }
                    
                    /* Hide app header, navigation, and all controls */
                    header, nav, .header, .navigation, .navbar, .sidebar,
                    .no-print, button, select, input, label {
                        display: none !important;
                        visibility: hidden !important;
                    }
                    
                    /* Hide everything except receipts */
                    body > *:not(.print-receipts):not(style) {
                        display: none !important;
                    }
                    
                    /* Show only receipts container */
                    .print-receipts, .print-receipts * {
                        display: block !important;
                        visibility: visible !important;
                    }
                    
                    /* Force one receipt per page with tight fit */
                    .receipt-card {
                        position: relative !important;
                        page-break-after: always !important;
                        break-after: page !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        page-break-before: auto !important;
                        margin: 0 !important;
                        padding: 0.25in !important;
                        box-shadow: none !important;
                        border: 1px solid #cbd5e1 !important;
                        max-height: 10in !important;
                        overflow: hidden !important;
                        transform: scale(0.95);
                        transform-origin: top left;
                    }

                    .receipt-card .absolute {
                        position: absolute !important;
                    }

                    .receipt-card .pointer-events-none {
                        pointer-events: none !important;
                    }

                    .receipt-card .opacity-30 {
                        opacity: 0.30 !important;
                    }

                    .receipt-card .print\:opacity-100 {
                        opacity: 1 !important;
                    }
                    
                    .receipt-card:first-child {
                        page-break-before: avoid !important;
                    }
                    
                    .receipt-card:last-child {
                        page-break-after: auto !important;
                        break-after: auto !important;
                    }
                    
                    /* Remove all spacing between receipts */
                    .space-y-4, .space-y-6 {
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    
                    .space-y-4 > *, .space-y-6 > * {
                        margin: 0 !important;
                    }
                    
                    /* Ensure compact layout for print */
                    .receipt-card * {
                        max-width: 100% !important;
                    }
                    
                    /* Make table text smaller if needed */
                    table {
                        font-size: 10px !important;
                    }
                }`}
            </style>
        </div>
    );
};

export default TaxReceipts;
