import { jsPDF } from 'jspdf';
import type { Entry, Member } from '../types';
import { taxReceiptStatus } from './taxReceiptApproval';

export interface ReceiptProfile {
    charityNumber: string; logoImage: string; ministerName: string; ministerSignature: string; treasurerName: string; treasurerSignature: string;
}
export interface ReceiptMember {
    memberId: string; memberName: string; memberNumber?: string; total: number; entries: Entry[]; serial: string;
}

export function createTaxReceiptsPdf({ selectedReceiptMembers, membersById, receiptProfile, currency, orgName, orgAddress, orgPhone, charityNumber, year, approvalEnabled }: {
    selectedReceiptMembers: ReceiptMember[]; membersById: Map<string, Member>; receiptProfile: ReceiptProfile; currency: string;
    orgName: string; orgAddress: string; orgPhone: string; charityNumber: string; year: string; approvalEnabled: boolean;
}) {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 30;
    const formatAmount = (amount: number) => `${currency || 'CAD'} ${amount.toFixed(2)}`;
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

    const drawReceiptCopy = (member: ReceiptMember, copyLabel: string, top: number) => {
        const memberRecord = membersById.get(member.memberId);
        const memberAddress = memberRecord?.address?.trim() || '';
        const status = taxReceiptStatus(approvalEnabled, memberAddress);
        const isOfficial = status.official;
        const reference = isOfficial ? member.serial : `DRAFT-${member.serial}`;
        pdf.setDrawColor(isOfficial ? 203 : 239, isOfficial ? 213 : 68, isOfficial ? 225 : 68);
        pdf.setLineWidth(1);
        pdf.rect(margin, top, pageWidth - margin * 2, 195);
        pdf.setFillColor(49, 46, 129);
        pdf.rect(margin, top, pageWidth - margin * 2, 22, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.text(status.title, margin + 8, top + 15);
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
        pdf.text(pdf.splitTextToSize(memberAddress || 'No mailing address on file', 180), 315, top + 65);
        pdf.setTextColor(55, 65, 81);
        pdf.text(`${isOfficial ? 'Issue' : 'Prepared'} Date: ${new Date().toISOString().slice(0, 10)}`, 315, top + 88);
        drawBarcode(reference, 480, top + 40);

        drawSignature(isOfficial ? receiptProfile.ministerSignature : '', receiptProfile.ministerName, 'Minister in Charge', margin + 10, top + 117);
        drawSignature(isOfficial ? receiptProfile.treasurerSignature : '', receiptProfile.treasurerName, 'Finance Treasurer', margin + 135, top + 117);
        if (!isOfficial) {
            pdf.setTextColor(185, 28, 28);
            pdf.setFontSize(25);
            pdf.text('DRAFT', 300, top + 115, { align: 'center' });
            pdf.setFontSize(7);
            pdf.text(status.reason, margin + 10, top + 101);
        }
        pdf.setFillColor(236, 253, 245);
        pdf.setDrawColor(34, 197, 94);
        pdf.roundedRect(390, top + 120, 165, 52, 4, 4, 'FD');
        pdf.setTextColor(21, 128, 61);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7);
        pdf.text(isOfficial ? 'TOTAL ELIGIBLE AMOUNT' : 'DONATION TOTAL - DRAFT', 472, top + 136, { align: 'center' });
        pdf.setFontSize(16);
        pdf.text(formatAmount(member.total), 472, top + 158, { align: 'center' });
        pdf.setTextColor(17, 24, 39);
        pdf.setFontSize(6);
        pdf.text(`${isOfficial ? 'Receipt No' : 'Draft Ref'}: ${reference} | Tax Year: ${year}`, margin + 10, top + 187);
    };

    for (let index = 0; index < selectedReceiptMembers.length; index++) {
        if (index > 0) pdf.addPage('letter', 'portrait');
        const member = selectedReceiptMembers[index];
        const status = taxReceiptStatus(approvalEnabled, membersById.get(member.memberId)?.address);
        drawReceiptCopy(member, status.official ? 'CRA Copy' : 'Review Copy', 24);
        drawReceiptCopy(member, 'Donor Copy', 229);

        let cursorY = 450;
        const drawBreakdownHeader = (continued = false) => {
            pdf.setFillColor(51, 65, 85);
            pdf.rect(margin, cursorY, pageWidth - margin * 2, 20, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(9);
            pdf.text(`${status.official ? '' : 'DRAFT - '}TRANSACTION BREAKDOWN${continued ? ' - CONTINUED' : ''}`, margin + 7, cursorY + 14);
            cursorY += 31;
            if (!status.official) {
                pdf.setTextColor(185, 28, 28);
                pdf.setFontSize(7);
                pdf.text('DRAFT - NOT VALID FOR TAX PURPOSES', margin + 4, cursorY);
                cursorY += 14;
            }
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
    const allOfficial = selectedReceiptMembers.every(member => taxReceiptStatus(approvalEnabled, membersById.get(member.memberId)?.address).official);
    const fileName = `${safeSocietyName}-${allOfficial ? 'Tax-Receipts' : 'Draft-Receipts'}-${year}.pdf`;
    return { pdf, fileName };
}
