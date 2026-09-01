// components/TaxReceipts.tsx
import React, { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import type { Entry, HarvestEntry, Member, Settings, Society, User } from '../types';
import { formatCurrency, sanitizeEntryType } from '../utils';

interface TaxReceiptsProps {
    entries: Entry[];
    harvestEntries: HarvestEntry[];
    members: Member[];
    settings: Settings;
    selectedSociety?: Society;
    currentUser: User;
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

    return (
        <div aria-label={`Barcode ${serial}`} className="mt-2">
            <div className="h-[50px] flex items-end gap-px" aria-hidden="true">
                {bars.map((bar, index) => <span key={index} style={{ width: `${bar.width}px`, height: `${bar.height}px`, backgroundColor: bar.odd ? '#111827' : '#4b5563' }} />)}
            </div>
            <div className="text-[8px] text-center text-slate-700 font-mono">{serial}</div>
        </div>
    );
};

const TaxReceipts: React.FC<TaxReceiptsProps> = ({ entries, harvestEntries, members, settings, selectedSociety, currentUser }) => {
    const currentYear = new Date().getFullYear().toString();
    const [year, setYear] = useState(currentYear);
    const [selectedClass, setSelectedClass] = useState<string>('all');
    const [minAmount, setMinAmount] = useState<number>(20);

    // Society-specific charity configuration
    const [receiptProfile, setReceiptProfile] = useState({ charityNumber: '', logoImage: '', ministerName: '', ministerSignature: '', treasurerName: '', treasurerSignature: '' });
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [profileMessage, setProfileMessage] = useState('');
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [excludedMemberIds, setExcludedMemberIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        setReceiptProfile({
            charityNumber: selectedSociety?.charityNumber || (selectedSociety?.isPrimary ? settings.charityNumber || '873990964RP0001' : ''),
            logoImage: selectedSociety?.logoUrl || (selectedSociety?.isPrimary ? settings.logoUrl || '' : ''),
            ministerName: selectedSociety?.isPrimary ? 'Minister in Charge' : '',
            ministerSignature: '',
            treasurerName: selectedSociety?.isPrimary ? 'Peggy Asary, Treasurer' : '',
            treasurerSignature: selectedSociety?.signatureImage || (selectedSociety?.isPrimary ? settings.signatureImage || '' : ''),
        });
    }, [selectedSociety, settings.charityNumber, settings.signatureImage]);

    useEffect(() => {
        if (!selectedSociety || selectedSociety.isPrimary || currentUser.role !== 'admin') return;
        const tenantSession = sessionStorage.getItem('gmct-tenant-session');
        if (!tenantSession) return;
        fetch(`${settings.supabaseUrl}/functions/v1/tenant-gateway/receipt-profile`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tenantSession}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ operation: 'load' }),
        }).then(async response => {
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unable to load receipt details.');
            if (result.profile) setReceiptProfile(result.profile);
        }).catch(error => setProfileMessage(error.message || 'Unable to load receipt details.'));
    }, [selectedSociety?.id, currentUser.role, settings.supabaseUrl]);

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

    const selectedReceiptMembers = useMemo(
        () => filteredTotals.filter(member => !excludedMemberIds.has(member.memberId)),
        [filteredTotals, excludedMemberIds]
    );

    const handleDownloadPdf = async () => {
        if (!selectedReceiptMembers.length) {
            setProfileMessage('Select at least one member before downloading receipts.');
            return;
        }

        setIsGeneratingPdf(true);
        setProfileMessage('');
        try {
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 30;
            const formatAmount = (amount: number) => `${settings.currency || 'CAD'} ${amount.toFixed(2)}`;
            const methodLabel = (method?: string) => method === 'check' ? 'Cheque' : method === 'e-transfer' ? 'E-Transfer' : method === 'cash' ? 'Cash' : 'Other';
            const categoryLabel = (type: string) => type.replace(/-/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
            const addImage = (image: string, x: number, y: number, width: number, height: number) => {
                if (!image) return;
                try {
                    const format = image.startsWith('data:image/png') ? 'PNG' : image.startsWith('data:image/webp') ? 'WEBP' : 'JPEG';
                    pdf.addImage(image, format, x, y, width, height, undefined, 'FAST');
                } catch {
                    // Invalid or unsupported images are omitted without blocking receipt generation.
                }
            };

            const drawSignature = (image: string, name: string, label: string, x: number, y: number) => {
                if (image) {
                    try {
                        const format = image.startsWith('data:image/png') ? 'PNG' : image.startsWith('data:image/webp') ? 'WEBP' : 'JPEG';
                        pdf.addImage(image, format, x, y, 90, 25, undefined, 'FAST');
                    } catch {
                        pdf.line(x, y + 25, x + 90, y + 25);
                    }
                } else {
                    pdf.line(x, y + 25, x + 90, y + 25);
                }
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(7);
                pdf.text(name || label, x, y + 36);
                pdf.setFont('helvetica', 'normal');
                pdf.text(label, x, y + 46);
            };

            const drawBarcode = (serial: string, x: number, y: number) => {
                const codes = Array.from(`${serial}-barcode`).map(character => character.charCodeAt(0));
                let barX = x;
                pdf.setFillColor(17, 24, 39);
                codes.forEach((code, index) => {
                    const width = 1 + (code % 3);
                    const height = 20 + (code % 14);
                    if (index % 2 === 0) pdf.rect(barX, y + 34 - height, width, height, 'F');
                    barX += width + 1;
                });
                pdf.setFont('courier', 'normal');
                pdf.setFontSize(6);
                pdf.text(serial, x, y + 43);
            };

            const drawReceiptCopy = (member: MemberTotals, copyLabel: string, top: number) => {
                const memberRecord = membersById.get(member.memberId);
                const memberAddress = memberRecord?.address?.trim() || '';
                const isOfficial = Boolean(memberAddress);
                pdf.setDrawColor(isOfficial ? 203 : 239, isOfficial ? 213 : 68, isOfficial ? 225 : 68);
                pdf.setLineWidth(1);
                pdf.rect(margin, top, pageWidth - margin * 2, 195);
                pdf.setFillColor(49, 46, 129);
                pdf.rect(margin, top, pageWidth - margin * 2, 22, 'F');
                pdf.setTextColor(255, 255, 255);
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(10);
                pdf.text('OFFICIAL RECEIPT FOR INCOME TAX PURPOSES', margin + 8, top + 15);
                pdf.setFontSize(7);
                pdf.text(copyLabel, pageWidth - margin - 8, top + 15, { align: 'right' });

                pdf.setTextColor(17, 24, 39);
                addImage(receiptProfile.logoImage, margin + 10, top + 31, 38, 38);
                pdf.setFontSize(9);
                pdf.text(orgName, margin + 55, top + 40);
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(7);
                pdf.text(pdf.splitTextToSize(orgAddress, 178), margin + 55, top + 52);
                pdf.text(`Phone: ${orgPhone}`, margin + 55, top + 73);
                pdf.setFont('courier', 'bold');
                pdf.text(`BN: ${charityNumber}`, margin + 55, top + 84);

                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(8);
                pdf.text(member.memberName.toUpperCase(), 315, top + 40);
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(7);
                pdf.text(`Donor ID: ${member.memberNumber || member.memberId.slice(0, 8)}`, 315, top + 53);
                pdf.setTextColor(isOfficial ? 55 : 185, isOfficial ? 65 : 28, isOfficial ? 81 : 28);
                pdf.text(pdf.splitTextToSize(isOfficial ? memberAddress : 'NOT OFFICIAL - No mailing address on file', 180), 315, top + 65);
                pdf.setTextColor(55, 65, 81);
                pdf.text(`Issue Date: ${new Date().toISOString().slice(0, 10)}`, 315, top + 88);
                drawBarcode(member.serial, 480, top + 40);

                drawSignature(receiptProfile.ministerSignature, receiptProfile.ministerName, 'Minister in Charge', margin + 10, top + 117);
                drawSignature(receiptProfile.treasurerSignature, receiptProfile.treasurerName, 'Finance Treasurer', margin + 135, top + 117);
                pdf.setFillColor(236, 253, 245);
                pdf.setDrawColor(34, 197, 94);
                pdf.roundedRect(390, top + 120, 165, 52, 4, 4, 'FD');
                pdf.setTextColor(21, 128, 61);
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(7);
                pdf.text('TOTAL ELIGIBLE AMOUNT', 472, top + 136, { align: 'center' });
                pdf.setFontSize(16);
                pdf.text(formatAmount(member.total), 472, top + 158, { align: 'center' });
                pdf.setTextColor(17, 24, 39);
                pdf.setFontSize(6);
                pdf.text(`Receipt No: ${member.serial} | Tax Year: ${year}`, margin + 10, top + 187);
            };

            for (let index = 0; index < selectedReceiptMembers.length; index++) {
                if (index > 0) pdf.addPage('letter', 'portrait');
                const member = selectedReceiptMembers[index];
                drawReceiptCopy(member, 'CRA Copy', 24);
                drawReceiptCopy(member, 'Donor Copy', 229);

                let cursorY = 450;
                const drawBreakdownHeader = (continued = false) => {
                    pdf.setFillColor(51, 65, 85);
                    pdf.rect(margin, cursorY, pageWidth - margin * 2, 20, 'F');
                    pdf.setTextColor(255, 255, 255);
                    pdf.setFont('helvetica', 'bold');
                    pdf.setFontSize(9);
                    pdf.text(`DETAILED TRANSACTION BREAKDOWN${continued ? ' - CONTINUED' : ''}`, margin + 7, cursorY + 14);
                    cursorY += 31;
                    pdf.setTextColor(17, 24, 39);
                    pdf.setFontSize(7);
                    pdf.text('Date', margin + 4, cursorY);
                    pdf.text('Category', margin + 88, cursorY);
                    pdf.text('Method', margin + 330, cursorY);
                    pdf.text('Amount', pageWidth - margin - 4, cursorY, { align: 'right' });
                    cursorY += 8;
                    pdf.line(margin, cursorY, pageWidth - margin, cursorY);
                    cursorY += 12;
                };
                drawBreakdownHeader();
                const transactions = [...member.entries].sort((left, right) => left.date.localeCompare(right.date));
                for (const transaction of transactions) {
                    if (cursorY > pageHeight - 48) {
                        pdf.addPage('letter', 'portrait');
                        cursorY = 30;
                        drawBreakdownHeader(true);
                    }
                    pdf.setFont('helvetica', 'normal');
                    pdf.setFontSize(7);
                    pdf.text(transaction.date, margin + 4, cursorY);
                    pdf.text(categoryLabel(transaction.type), margin + 88, cursorY);
                    pdf.text(methodLabel(transaction.method), margin + 330, cursorY);
                    pdf.setFont('helvetica', 'bold');
                    pdf.text(formatAmount(transaction.amount), pageWidth - margin - 4, cursorY, { align: 'right' });
                    cursorY += 15;
                }
                pdf.line(margin, cursorY, pageWidth - margin, cursorY);
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(8);
                pdf.text('TOTAL', margin + 330, cursorY + 14);
                pdf.text(formatAmount(member.total), pageWidth - margin - 4, cursorY + 14, { align: 'right' });
            }
            const safeSocietyName = orgName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
            const fileName = `${safeSocietyName}-Tax-Receipts-${year}.pdf`;
            const blobUrl = URL.createObjectURL(pdf.output('blob'));
            const downloadLink = document.createElement('a');
            downloadLink.href = blobUrl;
            downloadLink.download = fileName;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            downloadLink.remove();
            URL.revokeObjectURL(blobUrl);
            setProfileMessage(`${fileName} downloaded.`);
        } catch (error: any) {
            console.error('Tax receipt PDF generation failed:', error);
            setProfileMessage(`PDF generation failed: ${error.message || error}`);
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const orgName = selectedSociety?.name || settings.orgName || 'Ghana Methodist Church of Toronto';
    const orgAddress = selectedSociety?.address || settings.orgAddress || '69 Milvan Drive, Toronto, ON M9L 1Y8, Canada';
    const orgPhone = selectedSociety?.phone || settings.orgPhone || '416-901-5900';
    const orgEmail = selectedSociety?.email || settings.orgEmail || '';
    const orgWebsite = 'https://gmct-ca.org/';
    const charityNumber = receiptProfile.charityNumber || 'Registration Pending';
    const canManageReceiptProfile = currentUser.role === 'admin' && !selectedSociety?.isPrimary;

    const handleImageUpload = (field: 'logoImage' | 'ministerSignature' | 'treasurerSignature', file?: File) => {
        if (!file) return;
        if (file.size > 1024 * 1024) {
            setProfileMessage('Logo and signature images must be smaller than 1 MB.');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => setReceiptProfile(previous => ({ ...previous, [field]: String(reader.result || '') }));
        reader.readAsDataURL(file);
    };

    const handleSaveReceiptProfile = async () => {
        if (!selectedSociety || !canManageReceiptProfile) return;
        if (!receiptProfile.charityNumber.trim() || !receiptProfile.ministerName.trim() || !receiptProfile.treasurerName.trim()) {
            setProfileMessage('Charity number, minister name, and treasurer name are required.');
            return;
        }
        const tenantSession = sessionStorage.getItem('gmct-tenant-session');
        if (!tenantSession) {
            setProfileMessage('Your society session has expired. Please sign in again.');
            return;
        }
        setIsSavingProfile(true);
        setProfileMessage('');
        try {
            const response = await fetch(`${settings.supabaseUrl}/functions/v1/tenant-gateway/receipt-profile`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${tenantSession}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ profile: receiptProfile }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unable to save receipt details.');
            setProfileMessage('Receipt signing authority saved.');
        } catch (error: any) {
            setProfileMessage(error.message || 'Unable to save receipt details.');
        } finally {
            setIsSavingProfile(false);
        }
    };

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
                    {canManageReceiptProfile && <button
                        type="button"
                        onClick={() => setIsConfigOpen(!isConfigOpen)}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white font-semibold rounded-lg shadow text-sm"
                    >
                        ⚙️ Receipt Details
                    </button>}
                    <button onClick={handleDownloadPdf} disabled={isGeneratingPdf || selectedReceiptMembers.length === 0} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-lg shadow">{isGeneratingPdf ? 'Creating PDF...' : `Download PDF (${selectedReceiptMembers.length})`}</button>
                </div>
            </div>
            {profileMessage && <p className="no-print text-sm font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2">{profileMessage}</p>}

            {/* Society Tax Receipt Configuration Box */}
            {isConfigOpen && (
                <div className="bg-indigo-50 border-2 border-indigo-200 p-4 rounded-xl shadow-sm no-print space-y-3">
                    <h3 className="font-bold text-indigo-900 text-sm">Society Receipt Setup: {orgName}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">CRA / Charity Registration #</label>
                            <input
                                type="text"
                                value={receiptProfile.charityNumber}
                                onChange={e => setReceiptProfile(previous => ({ ...previous, charityNumber: e.target.value }))}
                                placeholder="e.g. 123456789RR0001"
                                className="w-full border-slate-300 rounded-lg shadow-sm text-sm"
                            />
                            <label className="block text-xs font-bold text-slate-700 mt-3 mb-1">Church logo</label>
                            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => handleImageUpload('logoImage', event.target.files?.[0])} className="w-full text-xs text-slate-600" />
                            {receiptProfile.logoImage && <img src={receiptProfile.logoImage} alt="Church logo preview" className="mt-2 h-14 w-14 object-contain border border-slate-200 rounded" />}
                        </div>
                        {(['minister', 'treasurer'] as const).map(role => <div key={role} className="space-y-2">
                            <label className="block text-xs font-bold text-slate-700">{role === 'minister' ? 'Minister in Charge' : 'Finance Treasurer'} name</label>
                            <input type="text" value={receiptProfile[`${role}Name`]} onChange={event => setReceiptProfile(previous => ({ ...previous, [`${role}Name`]: event.target.value }))} className="w-full border-slate-300 rounded-lg shadow-sm text-sm" />
                            <label className="block text-xs font-bold text-slate-700">{role === 'minister' ? 'Minister' : 'Treasurer'} signature</label>
                            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => handleImageUpload(`${role}Signature`, event.target.files?.[0])} className="w-full text-xs text-slate-600" />
                        </div>)}
                    </div>
                    <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-slate-700">{profileMessage}</p><button type="button" onClick={handleSaveReceiptProfile} disabled={isSavingProfile} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-lg text-sm">{isSavingProfile ? 'Saving...' : 'Save Receipt Details'}</button></div>
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

            {filteredTotals.length > 0 && (
                <div className="no-print bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900">Select Receipt Members</h3>
                            <p className="text-xs text-slate-600">{selectedReceiptMembers.length} of {filteredTotals.length} selected</p>
                        </div>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setExcludedMemberIds(new Set())} className="px-3 py-2 text-xs font-bold rounded-lg border border-indigo-300 text-indigo-700 hover:bg-indigo-50">Select All</button>
                            <button type="button" onClick={() => setExcludedMemberIds(new Set(filteredTotals.map(member => member.memberId)))} className="px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100">Clear All</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-slate-200 max-h-56 overflow-y-auto">
                        {filteredTotals.map(member => {
                            const isSelected = !excludedMemberIds.has(member.memberId);
                            return <label key={member.memberId} className="flex items-center gap-3 bg-white px-4 py-3 cursor-pointer hover:bg-indigo-50">
                                <input type="checkbox" checked={isSelected} onChange={() => setExcludedMemberIds(previous => {
                                    const next = new Set(previous);
                                    if (isSelected) next.add(member.memberId); else next.delete(member.memberId);
                                    return next;
                                })} className="h-5 w-5 text-indigo-600 rounded border-slate-300" />
                                <span className="min-w-0"><span className="block text-sm font-bold text-slate-900 truncate">{member.memberName}</span><span className="block text-xs text-slate-500">{member.memberNumber ? `#${member.memberNumber} · ` : ''}{formatCurrency(member.total, settings.currency || 'CAD')}</span></span>
                            </label>;
                        })}
                    </div>
                </div>
            )}

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
                        const transactionEntries = [...member.entries].sort((a, b) => a.date.localeCompare(b.date));
                        const issueDate = new Date().toISOString().split('T')[0];
                        
                        // Reusable summary section component
                        const SummarySection = ({ copyLabel }: { copyLabel: string }) => (
                            <div className="p-2 relative">
                                <div className="text-center mb-2 pb-1 border-b border-slate-300">
                                    {receiptProfile.logoImage && <img src={receiptProfile.logoImage} alt={`${orgName} logo`} className="absolute left-2 top-2 h-10 w-10 object-contain" />}
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
                                <div className="mt-2 grid grid-cols-3 gap-2 items-end">
                                    {(['minister', 'treasurer'] as const).map(role => {
                                        const signature = receiptProfile[`${role}Signature`];
                                        const name = receiptProfile[`${role}Name`] || (role === 'minister' ? 'Minister in Charge' : 'Finance Treasurer');
                                        return <div key={role} className="text-[9px]">
                                            {signature ? <img src={signature} alt={`${role} signature`} className="h-8 object-contain mb-1" /> : <div className="h-8 border-b border-slate-400" />}
                                            <div className="font-bold text-slate-900">{name}</div>
                                            <div className="text-slate-500">{role === 'minister' ? 'Minister in Charge' : 'Finance Treasurer'}</div>
                                        </div>;
                                    })}
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

                                <div className="mb-2">
                                    <div className="text-[9px] uppercase text-slate-500 font-bold mb-1">Eligible Transactions</div>
                                    <div className="bg-white rounded border border-slate-300 overflow-hidden">
                                        <table className="w-full text-[9px]">
                                            <thead><tr className="bg-slate-700 text-white"><th className="text-left px-2 py-1">Date</th><th className="text-left px-2 py-1">Category</th><th className="text-left px-2 py-1">Method</th><th className="text-right px-2 py-1">Amount</th></tr></thead>
                                            <tbody>
                                                {transactionEntries.map(entry => (
                                                    <tr key={entry.id} className="border-t border-slate-200">
                                                        <td className="px-2 py-1">{entry.date}</td>
                                                        <td className="px-2 py-1">{entry.type.replace(/-/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())}</td>
                                                        <td className="px-2 py-1">{entry.method === 'check' ? 'Cheque' : entry.method === 'e-transfer' ? 'E-Transfer' : entry.method === 'cash' ? 'Cash' : 'Other'}</td>
                                                        <td className="px-2 py-1 text-right font-bold">{formatCurrency(entry.amount, settings.currency || 'CAD')}</td>
                                                    </tr>
                                                ))}
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
