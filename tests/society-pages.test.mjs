import test from 'node:test';
import assert from 'node:assert/strict';
import { isSocietyPageEnabled, normalizedSocietyPages, societyPagePreset } from '../services/societyPages.ts';

test('attendance and development switches cover both menu aliases and opened pages', () => {
    const features = { attendance: false, developmentFund: false };
    for (const page of ['attendance', 'reports-bible-class', 'bible-class-attendance', 'development-fund']) {
        assert.equal(isSocietyPageEnabled(page, features, true), false, page);
    }
    for (const page of ['home', 'settings', 'users', 'members']) {
        assert.equal(isSocietyPageEnabled(page, features, true), true, page);
    }
});

test('a basic preset trims optional modules without mutating saved or unrelated society options', () => {
    const original = { maxClasses: 8, childrensMinistry: true, developmentFund: true, attendance: true };
    const basic = societyPagePreset(original, 'basic');
    assert.equal(basic.developmentFund, false);
    assert.equal(basic.attendance, false);
    assert.equal(basic.financialRecords, true);
    assert.equal(basic.memberDirectory, true);
    assert.equal(basic.maxClasses, 8);
    assert.equal(basic.childrensMinistry, true);
    assert.equal(original.developmentFund, true);
    assert.equal(original.attendance, true);
});

test('missing attendance settings default by society while explicit choices are preserved', () => {
    assert.equal(normalizedSocietyPages({}, false).attendance, false);
    assert.equal(normalizedSocietyPages({}, true).attendance, true);
    assert.equal(normalizedSocietyPages({ attendance: true, developmentFund: true }, false).attendance, true);
    assert.equal(normalizedSocietyPages({ developmentFund: false }, true).developmentFund, false);
});

test('all-page and individual report settings remain independent', () => {
    const features = { ...societyPagePreset({}, 'all'), financialReports: false, weeklyHistory: false, requisitions: false };
    for (const page of ['reports', 'history', 'reports-weekly', 'weekly-history', 'requisitions', 'my-approvals']) {
        assert.equal(isSocietyPageEnabled(page, features, true), false, page);
    }
    assert.equal(isSocietyPageEnabled('records', features, true), true);
    assert.equal(isSocietyPageEnabled('home', features, true), true);
});
