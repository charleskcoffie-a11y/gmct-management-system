import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { taxReceiptStatus, loadTaxReceiptApproval } from '../services/taxReceiptApproval.ts';

let server, createTaxReceiptsPdf;
before(async () => {
    server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
    ({ createTaxReceiptsPdf } = await server.ssrLoadModule('/services/taxReceiptsPdf.ts'));
});
after(async () => { await server?.close(); });

test('receipts require explicit approval and a donor address', () => {
    assert.equal(taxReceiptStatus(false, '123 Test Street').official, false);
    assert.equal(taxReceiptStatus(undefined, '123 Test Street').official, false);
    assert.equal(taxReceiptStatus(true, '  ').official, false);
    assert.equal(taxReceiptStatus(true, '123 Test Street').official, true);
});

test('approval is read from the selected society and database errors cannot enable it', async () => {
    const filters = [];
    const query = { eq(key, value) { filters.push([key, value]); return query; }, async maybeSingle() { return { data: { official_tax_receipts_enabled: true }, error: null }; } };
    const client = { from(table) { assert.equal(table, 'app_settings'); return { select() { return query; } }; } };
    assert.equal(await loadTaxReceiptApproval(client, 'ebenezer-hamilton'), true);
    assert.deepEqual(filters, [['society_id', 'ebenezer-hamilton'], ['id', 'app_settings']]);
    query.maybeSingle = async () => ({ data: null, error: null });
    assert.equal(await loadTaxReceiptApproval(client, 'ebenezer-hamilton'), false);
    query.maybeSingle = async () => ({ data: null, error: new Error('Connection lost') });
    await assert.rejects(loadTaxReceiptApproval(client, 'ebenezer-hamilton'), /Connection lost/);
});

const fixture = (approved, address = '123 Test Street') => {
    const entries = Array.from({ length: 65 }, (_, index) => ({ id: String(index), date: '2026-11-15', type: 'tithe', method: 'cash', amount: 1 }));
    return { approvalEnabled: approved, year: '2026', currency: 'CAD', orgName: 'Test Society', orgAddress: '1 Church Street', orgPhone: '555-0100', charityNumber: 'TEST-ONLY',
        receiptProfile: { charityNumber: 'TEST-ONLY', logoImage: '', ministerName: 'Test Minister', ministerSignature: '', treasurerName: 'Test Treasurer', treasurerSignature: '' },
        membersById: new Map([['member', { id: 'member', address }]]), selectedReceiptMembers: [{ memberId: 'member', memberName: 'Test Member', memberNumber: '1', total: entries.length, entries, serial: '2026-TEST-0001' }] };
};

test('draft PDF marks every page and both copies, including continued breakdowns', () => {
    const { pdf, fileName } = createTaxReceiptsPdf(fixture(false));
    const content = pdf.output();
    assert.ok(pdf.getNumberOfPages() > 1);
    assert.ok(fileName.includes('Draft-Receipts'));
    assert.ok(content.includes('DRAFT-2026-TEST-0001'));
    assert.ok(!content.includes('OFFICIAL RECEIPT FOR INCOME TAX PURPOSES'));
    const pages = content.split(/\/Type \/Page\b/).slice(1);
    assert.ok((content.match(/DRAFT - NOT VALID FOR TAX PURPOSES/g) || []).length >= pages.length);
    assert.ok(content.includes('DRAFT - TRANSACTION BREAKDOWN - CONTINUED'));
});

test('enabled receipts are official only for donors with mailing addresses', () => {
    const official = createTaxReceiptsPdf(fixture(true));
    assert.ok(official.fileName.includes('Tax-Receipts'));
    assert.ok(official.pdf.output().includes('OFFICIAL RECEIPT FOR INCOME TAX PURPOSES'));
    assert.ok(!official.pdf.output().includes('DRAFT - NOT VALID FOR TAX PURPOSES'));
    const missingAddress = createTaxReceiptsPdf(fixture(true, ''));
    assert.ok(missingAddress.fileName.includes('Draft-Receipts'));
    assert.ok(!missingAddress.pdf.output().includes('OFFICIAL RECEIPT FOR INCOME TAX PURPOSES'));
});
