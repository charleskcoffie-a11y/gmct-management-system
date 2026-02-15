import jsPDF from 'jspdf';
import type { Requisition, Settings } from '../types';
import { formatCurrency } from '../utils';

type RequisitionPdfData = {
  requisition: Requisition;
  settings: Settings;
};

type RequisitionTemplateData = {
  settings: Settings;
};

const approverLabel = (role?: string) => {
  if (role === 'pastor') return 'Pastor';
  if (role === 'finance-team') return 'Steward (Finance Team)';
  if (role === 'admin') return 'Admin';
  return 'Unassigned';
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const generateRequisitionPdf = ({ requisition, settings }: RequisitionPdfData) => {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const leftMargin = 40;
  const rightMargin = 40;
  const contentWidth = pageWidth - leftMargin - rightMargin;
  let y = 40;

  // Header with org name and requisition number
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(settings.orgName || 'Requisition', leftMargin, y);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (settings.orgAddress) doc.text(`Address: ${settings.orgAddress}`, leftMargin, y + 12);
  if (settings.orgPhone) doc.text(`Phone: ${settings.orgPhone}`, leftMargin, y + 22);
  if (settings.orgEmail) doc.text(`Email: ${settings.orgEmail}`, leftMargin, y + 32);

  // Requisition number prominently displayed on right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  const reqNumText = requisition.requisitionNumber || 'PENDING';
  const reqNumWidth = doc.getTextWidth(reqNumText);
  doc.text(reqNumText, pageWidth - rightMargin - reqNumWidth, y);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Requisition #', pageWidth - rightMargin - reqNumWidth, y + 12);

  y += 50;

  // Divider line
  doc.setDrawColor(100, 100, 100);
  doc.line(leftMargin, y, pageWidth - rightMargin, y);
  y += 12;

  // Document info row (Date, Status, ID)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Document Information', leftMargin, y);
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const col1Width = contentWidth * 0.33;
  const col2Width = contentWidth * 0.33;
  const col3Width = contentWidth * 0.34;

  doc.text(`Date: ${formatDate(requisition.dateCreated)}`, leftMargin, y);
  doc.text(`Status: ${requisition.status.toUpperCase()}`, leftMargin + col1Width, y);
  doc.text(`ID: ${requisition.id.slice(0, 8).toUpperCase()}`, leftMargin + col1Width + col2Width, y);
  y += 16;

  // Requester info section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Requester Information', leftMargin, y);
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Name: ${requisition.requesterName || '-'}`, leftMargin, y);
  y += 12;
  doc.text(`Username: ${requisition.requesterUsername || '-'}`, leftMargin, y);
  y += 16;

  // Request details section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Request Details', leftMargin, y);
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Title: ${requisition.title || '-'}`, leftMargin, y);
  y += 12;
  doc.text(`Intended For: ${requisition.intendedFor || '-'}`, leftMargin, y);
  y += 12;
  doc.text(`Purchase Type: ${requisition.purchaseType || '-'}`, leftMargin, y);
  y += 12;
  doc.text(`Fund/Category: ${requisition.fund || '-'}`, leftMargin, y);
  y += 12;
  doc.text(`Needed By: ${formatDate(requisition.neededBy)}`, leftMargin, y);
  y += 16;

  // Purpose section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Purpose', leftMargin, y);
  y += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const purposeText = requisition.purpose || '-';
  const purposeLines = doc.splitTextToSize(purposeText, contentWidth);
  doc.text(purposeLines, leftMargin, y);
  y += purposeLines.length * 11 + 12;

  // Items section with table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Items Ordered', leftMargin, y);
  y += 14;

  // Table headers
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const itemNoWidth = 30;
  const descWidth = contentWidth * 0.45;
  const qtyWidth = 50;
  const unitPriceWidth = 80;
  const amountWidth = 80;

  doc.text('#', leftMargin, y);
  doc.text('Description', leftMargin + itemNoWidth, y);
  doc.text('Qty', leftMargin + itemNoWidth + descWidth, y);
  doc.text('Unit Price', leftMargin + itemNoWidth + descWidth + qtyWidth, y);
  doc.text('Amount', leftMargin + itemNoWidth + descWidth + qtyWidth + unitPriceWidth, y);

  // Divider under headers
  y += 2;
  doc.setDrawColor(150, 150, 150);
  doc.line(leftMargin, y, pageWidth - rightMargin, y);
  y += 10;

  // Items
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  let subtotal = 0;

  if (requisition.items && requisition.items.length > 0) {
    requisition.items.forEach((item, index) => {
      const itemAmount = (item.qty || 0) * (item.unitPrice || 0);
      subtotal += itemAmount;

      doc.text((index + 1).toString(), leftMargin, y);
      
      // Handle long descriptions
      const descLines = doc.splitTextToSize(item.description, descWidth - 5);
      doc.text(descLines, leftMargin + itemNoWidth, y);
      const descHeight = descLines.length * 10;

      doc.text(item.qty.toString(), leftMargin + itemNoWidth + descWidth, y);
      doc.text(formatCurrency(item.unitPrice || 0, settings.currency), leftMargin + itemNoWidth + descWidth + qtyWidth, y);
      doc.text(formatCurrency(itemAmount, settings.currency), leftMargin + itemNoWidth + descWidth + qtyWidth + unitPriceWidth, y);

      y += Math.max(descHeight, 12);
    });
  } else {
    doc.text('No items', leftMargin, y);
    y += 12;
  }

  y += 6;
  doc.setDrawColor(100, 100, 100);
  doc.line(leftMargin, y, pageWidth - rightMargin, y);
  y += 10;

  // Totals
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Grand Total:', leftMargin + itemNoWidth + descWidth + qtyWidth, y);
  doc.text(formatCurrency(requisition.totalAmount || 0, settings.currency || 'USD'), leftMargin + itemNoWidth + descWidth + qtyWidth + unitPriceWidth, y);
  y += 16;

  // Approval section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Approval Information', leftMargin, y);
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const approverName = requisition.requiredApproverUsername
    ? `${approverLabel(requisition.requiredApproverRole)} - ${requisition.requiredApproverUsername}`
    : approverLabel(requisition.requiredApproverRole);
  doc.text(`Required Approver: ${approverName}`, leftMargin, y);
  y += 12;

  const latestApproval = requisition.approvals && requisition.approvals.length > 0 ? requisition.approvals[0] : undefined;
  if (latestApproval) {
    doc.text(`Decision: ${latestApproval.decision.toUpperCase()}`, leftMargin, y);
    y += 12;
    doc.text(`Approved By: ${latestApproval.approverUsername || '-'}`, leftMargin, y);
    y += 12;
    doc.text(`Signature Name: ${latestApproval.signatureName || '-'}`, leftMargin, y);
    y += 12;
    doc.text(`Signed: ${formatDate(latestApproval.signatureAt)}`, leftMargin, y);
  } else {
    doc.text('Status: Not yet approved', leftMargin, y);
  }

  return doc;
};

export const downloadRequisitionPdf = ({ requisition, settings }: RequisitionPdfData) => {
  const doc = generateRequisitionPdf({ requisition, settings });
  const safeReqNum = (requisition.requisitionNumber || 'REQUISITION').replace(/\s+/g, '_');
  const fileName = `${safeReqNum}.pdf`;
  doc.save(fileName);
};

export const generateRequisitionTemplatePdf = ({ settings }: RequisitionTemplateData) => {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const leftMargin = 40;
  const rightMargin = 40;
  const contentWidth = pageWidth - leftMargin - rightMargin;
  let y = 40;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  const headerText = 'GHANA METHODIST CHURCH OF TORONTO';
  const headerWidth = doc.getTextWidth(headerText);
  doc.text(headerText, (pageWidth - headerWidth) / 2, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (settings.orgAddress) doc.text(`Address: ${settings.orgAddress}`, leftMargin, y + 12);
  if (settings.orgPhone) doc.text(`Phone: ${settings.orgPhone}`, leftMargin, y + 22);
  if (settings.orgEmail) doc.text(`Email: ${settings.orgEmail}`, leftMargin, y + 32);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  const subHeaderText = 'REQUISITION FORM';
  const subHeaderWidth = doc.getTextWidth(subHeaderText);
  doc.text(subHeaderText, (pageWidth - subHeaderWidth) / 2, y + 18);

  y += 60;
  doc.setDrawColor(100, 100, 100);
  doc.line(leftMargin, y, pageWidth - rightMargin, y);
  y += 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Requester Information', leftMargin, y);
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Name: ________________________________________________', leftMargin, y);
  y += 16;
  doc.text('Username: _____________________________________________', leftMargin, y);
  y += 22;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Request Details', leftMargin, y);
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Title: _________________________________________________', leftMargin, y);
  y += 16;
  doc.text('Purpose: _______________________________________________', leftMargin, y);
  y += 16;
  doc.text('Intended For (Approver): ________________________________', leftMargin, y);
  y += 16;
  doc.text('Fund/Category: __________________________________________', leftMargin, y);
  y += 16;
  doc.text('Needed By: ____________________    Purchase Type: ________', leftMargin, y);
  y += 24;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Items Ordered', leftMargin, y);
  y += 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const itemNoWidth = 30;
  const descWidth = contentWidth * 0.45;
  const qtyWidth = 50;
  const unitPriceWidth = 80;
  const amountWidth = 80;

  doc.text('#', leftMargin, y);
  doc.text('Description', leftMargin + itemNoWidth, y);
  doc.text('Qty', leftMargin + itemNoWidth + descWidth, y);
  doc.text('Unit Price', leftMargin + itemNoWidth + descWidth + qtyWidth, y);
  doc.text('Amount', leftMargin + itemNoWidth + descWidth + qtyWidth + unitPriceWidth, y);
  y += 2;
  doc.setDrawColor(150, 150, 150);
  doc.line(leftMargin, y, pageWidth - rightMargin, y);
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  for (let i = 0; i < 8; i += 1) {
    doc.text(String(i + 1), leftMargin, y);
    doc.text('____________________________________________', leftMargin + itemNoWidth, y);
    doc.text('____', leftMargin + itemNoWidth + descWidth, y);
    doc.text('__________', leftMargin + itemNoWidth + descWidth + qtyWidth, y);
    doc.text('__________', leftMargin + itemNoWidth + descWidth + qtyWidth + unitPriceWidth, y);
    y += 22;
  }

  y += 6;
  doc.setDrawColor(100, 100, 100);
  doc.line(leftMargin, y, pageWidth - rightMargin, y);
  y += 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Grand Total:', leftMargin + itemNoWidth + descWidth + qtyWidth, y);
  doc.text('__________________', leftMargin + itemNoWidth + descWidth + qtyWidth + unitPriceWidth, y);
  y += 22;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Approval', leftMargin, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Approved By: ___________________________________________', leftMargin, y);
  y += 16;
  doc.text('Signature: ______________________________________________', leftMargin, y);
  y += 16;
  doc.text('Date: ____________________', leftMargin, y);

  return doc;
};

export const downloadRequisitionTemplatePdf = ({ settings }: RequisitionTemplateData) => {
  const doc = generateRequisitionTemplatePdf({ settings });
  doc.save('REQUISITION_FORM_TEMPLATE.pdf');
};
